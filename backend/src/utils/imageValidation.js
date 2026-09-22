const MAX_DECODED_BYTES = 8 * 1024 * 1024;

const MAGIC_BYTES = {
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  'image/png': [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  'image/webp': [
    // RIFF....WEBP: controlliamo "RIFF" (0-3) e "WEBP" (8-11)
    [0x52, 0x49, 0x46, 0x46]
  ]
};

function matchesSignature(buffer, signature) {
  if (buffer.length < signature.length) {
    return false;
  }

  return signature.every((byte, index) => buffer[index] === byte);
}

function isValidWebp(buffer) {
  return (
    matchesSignature(buffer, MAGIC_BYTES['image/webp'][0]) &&
    buffer.length >= 12 &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  );
}

// Decodifica il base64 e verifica che il risultato sia davvero un'immagine
// del tipo dichiarato (magic bytes) e di dimensione ragionevole.
// Buffer.from(..., 'base64') non fallisce mai su input sporco, quindi il
// controllo va fatto sul contenuto decodificato, non sulla stringa in ingresso.
export function decodeAndValidateImage(base64Data, mediaType) {
  let buffer;

  try {
    buffer = Buffer.from(base64Data, 'base64');
  } catch {
    return { valid: false, reason: 'Il campo photo.data non è base64 valido.' };
  }

  if (buffer.length === 0) {
    return { valid: false, reason: 'La foto decodificata è vuota.' };
  }

  if (buffer.length > MAX_DECODED_BYTES) {
    return { valid: false, reason: 'La foto supera la dimensione massima consentita (8MB).' };
  }

  const isValidSignature =
    mediaType === 'image/webp' ? isValidWebp(buffer) : matchesSignature(buffer, MAGIC_BYTES[mediaType]?.[0] ?? []);

  if (!isValidSignature) {
    return { valid: false, reason: 'Il contenuto della foto non corrisponde al media_type dichiarato.' };
  }

  return { valid: true, buffer };
}
