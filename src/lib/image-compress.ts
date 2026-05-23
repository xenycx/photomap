const MAX_DIMENSION = 2048;
const QUALITY = 0.8;

export async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const { width, height } = fit(bitmap.width, bitmap.height, MAX_DIMENSION);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0, width, height);
    return await encode(canvas, QUALITY);
  } finally {
    bitmap.close();
  }
}

function fit(
  w: number,
  h: number,
  max: number,
): { width: number; height: number } {
  if (w <= max && h <= max) return { width: w, height: h };
  const ratio = Math.min(max / w, max / h);
  return { width: Math.round(w * ratio), height: Math.round(h * ratio) };
}

function toBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function encode(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob> {
  for (const type of ["image/webp", "image/jpeg", "image/png"]) {
    const blob = await toBlob(canvas, type, quality);
    if (blob) return blob;
  }
  throw new Error("Image compression failed");
}
