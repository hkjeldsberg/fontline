// HEIC handling. Safari renders HEIC natively; everywhere else we lazy-load
// `heic-to` (only ~1.5 MB WASM, only when we need it).

async function safariCanRender(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img.naturalWidth > 0);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(false);
    };
    img.src = url;
  });
}

/** Returns a browser-friendly Blob (PNG) for any of JPG/PNG/HEIC/HEIF input. */
export async function toDisplayableBlob(file: File): Promise<Blob> {
  const name = file.name.toLowerCase();
  const looksHeic =
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    name.endsWith('.heic') ||
    name.endsWith('.heif');
  if (!looksHeic) return file;

  if (await safariCanRender(file)) return file;

  // Lazy: keep the ~1.5 MB wasm out of the main bundle.
  const mod = await import('heic-to').catch(() => null);
  if (!mod) {
    throw new Error('HEIC decoding library unavailable. Install `heic-to` or convert your file to PNG/JPG first.');
  }
  const { heicTo } = mod as { heicTo: (opts: { blob: Blob; type: string; quality?: number }) => Promise<Blob> };
  return heicTo({ blob: file, type: 'image/png', quality: 0.95 });
}

/** Decode any supported image file to ImageData on an offscreen canvas. */
export async function fileToImageData(file: File): Promise<ImageData> {
  const blob = await toDisplayableBlob(file);
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not acquire 2D canvas context.');
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}
