import http from 'node:http';
import { evaluateClothing } from './services/pricingService.js';
import { saveEvaluation, listEvaluations } from './services/supabaseService.js';
import { decodeAndValidateImage } from './utils/imageValidation.js';
import { checkRateLimit } from './utils/rateLimit.js';

const MAX_BODY_BYTES = 12 * 1024 * 1024;
const MAX_BRAND_LENGTH = 60;

const CATEGORIES = [
  'Maglieria',
  'Camicie',
  'T-shirt',
  'Pantaloni',
  'Jeans',
  'Gonne',
  'Abiti',
  'Giacche e cappotti',
  'Felpe',
  'Scarpe',
  'Borse',
  'Accessori'
];

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJson(res, status, payload) {
  setCorsHeaders(res);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        req.destroy();
        reject(Object.assign(new Error('Payload troppo grande.'), { status: 413 }));
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function handleEvaluate(req, res) {
  const rateLimitError = checkRateLimit(req);
  if (rateLimitError) {
    return sendJson(res, 429, { error: rateLimitError });
  }

  let body;

  try {
    const raw = await readBody(req);
    body = raw ? JSON.parse(raw) : {};
  } catch (error) {
    return sendJson(res, error.status ?? 400, {
      error: error.status === 413 ? 'Payload troppo grande.' : 'Il body deve essere JSON valido.'
    });
  }

  const { category, brand, condition, photo } = body;

  // Rimuove newline/tab/altri caratteri di controllo: brand è testo libero
  // inserito dall'utente e finisce dentro il prompt mandato al modello, non
  // deve poter spezzare la struttura del messaggio su più righe.
  const sanitizedBrand = typeof brand === 'string' ? brand.replace(/[\p{Cc}]+/gu, ' ').trim() : '';

  if (
    typeof category !== 'string' ||
    !CATEGORIES.includes(category) ||
    !sanitizedBrand ||
    sanitizedBrand.length > MAX_BRAND_LENGTH ||
    !['nuovo', 'buono', 'usato'].includes(condition)
  ) {
    return sendJson(res, 400, {
      error: `category deve essere una categoria valida, brand non vuoto (max ${MAX_BRAND_LENGTH} caratteri), condition deve essere nuovo, buono oppure usato.`
    });
  }

  if (
    !photo ||
    !['image/jpeg', 'image/png', 'image/webp'].includes(photo.media_type) ||
    typeof photo.data !== 'string' ||
    !photo.data.trim()
  ) {
    return sendJson(res, 400, {
      error: 'photo.media_type deve essere image/jpeg, image/png o image/webp e photo.data deve contenere il base64.'
    });
  }

  const rawPhotoData = photo.data.replace(/^data:[^;]+;base64,/, '');
  const imageCheck = decodeAndValidateImage(rawPhotoData, photo.media_type);

  if (!imageCheck.valid) {
    return sendJson(res, 400, { error: imageCheck.reason });
  }

  const cleanedCategory = category;
  const cleanedBrand = sanitizedBrand;
  const cleanedPhoto = {
    media_type: photo.media_type,
    data: rawPhotoData
  };

  let result;

  try {
    result = await evaluateClothing({
      category: cleanedCategory,
      brand: cleanedBrand,
      condition,
      photo: cleanedPhoto
    });
  } catch (error) {
    console.error('Evaluation error:', error);

    if (error.code === 'MISSING_API_KEY') {
      return sendJson(res, 500, { error: 'Configurazione server incompleta.' });
    }

    if (error.message.includes('formato previsto') || error.message.includes('oggetto JSON')) {
      return sendJson(res, 502, { error: 'Risposta non valida dal servizio di valutazione.' });
    }

    return sendJson(res, 502, { error: 'Impossibile completare la valutazione.' });
  }

  sendJson(res, 200, result);

  saveEvaluation({
    category: cleanedCategory,
    brand: cleanedBrand,
    condition,
    photo: cleanedPhoto,
    result
  }).catch((error) => {
    console.error('Salvataggio valutazione fallito:', error);
  });
}

async function handleListEvaluations(req, res) {
  try {
    const { searchParams } = new URL(req.url, 'http://localhost');
    const requested = Number(searchParams.get('limit'));
    const limit = Number.isInteger(requested) && requested > 0 && requested <= 100 ? requested : 50;

    const rows = await listEvaluations(limit);
    return sendJson(res, 200, rows);
  } catch (error) {
    console.error('Lettura storico fallita:', error);
    return sendJson(res, 502, { error: 'Impossibile recuperare lo storico.' });
  }
}

const app = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res);
    res.writeHead(204);
    return res.end();
  }

  const { pathname } = new URL(req.url, 'http://localhost');

  if (req.method === 'POST' && pathname === '/evaluate') {
    handleEvaluate(req, res).catch((error) => {
      console.error('Unhandled server error:', error);
      sendJson(res, 500, { error: 'Errore interno del server.' });
    });
    return;
  }

  if (req.method === 'GET' && pathname === '/evaluations') {
    handleListEvaluations(req, res).catch((error) => {
      console.error('Unhandled server error:', error);
      sendJson(res, 500, { error: 'Errore interno del server.' });
    });
    return;
  }

  sendJson(res, 404, { error: 'Rotta non trovata.' });
});

export default app;
