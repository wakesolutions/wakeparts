import "server-only";
import { timingSafeEqual } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Ciclo } from "@/lib/suscripcion";

/**
 * Escrituras de cobro (0024). Usan la llave secreta porque RLS no deja que
 * ningún usuario se active un plan: solo el servidor, después de que n1co
 * confirma el cobro. Nunca exponer este cliente ni importarlo en el navegador.
 */

let servicio: SupabaseClient | null = null;

export function clienteServicio(): SupabaseClient {
  if (servicio) return servicio;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const llave = process.env.SUPABASE_SECRET_KEY;
  if (!url || !llave) throw new Error("Falta SUPABASE_SECRET_KEY en el servidor.");
  servicio = createClient(url, llave, { auth: { persistSession: false, autoRefreshToken: false } });
  return servicio;
}

export type PlanCobro = {
  codigo: string;
  nombre: string;
  precio_mensual: number | null;
  precio_anual: number | null;
  n1co_plan_mensual: number | null;
  n1co_plan_anual: number | null;
  publico: boolean;
  solo_admins: boolean;
  activo: boolean;
};

export async function leerPlanCobro(codigo: string): Promise<PlanCobro | null> {
  const { data } = await clienteServicio()
    .from("planes")
    .select("codigo, nombre, precio_mensual, precio_anual, n1co_plan_mensual, n1co_plan_anual, publico, solo_admins, activo")
    .eq("codigo", codigo)
    .maybeSingle();
  return (data as PlanCobro | null) ?? null;
}

/** El plan de n1co manda: de su ID sale qué plan y ciclo se pagó (nunca del navegador). */
export async function planDesdeN1co(planId: number | undefined): Promise<{ plan: PlanCobro; ciclo: Ciclo } | null> {
  if (!planId) return null;
  const { data } = await clienteServicio()
    .from("planes")
    .select("codigo, nombre, precio_mensual, precio_anual, n1co_plan_mensual, n1co_plan_anual, publico, solo_admins, activo")
    .or(`n1co_plan_mensual.eq.${Math.trunc(planId)},n1co_plan_anual.eq.${Math.trunc(planId)}`)
    .maybeSingle();
  const plan = data as PlanCobro | null;
  if (!plan) return null;
  return { plan, ciclo: plan.n1co_plan_anual === planId ? "anual" : "mensual" };
}

export type FilaSuscripcion = {
  id_empresa: string;
  plan: string;
  estado: string;
  ciclo: Ciclo | null;
  n1co_suscripcion_id: string | null;
  periodo_fin: string | null;
  prueba_hasta: string | null;
  recordatorios: string[];
};

export async function leerSuscripcionEmpresa(idEmpresa: string): Promise<FilaSuscripcion | null> {
  const { data } = await clienteServicio()
    .from("empresas_planes")
    .select("id_empresa, plan, estado, ciclo, n1co_suscripcion_id, periodo_fin, prueba_hasta, recordatorios")
    .eq("id_empresa", idEmpresa)
    .maybeSingle();
  return (data as FilaSuscripcion | null) ?? null;
}

export async function empresaPorSuscripcion(n1coId: string): Promise<string | null> {
  const { data } = await clienteServicio()
    .from("empresas_planes")
    .select("id_empresa")
    .eq("n1co_suscripcion_id", n1coId)
    .maybeSingle();
  return (data?.id_empresa as string | undefined) ?? null;
}

/** Pago confirmado por n1co: la empresa queda en el plan pagado. */
export async function activarSuscripcion(e: {
  idEmpresa: string;
  plan: string;
  ciclo: Ciclo;
  n1coId: string;
  periodoFin: string | null;
}) {
  const respaldo = new Date();
  respaldo.setMonth(respaldo.getMonth() + (e.ciclo === "anual" ? 12 : 1));
  const { error } = await clienteServicio()
    .from("empresas_planes")
    .upsert(
      {
        id_empresa: e.idEmpresa,
        plan: e.plan,
        estado: "activa",
        ciclo: e.ciclo,
        n1co_suscripcion_id: e.n1coId,
        periodo_fin: e.periodoFin ?? respaldo.toISOString(),
        cancelada_en: null,
        recordatorios: [],
        asignado_en: new Date().toISOString(),
        asignado_por: null,
        actualizado_en: new Date().toISOString(),
      },
      { onConflict: "id_empresa" },
    );
  if (error) throw new Error(`No se pudo activar la suscripción: ${error.code}`);
}

