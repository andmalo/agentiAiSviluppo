import { randomUUID } from 'node:crypto';

const TABLE = 'evaluations';

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

  return `${url}/storage/v1/object/public/${bucket}/${path}`;
}

async function insertRow({ category, brand, condition, photoUrl, result }) {
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
        photo_url: photoUrl,
        response: result
      }
    ])
  });

  if (!response.ok) {
    throw new Error(`Salvataggio su Supabase fallito (${response.status}).`);
  }
}

export async function saveEvaluation({ category, brand, condition, photo, result }) {
  const photoUrl = await uploadPhoto(photo);
  await insertRow({ category, brand, condition, photoUrl, result });
}

export async function listEvaluations(limit = 50) {
  const { url, key } = getConfig();

  const response = await fetch(
    `${url}/rest/v1/${TABLE}?select=*&order=created_at.desc&limit=${limit}`,
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

  return response.json();
}
