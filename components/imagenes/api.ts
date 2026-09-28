import { eliminarImagen, leerImagenes, ordenarImagenes, subirImagen, type ImagenProducto } from "@/app/acciones/productos";

export type { ImagenProducto };

export type ApiImagenes = {
  leer(idProducto: number): Promise<ImagenProducto[]>;
  subir(datos: FormData): Promise<{ ok: true; imagen: ImagenProducto } | { ok: false; error: string }>;
  eliminar(id: number): Promise<{ ok: true } | { ok: false; error: string }>;
  ordenar(idProducto: number, ids: number[]): Promise<{ ok: true } | { ok: false; error: string }>;
};

export const apiImagenes: ApiImagenes = {
  leer: leerImagenes,
  subir: subirImagen,
  eliminar: eliminarImagen,
  ordenar: ordenarImagenes,
};
