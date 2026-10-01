/**
 * Prepara una foto en el navegador antes de subirla: corrige la orientación,
 * la reduce y la convierte a WebP (grande 1600 px + miniatura 400 px). Así una
 * foto de celular de 5 MB queda en ~250 KB y la búsqueda carga miniaturas.
 */

export type FotoProcesada = { grande: File; miniatura: File; ancho: number; alto: number };

const TIPOS = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/heic", "image/heif"];

export function esImagen(archivo: File) {
  return TIPOS.includes(archivo.type) || /\.(jpe?g|png|webp|avif|heic|heif)$/i.test(archivo.name);
}

async function aWebp(bitmap: ImageBitmap, lado: number, calidad: number, nombre: string) {
  const escala = Math.min(1, lado / Math.max(bitmap.width, bitmap.height));
  const ancho = Math.round(bitmap.width * escala);
  const alto = Math.round(bitmap.height * escala);
  const lienzo = document.createElement("canvas");
  lienzo.width = ancho;
  lienzo.height = alto;
  const ctx = lienzo.getContext("2d");
  if (!ctx) throw new Error("Canvas no disponible");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, ancho, alto);
  const blob = await new Promise<Blob | null>((r) => lienzo.toBlob(r, "image/webp", calidad));
  // Safari viejo no exporta WebP: cae a JPEG.
  const final = blob?.type === "image/webp" ? blob : await new Promise<Blob | null>((r) => lienzo.toBlob(r, "image/jpeg", calidad));
  if (!final) throw new Error("No se pudo convertir la imagen");
  const ext = final.type === "image/webp" ? "webp" : "jpg";
  return { archivo: new File([final], `${nombre}.${ext}`, { type: final.type }), ancho, alto };
}

export async function procesarFoto(archivo: File): Promise<FotoProcesada> {
  const bitmap = await createImageBitmap(archivo, { imageOrientation: "from-image" });
  try {
    const grande = await aWebp(bitmap, 1600, 0.82, "foto");
    const miniatura = await aWebp(bitmap, 400, 0.76, "miniatura");
    return { grande: grande.archivo, miniatura: miniatura.archivo, ancho: grande.ancho, alto: grande.alto };
  } finally {
    bitmap.close();
  }
}

/**
 * Reduce una imagen de la empresa (logo o fondo) a WebP con lado mayor `lado`.
 * WebP conserva la transparencia del logo.
 */
export async function reducirImagen(archivo: File, lado: number, calidad = 0.86): Promise<File> {
  const bitmap = await createImageBitmap(archivo, { imageOrientation: "from-image" });
  try {
    return (await aWebp(bitmap, lado, calidad, "imagen")).archivo;
  } finally {
    bitmap.close();
  }
}
