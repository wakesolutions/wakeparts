import "server-only";
import { cache } from "react";
import { urlImagen } from "@/lib/imagenes";
import { createClient } from "@/lib/supabase/server";
import { SITIO_DEMO, demoBuscar, demoPortada, demoProducto } from "./sitio-demo";
import { sitioDeFila, type ProductoWeb, type SitioPublico } from "./sitio-web";

/**
 * Lectura del sitio público (/t/<slug>) por las funciones de 0013. Todo pasa
 * por RPC «security definer» que solo devuelven lo publicable. En desarrollo,
 * /t/demo usa datos en memoria (lib/sitio-demo.ts) para revisar la UI sin base.
 */

const esDemo = (slug: string) => slug === "demo" && process.env.NODE_ENV === "development";

const slugValido = (slug: string) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) && slug.length <= 40;

function producto(f: Record<string, unknown>): ProductoWeb {
  return {
    id: Number(f.id),
    codigo: String(f.codigo ?? ""),
    nombre: String(f.nombre ?? ""),
    marca: (f.marca as string | null) ?? null,
    categoria: String(f.categoria ?? ""),
    condicion: String(f.condicion ?? "nuevo"),
    precio: f.precio == null ? null : Number(f.precio),
    exento: Boolean(f.exento),
    imagen: f.imagen ? urlImagen(String(f.imagen)) : null,
    grupo: (f.grupo as string | null) ?? null,
    ajuste: (f.ajuste as string | null) ?? null,
  };
}

/** Sitio de un slug, o null si no existe o no está publicado (los miembros ven la vista previa). */
export const leerSitio = cache(async (slug: string): Promise<SitioPublico | null> => {
  if (esDemo(slug)) return SITIO_DEMO;
  if (!slugValido(slug)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sitio_publico", { p_slug: slug });
  if (error) {
    if (error.code !== "PGRST202") console.error("[leerSitio]", error);
    return null;
  }
  return data ? sitioDeFila(data as Record<string, unknown>) : null;
});

export type Portada = { destacados: ProductoWeb[]; categorias: { id: number; nombre: string; productos: number }[] };

export const leerPortada = cache(async (slug: string): Promise<Portada> => {
  if (esDemo(slug)) return demoPortada();
  const supabase = await createClient();
  const { data } = await supabase.rpc("portada_web", { p_slug: slug });
  const d = (data ?? {}) as { destacados?: Record<string, unknown>[]; categorias?: Portada["categorias"] };
  return { destacados: (d.destacados ?? []).map(producto), categorias: d.categorias ?? [] };
});

export type FiltrosCatalogo = {
  texto?: string;
  marca?: number;
  modelo?: number;
  anio?: number;
  motor?: number;
  categoria?: number;
};

export async function buscarCatalogo(slug: string, f: FiltrosCatalogo): Promise<ProductoWeb[]> {
  if (esDemo(slug)) return demoBuscar(f);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("buscar_catalogo_web", {
    p_slug: slug,
    p_texto: (f.texto ?? "").slice(0, 120),
    p_id_marca: f.marca ?? null,
    p_id_modelo: f.modelo ?? null,
    p_id_modelo_anio: f.anio ?? null,
    p_id_especificacion: f.motor ?? null,
    p_id_categoria: f.categoria ?? null,
    p_limite: 60,
  });
  if (error) {
    console.error("[buscarCatalogo]", error);
    return [];
  }
  return ((data ?? []) as Record<string, unknown>[]).map(producto);
}

export type FichaProducto = ProductoWeb & {
  descripcion: string | null;
  oem: string | null;
  numeroParte: string | null;
  unidad: string;
  garantiaDias: number | null;
  idCategoria: number;
  imagenes: { grande: string; miniatura: string }[];
  vehiculos: string[];
};

export const leerProducto = cache(async (slug: string, id: number): Promise<FichaProducto | null> => {
  if (esDemo(slug)) return demoProducto(id);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("producto_web", { p_slug: slug, p_producto: id });
  if (!data) return null;
  const f = data as Record<string, unknown>;
  const imagenes = ((f.imagenes ?? []) as { ruta: string; miniatura: string | null }[]).map((i) => ({
    grande: urlImagen(i.ruta),
    miniatura: urlImagen(i.miniatura ?? i.ruta),
  }));
  return {
    ...producto({ ...f, imagen: null }),
    imagen: imagenes[0]?.miniatura ?? null,
    descripcion: (f.descripcion as string | null) ?? null,
    oem: (f.oem as string | null) ?? null,
    numeroParte: (f.numero_parte as string | null) ?? null,
    unidad: String(f.unidad ?? "unidad"),
    garantiaDias: f.garantia_dias == null ? null : Number(f.garantia_dias),
    idCategoria: Number(f.id_categoria),
    imagenes,
    vehiculos: (f.vehiculos ?? []) as string[],
  };
});

/** Slugs publicados, para el sitemap. */
export async function sitiosPublicados(): Promise<{ slug: string; nombre: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("sitios_publicados");
  return (data ?? []) as { slug: string; nombre: string }[];
}
