"use server";

import { randomUUID } from "node:crypto";
import { BUCKET_EMPRESAS } from "@/lib/identidad";
import { urlImagen } from "@/lib/imagenes";
import { obtenerSesion } from "@/lib/sesion";
import { errorSlug, MAX_FOTOS, normalizarSitio, sugerirSlug, type ConfigSitio } from "@/lib/sitio-web";
import { createClient } from "@/lib/supabase/server";

type Resultado<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const FALTA_MIGRACION = "Falta ejecutar la migración 0013 en la base.";
const TIPOS = new Set(["image/webp", "image/jpeg", "image/png"]);

function sinMigracion(error: { code?: string; message?: string } | null) {
  return ["42703", "PGRST204", "PGRST202", "42P01"].includes(error?.code ?? "") || /does not exist/i.test(error?.message ?? "");
}

async function empresaEditable() {
  const sesion = await obtenerSesion();
  if (!sesion?.empresa || !["dueno", "admin"].includes(sesion.rol ?? "")) return null;
  return sesion.empresa;
}

export type EstadoSitio = { slug: string | null; sugerencia: string; publicado: boolean; config: ConfigSitio };

/** Configuración del sitio de la empresa activa. */
export async function leerSitioEditor(): Promise<Resultado<{ sitio: EstadoSitio }>> {
  const sesion = await obtenerSesion();
  if (!sesion?.empresa) return { ok: false, error: "No hay una empresa activa." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("empresas").select("*").eq("id", sesion.empresa.id).maybeSingle();
  if (error || !data) return { ok: false, error: "No se pudo leer el sitio." };
  const f = data as Record<string, unknown>;
  if (!("sitio" in f)) return { ok: false, error: FALTA_MIGRACION };
  return {
    ok: true,
    sitio: {
      slug: (f.slug as string | null) ?? null,
      sugerencia: sugerirSlug(String(f.nombre)),
      publicado: Boolean(f.sitio_publicado),
      config: normalizarSitio(f.sitio),
    },
  };
}

/**
 * Guarda dirección, publicación y/o configuración. La configuración se mezcla
 * con la guardada (cada pestaña manda solo lo suyo) y se normaliza.
 */
export async function guardarSitio(cambio: {
  slug?: string;
  publicado?: boolean;
  config?: Partial<ConfigSitio>;
}): Promise<Resultado<{ sitio: EstadoSitio }>> {
  const empresa = await empresaEditable();
  if (!empresa) return { ok: false, error: "Solo el dueño o un administrador pueden editar el sitio." };

  const actual = await leerSitioEditor();
  if (!actual.ok) return actual;
  const datos: Record<string, unknown> = {};

  if (cambio.slug !== undefined) {
    const slug = cambio.slug.trim().toLowerCase();
    const problema = errorSlug(slug);
    if (problema) return { ok: false, error: problema };
    datos.slug = slug;
  }
  if (cambio.publicado !== undefined) {
    if (cambio.publicado && !(datos.slug ?? actual.sitio.slug)) {
      return { ok: false, error: "Elegí la dirección del sitio antes de publicarlo." };
    }
    datos.sitio_publicado = cambio.publicado;
  }
  if (cambio.config) datos.sitio = normalizarSitio({ ...actual.sitio.config, ...cambio.config });

  const supabase = await createClient();
  const { error } = await supabase.from("empresas").update(datos).eq("id", empresa.id);
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Esa dirección ya la usa otro taller. Probá con otra." };
    console.error("[guardarSitio]", error);
    return { ok: false, error: sinMigracion(error) ? FALTA_MIGRACION : "No se pudo guardar el sitio." };
  }
  return leerSitioEditor();
}

/** Foto para «Nosotros» (ya reducida a WebP en el navegador). Se agrega al sitio al subirla. */
export async function subirFotoSitio(datos: FormData): Promise<Resultado<{ sitio: EstadoSitio }>> {
  const empresa = await empresaEditable();
  if (!empresa) return { ok: false, error: "Solo el dueño o un administrador pueden editar el sitio." };
  const archivo = datos.get("archivo");
  if (!(archivo instanceof File) || !TIPOS.has(archivo.type) || archivo.size === 0 || archivo.size > 8 * 1024 * 1024) {
    return { ok: false, error: "La foto debe ser JPG, PNG o WebP de menos de 8 MB." };
  }
  const actual = await leerSitioEditor();
  if (!actual.ok) return actual;
  if (actual.sitio.config.fotos.length >= MAX_FOTOS) return { ok: false, error: `Hasta ${MAX_FOTOS} fotos. Quitá una primero.` };

  const ruta = `${empresa.id}/sitio/${randomUUID()}.${archivo.type.split("/")[1].replace("jpeg", "jpg")}`;
  const supabase = await createClient();
  const subida = await supabase.storage
    .from(BUCKET_EMPRESAS)
    .upload(ruta, archivo, { cacheControl: "31536000", upsert: false, contentType: archivo.type });
  if (subida.error) {
    console.error("[subirFotoSitio]", subida.error);
    return { ok: false, error: "No se pudo subir la foto. Intentá de nuevo." };
  }
  const r = await guardarSitio({ config: { fotos: [...actual.sitio.config.fotos, ruta] } });
  if (!r.ok) await supabase.storage.from(BUCKET_EMPRESAS).remove([ruta]);
  return r;
}