/** Cambio de estado (vencida, cancelada) conservando el plan hasta fin de periodo. */
export async function cambiarEstadoSuscripcion(
  idEmpresa: string,
  estado: "activa" | "vencida" | "cancelada" | "gratis",
  extra: { periodoFin?: string | null; plan?: string; limpiarN1co?: boolean } = {},
) {
  const cambios: Record<string, unknown> = { estado, actualizado_en: new Date().toISOString() };
  if (extra.periodoFin !== undefined && extra.periodoFin !== null) cambios.periodo_fin = extra.periodoFin;
  if (estado === "cancelada") cambios.cancelada_en = new Date().toISOString();
  if (extra.plan) cambios.plan = extra.plan;
  if (extra.limpiarN1co) cambios.n1co_suscripcion_id = null;
  const { error } = await clienteServicio().from("empresas_planes").update(cambios).eq("id_empresa", idEmpresa);
  if (error) throw new Error(`No se pudo actualizar la suscripción: ${error.code}`);
}

export async function anotarRecordatorio(idEmpresa: string, recordatorios: string[]) {
  await clienteServicio()
    .from("empresas_planes")
    .update({ recordatorios: recordatorios.slice(-40) })
    .eq("id_empresa", idEmpresa);
}

/**
 * Bitácora de cobros. `clave` la hace idempotente (un webhook repetido no se
 * procesa dos veces): devuelve false si ya existía. Nunca guardar datos de tarjeta.
 */
export async function registrarEventoSuscripcion(e: {
  idEmpresa: string | null;
  origen: "checkout" | "webhook" | "cron" | "admin" | "cancelacion" | "sincronizacion";
  tipo: string;
  n1coId?: string | null;
  plan?: string | null;
  ciclo?: Ciclo | null;
  monto?: number | null;
  mensaje?: string | null;
  clave?: string | null;
  datos?: Record<string, unknown> | null;
}): Promise<boolean> {
  const { error } = await clienteServicio()
    .from("suscripciones_eventos")
    .insert({
      id_empresa: e.idEmpresa,
      origen: e.origen,
      tipo: e.tipo.slice(0, 80),
      n1co_suscripcion_id: e.n1coId ?? null,
      plan: e.plan ?? null,
      ciclo: e.ciclo ?? null,
      monto: e.monto ?? null,
      mensaje: e.mensaje?.slice(0, 1000) ?? null,
      clave: e.clave?.slice(0, 300) ?? null,
      datos: e.datos ?? null,
    });
  if (error?.code === "23505") return false;
  if (error) console.error("[suscripcion] evento", error.code);
  return true;
}

/** Dueño (correo y nombre) de una empresa, para avisos de cobro. */
export async function duenoDeEmpresa(idEmpresa: string) {
  const { data } = await clienteServicio()
    .from("empresas_usuarios")
    .select("usuarios(correo, nombre), empresas(nombre)")
    .eq("id_empresa", idEmpresa)
    .eq("rol", "dueno")
    .eq("activo", true)
    .order("creado_en")
    .limit(1)
    .maybeSingle();
  const fila = data as unknown as { usuarios: { correo: string; nombre: string | null } | null; empresas: { nombre: string } | null } | null;
  if (!fila?.usuarios?.correo) return null;
  return { correo: fila.usuarios.correo, nombre: fila.usuarios.nombre ?? "", empresa: fila.empresas?.nombre ?? "" };
}

/** Comparación en tiempo constante para secretos (cron, webhook). */
export function mismoSecreto(recibido: string | null | undefined, esperado: string | undefined) {
  if (!recibido || !esperado) return false;
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
