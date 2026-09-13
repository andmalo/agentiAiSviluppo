const API_URL = 'https://api.openai.com/v1/chat/completions';

const PROMPT = `Sei un valutatore esperto di abbigliamento second-hand per il mercato italiano.
Ricevi la foto di un capo usato insieme a categoria, brand e stato dichiarato
(nuovo, buono, usato). Devi stimare un prezzo di vendita realistico su un
marketplace italiano dell'usato tipo Vinted.

Analizza il capo considerando: il posizionamento del brand (fast fashion, medio,
premium, lusso), lo stato reale che vedi nella foto confrontato con quello
dichiarato, la categoria, la stagionalità rispetto al periodo dell'anno,
l'eventuale rarità o ricercatezza del pezzo e la domanda potenziale.

Rispondi SOLO con un oggetto JSON valido, senza testo prima o dopo, senza
markdown, esattamente in questa forma:
{
  "suggested_price": <intero in euro>,
  "range": { "min": <intero>, "max": <intero> },
  "motivation": "<spiegazione chiara in italiano del perché di questo prezzo>",
  "selling_tips": ["<consiglio>", "<consiglio>"]
}

Regole: prezzi in euro realistici per l'usato italiano; min < suggested_price <
max; nella motivation cita i fattori concreti che hanno pesato; i selling_tips
sono 2-4 consigli pratici per vendere più in fretta (qualità della foto, piccolo
ritocco del prezzo, momento o stagione giusta per pubblicare). Se la foto è
poco leggibile o i dati sono scarsi, fai comunque la stima più ragionevole e
segnala l'incertezza nella motivation.`;

const DEFAULT_MODEL = 'gpt-4o';

function extractJson(text) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');

    if (start === -1 || end <= start) {
      throw new Error('La risposta non contiene un oggetto JSON.');
    }

    return JSON.parse(cleaned.slice(start, end + 1));
  }
}

function validateEvaluation(result) {
  const validNumbers =
    typeof result?.suggested_price === 'number' &&
    Number.isFinite(result.suggested_price) &&
    typeof result?.range?.min === 'number' &&
    typeof result?.range?.max === 'number' &&
    result.range.min > 0 &&
    result.range.min < result.suggested_price &&
    result.suggested_price < result.range.max;

  const validTips =
    Array.isArray(result?.selling_tips) &&
    result.selling_tips.length > 0 &&
    result.selling_tips.every((tip) => typeof tip === 'string');

  if (!validNumbers || typeof result.motivation !== 'string' || !validTips) {
    throw new Error('La risposta non rispetta il formato previsto.');
  }

  return {
    suggested_price: result.suggested_price,
    range: { min: result.range.min, max: result.range.max },
    motivation: result.motivation,
    selling_tips: result.selling_tips
  };
}

export async function evaluateClothing({ category, brand, condition, photo }) {
  const apiKey = process.env.PRICING_API_KEY;

  if (!apiKey) {
    const error = new Error('Chiave del servizio di valutazione non configurata.');
    error.code = 'MISSING_API_KEY';
    throw error;
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: process.env.PRICING_MODEL || DEFAULT_MODEL,
      max_tokens: 700,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: PROMPT },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Categoria: ${category}\nBrand: ${brand}\nStato: ${condition}\nValuta questo capo.`
            },
            {
              type: 'image_url',
              image_url: { url: `data:${photo.media_type};base64,${photo.data}` }
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`Chiamata al servizio di valutazione fallita (${response.status}).`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error('Nessun contenuto testuale nella risposta.');
  }

  return validateEvaluation(extractJson(text));
}