export async function quitarFotoSitio(ruta: string): Promise<Resultado<{ sitio: EstadoSitio }>> {
  const empresa = await empresaEditable();
  if (!empresa) return { ok: false, error: "Solo el dueño o un administrador pueden editar el sitio." };
  const actual = await leerSitioEditor();
  if (!actual.ok) return actual;
  if (!actual.sitio.config.fotos.includes(ruta)) return { ok: false, error: "La foto no existe." };
  const r = await guardarSitio({ config: { fotos: actual.sitio.config.fotos.filter((f) => f !== ruta) } });
  if (r.ok) {
    const supabase = await createClient();
    await supabase.storage.from(BUCKET_EMPRESAS).remove([ruta]);
  }
  return r;
}

export type ProductoElegible = { id: number; nombre: string; codigo: string; imagen: string | null; publicable: boolean };

/** Productos para elegir como destacados (búsqueda del mostrador). */
export async function buscarParaDestacar(texto: string): Promise<ProductoElegible[]> {
  const sesion = await obtenerSesion();
  if (!sesion?.empresa) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("buscar_productos", {
    p_empresa: sesion.empresa.id,
    p_texto: texto.slice(0, 120),
    p_limite: 20,
  });
  return ((data ?? []) as Record<string, unknown>[]).map((p) => ({
    id: Number(p.id),
    nombre: String(p.nombre),
    codigo: String(p.codigo),
    imagen: p.imagen ? urlImagen(String(p.imagen)) : null,
    publicable: Boolean(p.disponible),
  }));
}

/** Datos de los productos destacados (en el orden elegido). */
export async function leerDestacados(ids: number[]): Promise<ProductoElegible[]> {
  const sesion = await obtenerSesion();
  if (!sesion?.empresa || !ids.length) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("productos")
    .select("id, nombre, codigo, visible_catalogo, activo, controla_inventario, existencia")
    .in("id", ids.slice(0, 20));
  const filas = (data ?? []) as Record<string, unknown>[];
  return ids
    .map((id) => filas.find((f) => Number(f.id) === id))
    .filter(Boolean)
    .map((f) => ({
      id: Number(f!.id),
      nombre: String(f!.nombre),
      codigo: String(f!.codigo),
      imagen: null,
      publicable: Boolean(f!.visible_catalogo && f!.activo && (!f!.controla_inventario || Number(f!.existencia) > 0)),
    }));
}

// ------------------------------------------------------------- pedidos web --

export type PedidoWeb = {
  id: string;
  numero: number;
  creado_en: string;
  cliente_nombre: string;
  cliente_telefono: string;
  cliente_correo: string | null;
  mensaje: string | null;
  vehiculo: string | null;
  estado: "nuevo" | "atendido" | "descartado";
  id_carrito: string | null;
  atendido_por: string | null;
  total_estimado: number;
  lineas: { id: number; codigo: string | null; descripcion: string; cantidad: number; precio: number; exento: boolean }[];
};

export async function leerPedidoWeb(id: string): Promise<PedidoWeb | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const supabase = await createClient();
  const [{ data: p }, { data: lineas }] = await Promise.all([
    supabase.from("v_pedidos_web").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("pedidos_web_lineas")
      .select("id, codigo, descripcion, cantidad, precio, exento")
      .eq("id_pedido", id)
      .order("orden"),
  ]);
  if (!p) return null;
  return {
    ...(p as PedidoWeb),
    total_estimado: Number(p.total_estimado),
    lineas: ((lineas ?? []) as PedidoWeb["lineas"]).map((l) => ({ ...l, cantidad: Number(l.cantidad), precio: Number(l.precio) })),
  };
}

/** Pedido → carrito del mostrador (o el mismo carrito si ya se atendió y sigue abierto). */
export async function atenderPedidoWeb(id: string): Promise<Resultado<{ carrito: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("atender_pedido_web", { p_pedido: id });
  if (error || !data) {
    console.error("[atenderPedidoWeb]", error);
    return { ok: false, error: error?.code === "P0001" ? error.message : "No se pudo pasar el pedido al mostrador." };
  }
  return { ok: true, carrito: data as string };
}

export async function cambiarEstadoPedidoWeb(id: string, estado: "nuevo" | "descartado"): Promise<Resultado> {
  if (estado !== "nuevo" && estado !== "descartado") return { ok: false, error: "Estado no válido." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("pedidos_web").update({ estado }).eq("id", id).select("id");
  if (error || !data?.length) return { ok: false, error: "No se pudo cambiar el pedido." };
  return { ok: true };
}

/** Cuántos pedidos esperan respuesta (para el aviso en Ventas). */
export async function contarPedidosNuevos(): Promise<number> {
  const sesion = await obtenerSesion();
  if (!sesion?.empresa) return 0;
  const supabase = await createClient();
  const { count } = await supabase
    .from("pedidos_web")
    .select("id", { count: "exact", head: true })
    .eq("id_empresa", sesion.empresa.id)
    .eq("estado", "nuevo");
  return count ?? 0;
}
