/** URL pública de un archivo del bucket «productos» (Supabase Storage, público). */
export function urlImagen(ruta: string) {
  if (/^(https?:|data:|blob:)/.test(ruta)) return ruta;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/productos/${ruta}`;
}
