"use server";

import { cookies } from "next/headers";
import { CAMPOS_EMPRESA, CAMPOS_TALLER } from "@/lib/empresa";
import { COOKIE_PALETA, PALETAS, type PaletaId } from "@/lib/paletas";
import type { ResultadoGuardar, Valores } from "@/lib/recursos/tipos";
import { validarValores } from "@/lib/recursos/validar";
import { obtenerSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

async function recordarPaleta(paleta: PaletaId) {
  (await cookies()).set(COOKIE_PALETA, paleta, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}

export async function crearEmpresa(valores: Valores): Promise<ResultadoGuardar> {
  const validacion = validarValores(CAMPOS_EMPRESA, valores);
  if (!validacion.ok) {
    return { ok: false, error: "Revisá los campos marcados.", errores: validacion.errores };
  }
  const d = validacion.datos as Record<string, string | null>;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crear_empresa", {
    p_nombre: d.nombre,
    p_razon_social: d.razon_social,
    p_rtn: d.rtn,
    p_telefono: d.telefono,
    p_correo: d.correo,
    p_direccion: d.direccion,
    p_paleta: d.paleta,
  });

  if (error || !data) {
    console.error("[crearEmpresa]", error);
    return {
      ok: false,
      error:
        error?.code === "28000"
          ? "Tu sesión expiró. Volvé a entrar."
          : "No se pudo crear la empresa. Revisá los datos e intentá de nuevo.",
    };
  }

  await recordarPaleta((d.paleta as PaletaId) ?? "rojo-negro");
  return { ok: true, id: data as string };
}

export async function leerEmpresa() {
  const sesion = await obtenerSesion();
  if (!sesion?.empresa) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("empresas")
    // «*»: descuento_maximo_vendedor llega con la migración 0005.
    .select("*")
    .eq("id", sesion.empresa.id)
    .maybeSingle();
  return data as {
    nombre: string;
    razon_social: string | null;
    rtn: string | null;
    telefono: string | null;
    correo: string | null;
    direccion: string | null;
    paleta: string;
    creado_en: string;
    descuento_maximo_vendedor?: number;
  } | null;
}

export async function actualizarEmpresa(valores: Valores): Promise<ResultadoGuardar> {
  const sesion = await obtenerSesion();
  if (!sesion?.empresa) return { ok: false, error: "No hay una empresa activa." };
  if (!["dueno", "admin"].includes(sesion.rol ?? "")) {
    return { ok: false, error: "Solo el dueño o un administrador pueden editar el taller." };
  }

  const validacion = validarValores(CAMPOS_TALLER, valores);
  if (!validacion.ok) return { ok: false, error: "Revisá los campos marcados.", errores: validacion.errores };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("empresas")
    .update(validacion.datos)
    .eq("id", sesion.empresa.id)
    .select("id, paleta");
  if (error || !data?.length) {
    console.error("[actualizarEmpresa]", error);
    return { ok: false, error: "No se pudieron guardar los datos del taller." };
  }
  await recordarPaleta(data[0].paleta as PaletaId);
  return { ok: true, id: data[0].id as string };
}

export type ResultadoDemo =
  | { ok: true; productos: number; compatibilidades: number; clientes: number }
  | { ok: false; error: string };

/** Carga productos, compatibilidades y clientes de ejemplo en la empresa activa (migración 0007). */
export async function cargarDatosDemo(): Promise<ResultadoDemo> {
  const sesion = await obtenerSesion();
  if (!sesion?.empresa) return { ok: false, error: "No hay una empresa activa." };
  if (!["dueno", "admin"].includes(sesion.rol ?? "")) {
    return { ok: false, error: "Solo el dueño o un administrador pueden cargar datos de ejemplo." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cargar_datos_demo", { p_empresa: sesion.empresa.id });
  if (error || !data) {
    console.error("[cargarDatosDemo]", error);
    return {
      ok: false,
      error:
        error?.code === "PGRST202"
          ? "Falta ejecutar la migración 0007 en la base."
          : "No se pudieron cargar los datos de ejemplo. Intentá de nuevo.",
    };
  }
  return { ok: true, ...(data as { productos: number; compatibilidades: number; clientes: number }) };
}

export async function cambiarPaletaEmpresa(paleta: PaletaId) {
  if (!PALETAS.some((p) => p.id === paleta)) return { ok: false as const };
  const sesion = await obtenerSesion();
  if (!sesion?.empresa || !["dueno", "admin"].includes(sesion.rol ?? "")) {
    return { ok: false as const };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("empresas").update({ paleta }).eq("id", sesion.empresa.id);
  if (error) return { ok: false as const };

  await recordarPaleta(paleta);
  return { ok: true as const };
}
