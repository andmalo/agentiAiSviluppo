const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

async function parseJsonResponse(response) {
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || 'Richiesta al backend non riuscita.');
  }

  return data;
}

export async function evaluate({ category, brand, condition, photo }) {
  const response = await fetch(`${API_URL}/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category, brand, condition, photo })
  });

  return parseJsonResponse(response);
}

export async function getEvaluations(limit = 10) {
  const response = await fetch(`${API_URL}/evaluations?limit=${limit}`);
  return parseJsonResponse(response);
}
