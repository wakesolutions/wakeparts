"use server";

import type { PostgrestError } from "@supabase/supabase-js";
import type { FilaImportacion, LineaEntrada, ModoCosto, ResultadoImportacion } from "@/lib/inventario";
import { obtenerSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import type { Resultado } from "@/lib/ventas";

// Entradas de inventario e importación de productos (0009). La autoridad son
// las funciones de la base (dueño/admin); aquí se valida forma y se traducen errores.

function mensaje(error: PostgrestError | null, porDefecto: string) {
  if (!error) return porDefecto;
  if (error.code === "PGRST202") return "Falta ejecutar la migración 0009 en la base.";
  if (["22023", "42501", "P0001", "P0002"].includes(error.code ?? "")) return error.message;
  if (error.code === "57014") return "La base tardó demasiado. Probá con menos filas.";
  console.error("[inventario]", error);
  return porDefecto;
}

const MODOS: ModoCosto[] = ["promedio", "ultimo", "mantener"];

export async function registrarEntrada(
  lineas: LineaEntrada[],
  referencia: string,
  modoCosto: ModoCosto,
): Promise<Resultado<{ productos: number; unidades: number; valor: number }>> {
  const sesion = await obtenerSesion();
  if (!sesion?.empresa) return { ok: false, error: "No hay una empresa activa." };
  if (!MODOS.includes(modoCosto)) return { ok: false, error: "Modo de costo no válido." };
  const limpias = (Array.isArray(lineas) ? lineas : []).slice(0, 300).map((l) => ({
    id_producto: Number(l.id_producto),
    cantidad: Number(l.cantidad),
    costo: l.costo === null || l.costo === undefined || String(l.costo) === "" ? null : Number(l.costo),
  }));
  if (!limpias.length) return { ok: false, error: "Agregá al menos un producto." };
  if (limpias.some((l) => !Number.isSafeInteger(l.id_producto) || !Number.isFinite(l.cantidad) || (l.costo !== null && !Number.isFinite(l.costo)))) {
    return { ok: false, error: "Revisá cantidades y costos." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("entrada_inventario", {
    p_empresa: sesion.empresa.id,
    p_lineas: limpias,
    p_referencia: String(referencia ?? "").slice(0, 120),
    p_modo_costo: modoCosto,
  });
  if (error || !data) return { ok: false, error: mensaje(error, "No se pudo cargar el inventario.") };
  const r = data as { productos: number; unidades: number; valor: number };
  return { ok: true, productos: Number(r.productos), unidades: Number(r.unidades), valor: Number(r.valor) };
}

export async function importarProductos(
  filas: FilaImportacion[],
  actualizar: boolean,
  probar: boolean,
): Promise<Resultado<{ resultado: ResultadoImportacion }>> {
  const sesion = await obtenerSesion();
  if (!sesion?.empresa) return { ok: false, error: "No hay una empresa activa." };
  if (!Array.isArray(filas) || !filas.length) return { ok: false, error: "El archivo no tiene filas." };
  if (filas.length > 500) return { ok: false, error: "Máximo 500 filas por envío." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("importar_productos", {
    p_empresa: sesion.empresa.id,
    p_filas: filas,
    p_actualizar: Boolean(actualizar),
    p_probar: Boolean(probar),
  });
  if (error || !data) return { ok: false, error: mensaje(error, "No se pudo importar.") };
  return { ok: true, resultado: data as ResultadoImportacion };
}
