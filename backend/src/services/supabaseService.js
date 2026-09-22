import { randomUUID } from 'node:crypto';

const TABLE = 'evaluations';
const SIGNED_URL_EXPIRES_IN = 60 * 60;
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 500;

const EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
};

function getConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  const bucket = process.env.SUPABASE_BUCKET || 'photos';

  if (!url || !key) {
    throw new Error('Supabase non configurato (SUPABASE_URL / SUPABASE_SERVICE_KEY mancanti).');
  }

  return { url: url.replace(/\/$/, ''), key, bucket };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Riprova un'operazione di rete un paio di volte prima di arrendersi: un
// singolo errore transitorio su Supabase non deve far perdere la valutazione.
async function withRetry(fn) {
  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < MAX_ATTEMPTS) {
        await wait(RETRY_DELAY_MS * attempt);
      }
    }
  }

  throw lastError;
}

async function uploadPhoto(photo) {
  const { url, key, bucket } = getConfig();
  const ext = EXTENSIONS[photo.media_type] || 'jpg';
  const path = `${randomUUID()}.${ext}`;

  const response = await fetch(`${url}/storage/v1/object/${bucket}/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': photo.media_type,
      Authorization: `Bearer ${key}`,
      apikey: key
    },
    body: Buffer.from(photo.data, 'base64')
  });

  if (!response.ok) {
    throw new Error(`Caricamento foto su Supabase fallito (${response.status}).`);
  }

  return path;
}

// Il bucket è privato: l'url pubblico non serve a nulla, va generato un url
// firmato con scadenza ogni volta che una foto deve essere mostrata.
async function getSignedUrl(path) {
  if (!path) {
    return null;
  }

  const { url, key, bucket } = getConfig();

  const response = await fetch(`${url}/storage/v1/object/sign/${bucket}/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
      apikey: key
    },
    body: JSON.stringify({ expiresIn: SIGNED_URL_EXPIRES_IN })
  });

  if (!response.ok) {
    console.error(`Impossibile firmare l'url per ${path} (${response.status}).`);
    return null;
  }

  const data = await response.json();
  return data.signedURL ? `${url}/storage/v1${data.signedURL}` : null;
}

async function insertRow({ category, brand, condition, photoPath, result, status, errorMessage }) {
  const { url, key } = getConfig();

  const response = await fetch(`${url}/rest/v1/${TABLE}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
      apikey: key,
      Prefer: 'return=minimal'
    },
    body: JSON.stringify([
      {
        category,
        brand,
        condition,
        photo_path: photoPath ?? null,
        response: result ?? null,
        status,
        error_message: errorMessage ?? null
      }
    ])
  });

  if (!response.ok) {
    throw new Error(`Salvataggio su Supabase fallito (${response.status}).`);
  }
}

export async function saveEvaluation({ category, brand, condition, photo, result }) {
  let photoPath = null;

  try {
    photoPath = await withRetry(() => uploadPhoto(photo));
    await withRetry(() =>
      insertRow({ category, brand, condition, photoPath, result, status: 'completed' })
    );
  } catch (error) {
    // La risposta all'utente è già partita: qui proviamo almeno a lasciare
    // una traccia del fallimento invece di far sparire la valutazione senza
    // nessun record (utile per capire quante ne falliscono e perché).
    await insertRow({
      category,
      brand,
      condition,
      photoPath,
      result: null,
      status: 'failed',
      errorMessage: String(error?.message || error)
    }).catch((insertError) => {
      console.error('Impossibile registrare anche il fallimento del salvataggio:', insertError);
    });

    throw error;
  }
}

export async function listEvaluations(limit = 50) {
  const { url, key } = getConfig();

  const response = await fetch(
    `${url}/rest/v1/${TABLE}?select=*&status=eq.completed&order=created_at.desc&limit=${limit}`,
    {
      headers: {
        Authorization: `Bearer ${key}`,
        apikey: key
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Lettura storico da Supabase fallita (${response.status}).`);
  }

  const rows = await response.json();

  return Promise.all(
    rows.map(async ({ photo_path: photoPath, ...row }) => ({
      ...row,
      photo_url: await getSignedUrl(photoPath)
    }))
  );
}
