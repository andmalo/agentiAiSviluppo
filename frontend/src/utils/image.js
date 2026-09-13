const MAX_DIMENSION = 1024;
const JPEG_QUALITY = 0.8;

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Impossibile leggere il file.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('File immagine non valido.'));
    img.src = src;
  });
}

// Ridimensiona (lato massimo 1024px) e comprime in JPEG lato client,
// così il payload verso il backend resta leggero.
export async function processImage(file) {
  const originalDataUrl = await readAsDataUrl(file);
  const img = await loadImage(originalDataUrl);

  let { width, height } = img;

  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    if (width > height) {
      height = Math.round((height * MAX_DIMENSION) / width);
      width = MAX_DIMENSION;
    } else {
      width = Math.round((width * MAX_DIMENSION) / height);
      height = MAX_DIMENSION;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(img, 0, 0, width, height);

  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  const base64 = dataUrl.split(',')[1];

  return { previewUrl: dataUrl, mediaType: 'image/jpeg', base64 };
}
