"use server";

import { existeReporte, obtenerReporte } from "@/lib/reportes";
import type { DatosReporte } from "@/lib/reportes/tipos";
import { obtenerSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import type { Resultado } from "@/lib/ventas";

const esFecha = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** Arma un reporte registrado en lib/reportes para la empresa activa. */
export async function leerReporte(id: string, desde: string, hasta: string): Promise<Resultado<{ datos: DatosReporte }>> {
  if (!existeReporte(id)) return { ok: false, error: "Reporte desconocido." };
  if (!esFecha(desde) || !esFecha(hasta)) return { ok: false, error: "Fechas no válidas." };
  const sesion = await obtenerSesion();
  if (!sesion?.empresa) return { ok: false, error: "No hay una empresa activa." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(obtenerReporte(id).funcion, {
    p_empresa: sesion.empresa.id,
    p_desde: desde,
    p_hasta: hasta,
  });
  if (error || !data) {
    if (error?.code === "PGRST202") return { ok: false, error: "Falta ejecutar la migración 0009 en la base." };
    if (error?.code === "22023" || error?.code === "42501") return { ok: false, error: error.message };
    console.error("[leerReporte]", error);
    return { ok: false, error: "No se pudo armar el reporte. Intentá de nuevo." };
  }
  return { ok: true, datos: data as DatosReporte };
}
