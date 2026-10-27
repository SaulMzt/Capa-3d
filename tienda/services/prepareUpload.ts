const MAX_ORIGINAL = 5 * 1024 * 1024;
const MAX_TRANSFER = 4 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

export async function prepareUpload(file: File): Promise<File> {
  if (!ALLOWED.includes(file.type)) throw new Error('Usa PNG, JPEG o WebP.');
  if (file.size > MAX_ORIGINAL) throw new Error('Cada imagen debe pesar menos de 5 MB.');
  if (file.size <= MAX_TRANSFER) return file;

  const image = await createImageBitmap(file);
  try {
    for (const scale of [1, 0.85, 0.7, 0.55]) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.82));
      if (blob && blob.size <= MAX_TRANSFER) return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.webp', { type: 'image/webp' });
    }
  } finally { image.close(); }
  throw new Error('No se pudo reducir la imagen. Prueba con una más pequeña.');
}
