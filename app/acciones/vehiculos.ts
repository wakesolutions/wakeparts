"use server";

import { createClient } from "@/lib/supabase/server";
import type { ItemVehiculo, SugerenciaVehiculo } from "@/lib/vehiculos";

// Catálogo global de vehículos: lectura pública (RLS), sirve también sin sesión.

const POSICION: Record<string, string> = { L: "L", V: "V", H: "H" };

export async function listarMarcas(): Promise<ItemVehiculo[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("v_marcas").select("id, marca, modelos").order("marca");
  return (data ?? []).map((m) => ({ id: m.id, nombre: m.marca, detalle: `${m.modelos} modelos` }));
}

export async function listarModelos(idMarca: number): Promise<ItemVehiculo[]> {
  if (!Number.isInteger(idMarca)) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_modelos")
    .select("id, modelo, anio_desde, anio_hasta")
    .eq("id_marca", idMarca)
    .order("modelo");
  return (data ?? []).map((m) => ({
    id: m.id,
    nombre: m.modelo,
    detalle: m.anio_desde ? (m.anio_desde === m.anio_hasta ? `${m.anio_desde}` : `${m.anio_desde}–${m.anio_hasta}`) : "Sin años",
  }));
}

export async function listarAnios(idModelo: number): Promise<ItemVehiculo[]> {
  if (!Number.isInteger(idModelo)) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_modelos_anios")
    .select("id, anio, especificaciones")
    .eq("id_modelo", idModelo)
    .order("anio", { ascending: false });
  return (data ?? []).map((a) => ({
    id: a.id,
    nombre: String(a.anio),
    detalle: a.especificaciones === 1 ? "1 motor" : `${a.especificaciones} motores`,
  }));
}

/** Variantes (carrocería + motor) de un año: «SEDAN · 1.8 L · L4 · 1ZZ-FE». */
export async function listarMotores(idModeloAnio: number): Promise<ItemVehiculo[]> {
  if (!Number.isInteger(idModeloAnio)) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_especificaciones")
    .select("id, carroceria, motor_litros, motor_numero_cilindros, motor_posicion_cilindros, motor_numero")
    .eq("id_modelo_anio", idModeloAnio)
    .order("motor_cc")
    .order("carroceria");
  return (data ?? []).map((e) => ({
    id: e.id,
    nombre: [`${Number(e.motor_litros).toFixed(1)} L`, e.motor_numero].filter(Boolean).join(" · "),
    detalle: [e.carroceria, `${POSICION[e.motor_posicion_cilindros] ?? ""}${e.motor_numero_cilindros}`].join(" · "),
  }));
}

/** «corolla 05» → TOYOTA COROLLA 2005. Sin año devuelve modelos. */
export async function buscarVehiculos(texto: string): Promise<SugerenciaVehiculo[]> {
  const limpio = String(texto ?? "").slice(0, 80).trim();
  if (limpio.length < 2) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("buscar_vehiculos", { p_texto: limpio, p_limite: 12 });
  if (error) {
    console.error("[buscarVehiculos]", error);
    return [];
  }
  return (data ?? []) as SugerenciaVehiculo[];
}

/** Ubicación completa de un id del catálogo (marca › modelo › año › motor). */
export async function ubicarVehiculo(
  nivel: "marca" | "modelo" | "anio" | "especificacion",
  id: number,
): Promise<{ id_marca: number; marca: string; id_modelo: number | null; modelo: string | null; id_modelo_anio: number | null; anio: number | null; especificacion: string | null } | null> {
  if (!Number.isInteger(id)) return null;
  const supabase = await createClient();
  if (nivel === "marca") {
    const { data } = await supabase.from("v_marcas").select("id, marca").eq("id", id).maybeSingle();
    return data ? { id_marca: data.id, marca: data.marca, id_modelo: null, modelo: null, id_modelo_anio: null, anio: null, especificacion: null } : null;
  }
  if (nivel === "modelo") {
    const { data } = await supabase.from("v_modelos").select("id, id_marca, marca, modelo").eq("id", id).maybeSingle();
    return data ? { id_marca: data.id_marca, marca: data.marca, id_modelo: data.id, modelo: data.modelo, id_modelo_anio: null, anio: null, especificacion: null } : null;
  }
  if (nivel === "anio") {
    const { data } = await supabase.from("v_modelos_anios").select("id, id_marca, marca, id_modelo, modelo, anio").eq("id", id).maybeSingle();
    return data ? { id_marca: data.id_marca, marca: data.marca, id_modelo: data.id_modelo, modelo: data.modelo, id_modelo_anio: data.id, anio: data.anio, especificacion: null } : null;
  }
  const { data } = await supabase
    .from("v_especificaciones")
    .select("id, id_marca, marca, id_modelo, modelo, id_modelo_anio, anio, carroceria, motor_litros, motor_numero")
    .eq("id", id)
    .maybeSingle();
  return data
    ? {
        id_marca: data.id_marca,
        marca: data.marca,
        id_modelo: data.id_modelo,
        modelo: data.modelo,
        id_modelo_anio: data.id_modelo_anio,
        anio: data.anio,
        especificacion: [data.carroceria, `${Number(data.motor_litros).toFixed(1)} L`, data.motor_numero].filter(Boolean).join(" · "),
      }
    : null;
}
