"use server";

import type { PostgrestError } from "@supabase/supabase-js";
import type {
  Asiento,
  CuentaBreve,
  DiaContable,
  FilaBalanza,
  LineaAsiento,
  Mayor,
  NuevoAsiento,
  Periodo,
} from "@/lib/contabilidad";
import { obtenerSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import type { Resultado } from "@/lib/ventas";

// Contabilidad (0022). La autoridad son RLS y las funciones de la base (dueño/admin);
// aquí se valida forma y se traducen errores.

const esUuid = (v: unknown): v is string =>
  typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const esId = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v > 0;
const esFecha = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const dinero = (v: unknown) => Math.round(Number(v) * 100) / 100;

function mensaje(error: PostgrestError, porDefecto: string) {
  if (error.code === "PGRST202" || error.code === "42P01") return "Falta ejecutar la migración 0022 en la base.";
  if (error.code === "P0001") return error.message;
  if (error.code === "42501") return "No tenés permiso para esta acción.";
  console.error("[contabilidad]", error);
  return porDefecto;
}

type FilaAsiento = Omit<Asiento, "lineas"> & { total: number };

async function conLineas(supabase: Awaited<ReturnType<typeof createClient>>, filas: FilaAsiento[]): Promise<Asiento[]> {
  if (!filas.length) return [];
  const { data } = await supabase
    .from("v_asientos_lineas")
    .select("id, id_asiento, id_cuenta, codigo, cuenta, debe, haber, descripcion, orden")
    .in("id_asiento", filas.map((a) => a.id))
    .order("orden");
  const lineas = (data ?? []) as (LineaAsiento & { id_asiento: string })[];
  return filas.map(({ total: _total, ...a }) => {
    void _total;
    return {
      ...a,
      lineas: lineas
        .filter((l) => l.id_asiento === a.id)
        .map(({ id_asiento: _x, ...l }) => {
          void _x;
          return { ...l, debe: Number(l.debe), haber: Number(l.haber) };
        }),
    };
  });
}

const COLUMNAS_ASIENTO = "id, numero, fecha, concepto, origen, referencia, total, es_reversa, revertido, registro";

/** El libro de un día: todos sus asientos con líneas y el cuadre. */
export async function diario(fecha: string): Promise<DiaContable | null> {
  const sesion = await obtenerSesion();
  if (!sesion?.empresa || !esFecha(fecha)) return null;
  const supabase = await createClient();
  const [{ data, error }, { data: cerrado }] = await Promise.all([
    supabase.from("v_asientos").select(COLUMNAS_ASIENTO).eq("id_empresa", sesion.empresa.id).eq("fecha", fecha).order("numero"),
    supabase.from("periodos_cerrados").select("mes").eq("id_empresa", sesion.empresa.id).eq("mes", `${fecha.slice(0, 7)}-01`).maybeSingle(),
  ]);
  if (error) return null;
  const asientos = await conLineas(supabase, (data ?? []) as FilaAsiento[]);
  const debe = asientos.flatMap((a) => a.lineas).reduce((s, l) => s + l.debe, 0);
  const haber = asientos.flatMap((a) => a.lineas).reduce((s, l) => s + l.haber, 0);
  return { fecha, asientos, debe: dinero(debe), haber: dinero(haber), cerrado: Boolean(cerrado) };
}

export async function leerAsiento(id: string): Promise<Asiento | null> {
  if (!esUuid(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("v_asientos").select(COLUMNAS_ASIENTO).eq("id", id).maybeSingle();
  if (!data) return null;
  return (await conLineas(supabase, [data as FilaAsiento]))[0];
}

/** Cuentas de detalle activas, para elegir en un asiento o en el mayor. */
export async function cuentasDetalle(): Promise<CuentaBreve[]> {
  const sesion = await obtenerSesion();
  if (!sesion?.empresa) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_cuentas_contables")
    .select("id, codigo, nombre, tipo")
    .eq("id_empresa", sesion.empresa.id)
    .eq("activo", true)
    .eq("es_grupo", false)
    .order("codigo");
  return (data ?? []) as CuentaBreve[];
}

export async function crearAsiento(a: NuevoAsiento): Promise<Resultado<{ id: string; numero: number }>> {
  const sesion = await obtenerSesion();
  if (!sesion?.empresa) return { ok: false, error: "No hay una empresa activa." };
  if (!esFecha(a?.fecha)) return { ok: false, error: "Revisá la fecha." };
  const concepto = String(a.concepto ?? "").trim().slice(0, 300);
  if (!concepto) return { ok: false, error: "Escribí el concepto del asiento." };
  if (!Array.isArray(a.lineas) || a.lineas.length < 2 || a.lineas.length > 200) return { ok: false, error: "Un asiento lleva al menos dos líneas." };
  const lineas = [];
  for (const l of a.lineas) {
    if (!esId(l.id_cuenta)) return { ok: false, error: "Elegí la cuenta de cada línea." };
    lineas.push({ id_cuenta: l.id_cuenta, debe: dinero(l.debe) || 0, haber: dinero(l.haber) || 0, descripcion: l.descripcion?.trim().slice(0, 200) || null });
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crear_asiento", {
    p_empresa: sesion.empresa.id,
    p_fecha: a.fecha,
    p_concepto: concepto,
    p_lineas: lineas,
  });
  if (error || !data) return { ok: false, error: error ? mensaje(error, "No se pudo guardar el asiento.") : "No se pudo guardar el asiento." };
  const { data: n } = await supabase.from("asientos").select("numero").eq("id", data).single();
  return { ok: true, id: data as string, numero: Number(n?.numero ?? 0) };
}

export async function revertirAsiento(id: string, motivo: string): Promise<Resultado> {
  if (!esUuid(id)) return { ok: false, error: "Asiento no válido." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("revertir_asiento", { p_asiento: id, p_motivo: String(motivo ?? "").slice(0, 200) });
  return error ? { ok: false, error: mensaje(error, "No se pudo revertir.") } : { ok: true };
}

export async function balanza(desde: string, hasta: string): Promise<FilaBalanza[] | null> {
  const sesion = await obtenerSesion();
  if (!sesion?.empresa || !esFecha(desde) || !esFecha(hasta)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("balanza", { p_empresa: sesion.empresa.id, p_desde: desde, p_hasta: hasta });
  if (error) return null;
  return ((data ?? []) as FilaBalanza[]).map((f) => ({
    ...f,
    id_padre: f.id_padre === null ? null : Number(f.id_padre),
    id: Number(f.id),
    saldo_inicial: Number(f.saldo_inicial),
    debe: Number(f.debe),
    haber: Number(f.haber),
    saldo_final: Number(f.saldo_final),
  }));
}

export async function mayor(idCuenta: number, desde: string, hasta: string): Promise<Mayor | null> {
  const sesion = await obtenerSesion();
  if (!sesion?.empresa || !esId(idCuenta) || !esFecha(desde) || !esFecha(hasta)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mayor", { p_empresa: sesion.empresa.id, p_cuenta: idCuenta, p_desde: desde, p_hasta: hasta });
  if (error || !data) return null;
  const m = data as Mayor;
  return {
    saldo_inicial: Number(m.saldo_inicial),
    movimientos: m.movimientos.map((x) => ({ ...x, debe: Number(x.debe), haber: Number(x.haber), saldo: Number(x.saldo) })),
  };
}

/** Los últimos 13 meses: cuántos asientos y si están cerrados. */
export async function periodos(): Promise<Periodo[]> {
  const sesion = await obtenerSesion();
  if (!sesion?.empresa) return [];
  const supabase = await createClient();
  const desde = new Date();
  desde.setMonth(desde.getMonth() - 12, 1);
  const inicio = desde.toISOString().slice(0, 8) + "01";
  const [{ data: asientos }, { data: cerrados }] = await Promise.all([
    supabase.from("v_asientos").select("fecha, total").eq("id_empresa", sesion.empresa.id).gte("fecha", inicio).limit(20000),
    supabase.from("periodos_cerrados").select("mes").eq("id_empresa", sesion.empresa.id),
  ]);
  const cerradosSet = new Set((cerrados ?? []).map((c) => String(c.mes).slice(0, 7)));
  const meses: Periodo[] = [];
  const d = new Date(desde);
  for (let i = 0; i < 13; i++) {
    const mes = d.toISOString().slice(0, 7);
    const delMes = (asientos ?? []).filter((a) => String(a.fecha).startsWith(mes));
    meses.push({ mes, asientos: delMes.length, debe: dinero(delMes.reduce((s, a) => s + Number(a.total), 0)), cerrado: cerradosSet.has(mes) });
    d.setMonth(d.getMonth() + 1);
  }
  return meses.reverse();
}

export async function cerrarPeriodo(mes: string): Promise<Resultado> {
  const sesion = await obtenerSesion();
  if (!sesion?.empresa || !/^\d{4}-\d{2}$/.test(mes)) return { ok: false, error: "Mes no válido." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("cerrar_periodo", { p_empresa: sesion.empresa.id, p_mes: `${mes}-01` });
  return error ? { ok: false, error: mensaje(error, "No se pudo cerrar el mes.") } : { ok: true };
}

export async function reabrirPeriodo(mes: string): Promise<Resultado> {
  const sesion = await obtenerSesion();
  if (!sesion?.empresa || !/^\d{4}-\d{2}$/.test(mes)) return { ok: false, error: "Mes no válido." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("reabrir_periodo", { p_empresa: sesion.empresa.id, p_mes: `${mes}-01` });
  return error ? { ok: false, error: mensaje(error, "No se pudo reabrir el mes.") } : { ok: true };
}

export async function contabilizarPendientes(): Promise<Resultado<{ asientos: number }>> {
  const sesion = await obtenerSesion();
  if (!sesion?.empresa) return { ok: false, error: "No hay una empresa activa." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("contabilizar_pendientes", { p_empresa: sesion.empresa.id });
  return error ? { ok: false, error: mensaje(error, "No se pudo contabilizar.") } : { ok: true, asientos: Number(data ?? 0) };
}

export async function aperturaInventario(fecha: string): Promise<Resultado<{ id: string }>> {
  const sesion = await obtenerSesion();
  if (!sesion?.empresa || !esFecha(fecha)) return { ok: false, error: "Revisá la fecha." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("asiento_apertura_inventario", { p_empresa: sesion.empresa.id, p_fecha: fecha });
  if (error || !data) return { ok: false, error: error ? mensaje(error, "No se pudo registrar la apertura.") : "No se pudo registrar la apertura." };
  return { ok: true, id: data as string };
}
