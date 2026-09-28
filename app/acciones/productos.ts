"use server";

import { randomUUID } from "node:crypto";
import { obtenerSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import type { FilaCompat, NivelVehiculo } from "@/lib/vehiculos";

// Fotos y compatibilidad de productos. La autorización real es RLS
// (dueño/admin de la empresa del producto); aquí se valida forma y sesión.

type Resultado = { ok: true } | { ok: false; error: string };

const TIPOS = new Set(["image/webp", "image/jpeg", "image/png", "image/avif"]);
const MAX_BYTES = 5 * 1024 * 1024;
const NIVELES = new Set<NivelVehiculo>(["marca", "modelo", "anio", "especificacion"]);

function esId(v: unknown): v is number {
  return typeof v === "number" && Number.isSafeInteger(v) && v > 0;
}

async function puedeEditar() {
  const sesion = await obtenerSesion();
  if (!sesion?.empresa) return null;
  if (sesion.rol !== "dueno" && sesion.rol !== "admin") return null;
  return sesion.empresa.id;
}

// ------------------------------------------------------------------ fotos ---

export type ImagenProducto = {
  id: number;
  ruta: string;
  ruta_miniatura: string | null;
  ancho: number | null;
  alto: number | null;
  orden: number;
};

export async function leerImagenes(idProducto: number): Promise<ImagenProducto[]> {
  if (!esId(idProducto)) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("productos_imagenes")
    .select("id, ruta, ruta_miniatura, ancho, alto, orden")
    .eq("id_producto", idProducto)
    .order("orden")
    .order("id");
  return (data ?? []) as ImagenProducto[];
}

/**
 * Sube una foto ya procesada en el navegador (webp grande + miniatura).
 * FormData: producto, archivo, miniatura, ancho, alto.
 */
export async function subirImagen(datos: FormData): Promise<{ ok: true; imagen: ImagenProducto } | { ok: false; error: string }> {
  const empresa = await puedeEditar();
  if (!empresa) return { ok: false, error: "Solo el dueño o un administrador pueden subir fotos." };

  const idProducto = Number(datos.get("producto"));
  const archivo = datos.get("archivo");
  const miniatura = datos.get("miniatura");
  if (!esId(idProducto) || !(archivo instanceof File)) return { ok: false, error: "Datos incompletos." };
  for (const f of [archivo, miniatura]) {
    if (f instanceof File && (!TIPOS.has(f.type) || f.size > MAX_BYTES || f.size === 0)) {
      return { ok: false, error: "La imagen debe ser JPG, PNG o WebP de menos de 5 MB." };
    }
  }

  const supabase = await createClient();
  // RLS: solo devuelve el producto si es de la empresa del usuario.
  const { data: producto } = await supabase
    .from("productos")
    .select("id, id_empresa")
    .eq("id", idProducto)
    .eq("id_empresa", empresa)
    .maybeSingle();
  if (!producto) return { ok: false, error: "El producto no existe." };

  const base = `${empresa}/${idProducto}/${randomUUID()}`;
  const extension = archivo.type.split("/")[1].replace("jpeg", "jpg");
  const ruta = `${base}.${extension}`;
  const rutaMiniatura = miniatura instanceof File ? `${base}_m.${miniatura.type.split("/")[1].replace("jpeg", "jpg")}` : null;

  const bucket = supabase.storage.from("productos");
  const opciones = { cacheControl: "31536000", upsert: false };
  const subida = await bucket.upload(ruta, archivo, { ...opciones, contentType: archivo.type });
  if (subida.error) {
    console.error("[subirImagen]", subida.error);
    return { ok: false, error: "No se pudo subir la foto." };
  }
  if (rutaMiniatura && miniatura instanceof File) {
    const r = await bucket.upload(rutaMiniatura, miniatura, { ...opciones, contentType: miniatura.type });
    if (r.error) console.error("[subirImagen] miniatura", r.error);
  }

  const { data: ultima } = await supabase
    .from("productos_imagenes")
    .select("orden")
    .eq("id_producto", idProducto)
    .order("orden", { ascending: false })
    .limit(1)
    .maybeSingle();

  const ancho = Number(datos.get("ancho")) || null;
  const alto = Number(datos.get("alto")) || null;
  const { data, error } = await supabase
    .from("productos_imagenes")
    .insert({
      id_producto: idProducto,
      ruta,
      ruta_miniatura: rutaMiniatura,
      ancho,
      alto,
      orden: (ultima?.orden ?? -1) + 1,
    })
    .select("id, ruta, ruta_miniatura, ancho, alto, orden")
    .single();
  if (error || !data) {
    console.error("[subirImagen] registro", error);
    await bucket.remove([ruta, ...(rutaMiniatura ? [rutaMiniatura] : [])]);
    return { ok: false, error: "No se pudo guardar la foto." };
  }
  return { ok: true, imagen: data as ImagenProducto };
}

export async function eliminarImagen(id: number): Promise<Resultado> {
  if (!esId(id) || !(await puedeEditar())) return { ok: false, error: "No tenés permiso para eliminar fotos." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("productos_imagenes")
    .delete()
    .eq("id", id)
    .select("ruta, ruta_miniatura");
  if (error || !data?.length) return { ok: false, error: "No se pudo eliminar la foto." };
  const rutas = data.flatMap((d) => [d.ruta, d.ruta_miniatura]).filter(Boolean) as string[];
  const { error: errorStorage } = await supabase.storage.from("productos").remove(rutas);
  if (errorStorage) console.error("[eliminarImagen] storage", errorStorage);
  return { ok: true };
}

/** Nuevo orden de las fotos (la primera es la principal). */
export async function ordenarImagenes(idProducto: number, ids: number[]): Promise<Resultado> {
  if (!esId(idProducto) || !Array.isArray(ids) || !ids.every(esId) || ids.length > 50) {
    return { ok: false, error: "Orden no válido." };
  }
  if (!(await puedeEditar())) return { ok: false, error: "No tenés permiso." };
  const supabase = await createClient();
  const resultados = await Promise.all(
    ids.map((id, orden) =>
      supabase.from("productos_imagenes").update({ orden }).eq("id", id).eq("id_producto", idProducto),
    ),
  );
  return resultados.some((r) => r.error) ? { ok: false, error: "No se pudo ordenar." } : { ok: true };
}

// --------------------------------------------------------- compatibilidad ---

export async function leerCompatibilidades(idProducto: number): Promise<FilaCompat[]> {
  if (!esId(idProducto)) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_productos_compatibilidades")
    .select("id, nivel, id_marca, marca, id_modelo, modelo, id_modelo_anio, anio, id_especificacion, especificacion")
    .eq("id_producto", idProducto)
    .order("marca")
    .order("modelo", { nullsFirst: true })
    .order("anio", { nullsFirst: true })
    .limit(5000);
  return (data ?? []) as FilaCompat[];
}

export async function cambiarCompatibilidades(
  idProducto: number,
  nivel: NivelVehiculo,
  ids: number[],
  asignar: boolean,
): Promise<Resultado> {
  if (!esId(idProducto) || !NIVELES.has(nivel) || !Array.isArray(ids) || !ids.every(esId) || ids.length > 2000) {
    return { ok: false, error: "Datos no válidos." };
  }
  if (!(await puedeEditar())) return { ok: false, error: "Solo el dueño o un administrador pueden asignar vehículos." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("asignar_compatibilidades", {
    p_producto: idProducto,
    p_nivel: nivel,
    p_ids: ids,
    p_asignar: asignar,
  });
  if (error) {
    console.error("[cambiarCompatibilidades]", error);
    return { ok: false, error: error.code === "42501" ? "No tenés permiso." : "No se pudo guardar la compatibilidad." };
  }
  return { ok: true };
}

export async function copiarCompatibilidades(origen: number, destino: number): Promise<Resultado> {
  if (!esId(origen) || !esId(destino) || origen === destino) return { ok: false, error: "Elegí otro producto." };
  if (!(await puedeEditar())) return { ok: false, error: "No tenés permiso." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("copiar_compatibilidades", { p_origen: origen, p_destino: destino });
  if (error) {
    console.error("[copiarCompatibilidades]", error);
    return { ok: false, error: error.code === "P0001" ? error.message : "No se pudo copiar." };
  }
  return { ok: true };
}
