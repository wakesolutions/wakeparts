"use server";

import type { PostgrestError } from "@supabase/supabase-js";
import type { Arqueo, EstadoCaja, MovimientoCaja, ResumenTurno, Turno } from "@/lib/caja";
import { obtenerSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import type { Resultado } from "@/lib/ventas";

// Caja: turnos por punto de emisión. La autorización real está en la base
// (abrir_caja, movimiento_caja, cerrar_caja y RLS); aquí se valida forma.

const esUuid = (v: unknown): v is string =>
  typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

function mensaje(error: PostgrestError, porDefecto: string) {
  if (error.code === "P0001") return error.message;
  if (error.code === "42501") return "No tenés permiso para esta acción.";
  console.error("[caja]", error);
  return porDefecto;
}

const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));

function resumen(r: Record<string, unknown>): ResumenTurno {
  const formas = (r.formas as Record<string, unknown>[] | null) ?? [];
  return {
    fondo: Number(r.fondo ?? 0),
    formas: formas.map((f) => ({
      forma: f.forma as ResumenTurno["formas"][number]["forma"],
      ventas: Number(f.ventas ?? 0),
      abonos: Number(f.abonos ?? 0),
      devoluciones: Number(f.devoluciones ?? 0),
      cargos: Number(f.cargos ?? 0),
      neto: Number(f.neto ?? 0),
    })),
    entradas: Number(r.entradas ?? 0),
    salidas: Number(r.salidas ?? 0),
    esperado_efectivo: Number(r.esperado_efectivo ?? 0),
    total_cobrado: Number(r.total_cobrado ?? 0),
    facturas: Number(r.facturas ?? 0),
    abonos: Number(r.abonos ?? 0),
    notas: Number(r.notas ?? 0),
    movimientos: Number(r.movimientos ?? 0),
    credito: Number(r.credito ?? 0),
    anuladas: Number(r.anuladas ?? 0),
  };
}

/** Un turno completo: datos, resumen (congelado si está cerrado) y movimientos. */
export async function leerTurno(id: string): Promise<Turno | null> {
  if (!esUuid(id)) return null;
  const supabase = await createClient();
  const [{ data: t }, { data: crudo }, { data: movs }] = await Promise.all([
    supabase
      .from("v_cajas_turnos")
      .select("id, id_empresa, numero, punto, estado, abierta_en, abierta_por, cerrada_en, cerrada_por, fondo_inicial, efectivo_contado, diferencia, notas, propio")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("cajas_turnos").select("resumen, arqueo").eq("id", id).maybeSingle(),
    supabase
      .from("v_caja_movimientos")
      .select("id, fecha, tipo, referencia, detalle, forma_pago, monto, en_caja, estado, usuario")
      .eq("id_turno", id)
      .order("fecha", { ascending: false })
      .limit(500),
  ]);
  if (!t) return null;
  const { data: e } = await supabase.from("empresas").select("nombre").eq("id", t.id_empresa).maybeSingle();
  let r = crudo?.resumen as Record<string, unknown> | null;
  if (!r) {
    const { data } = await supabase.rpc("resumen_turno", { p_turno: id });
    r = (data as Record<string, unknown> | null) ?? {};
  }
  return {
    ...(t as unknown as Turno),
    empresa: e?.nombre ?? null,
    fondo_inicial: Number(t.fondo_inicial),
    efectivo_contado: n(t.efectivo_contado),
    diferencia: n(t.diferencia),
    arqueo: (crudo?.arqueo as Arqueo | null) ?? null,
    resumen: resumen(r),
    movimientos: ((movs ?? []) as unknown as MovimientoCaja[]).map((m) => ({ ...m, monto: Number(m.monto) })),
  };
}

export async function estadoCaja(): Promise<EstadoCaja> {
  const sesion = await obtenerSesion();
  if (!sesion?.empresa) return { punto: null, turno: null, obligatoria: false };
  const supabase = await createClient();
  const [{ data: p }, { data: e }] = await Promise.all([
    supabase.rpc("punto_emision_actual", { p_empresa: sesion.empresa.id }).maybeSingle(),
    supabase.from("empresas").select("caja_obligatoria").eq("id", sesion.empresa.id).maybeSingle(),
  ]);
  const punto = p as { id: number | null; establecimiento: string; punto_emision: string; nombre: string } | null;
  if (!punto?.id) return { punto: null, turno: null, obligatoria: Boolean(e?.caja_obligatoria) };
  const { data: abierto } = await supabase
    .from("cajas_turnos")
    .select("id")
    .eq("id_punto_emision", punto.id)
    .eq("estado", "abierta")
    .maybeSingle();
  return {
    punto: { id: punto.id, codigo: `${punto.establecimiento}-${punto.punto_emision}`, nombre: punto.nombre },
    turno: abierto ? await leerTurno(abierto.id) : null,
    obligatoria: Boolean(e?.caja_obligatoria),
  };
}

export async function abrirCaja(fondo: number): Promise<Resultado<{ id: string }>> {
  const sesion = await obtenerSesion();
  if (!sesion?.empresa) return { ok: false, error: "No hay una empresa activa." };
  const f = Math.round(Number(fondo) * 100) / 100;
  if (!Number.isFinite(f) || f < 0 || f > 9_999_999) return { ok: false, error: "Revisá el fondo inicial." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("abrir_caja", { p_empresa: sesion.empresa.id, p_fondo: f });
  if (error || !data) return { ok: false, error: error ? mensaje(error, "No se pudo abrir la caja.") : "No se pudo abrir la caja." };
  return { ok: true, id: data as string };
}

export async function movimientoCaja(
  turno: string,
  tipo: "entrada" | "salida",
  monto: number,
  concepto: string,
): Promise<Resultado> {
  if (!esUuid(turno) || (tipo !== "entrada" && tipo !== "salida")) return { ok: false, error: "Datos no válidos." };
  const m = Math.round(Number(monto) * 100) / 100;
  if (!(m > 0)) return { ok: false, error: "El monto debe ser mayor que cero." };
  const c = String(concepto ?? "").trim().slice(0, 160);
  if (!c) return { ok: false, error: "Escribí el concepto." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("movimiento_caja", { p_turno: turno, p_tipo: tipo, p_monto: m, p_concepto: c });
  return error ? { ok: false, error: mensaje(error, "No se pudo registrar.") } : { ok: true };
}

export async function cerrarCaja(turno: string, contado: number, arqueo: Arqueo | null, notas: string): Promise<Resultado> {
  if (!esUuid(turno)) return { ok: false, error: "Turno no válido." };
  const c = Math.round(Number(contado) * 100) / 100;
  if (!Number.isFinite(c) || c < 0) return { ok: false, error: "Escribí cuánto efectivo contaste." };
  const limpio: Arqueo = {};
  for (const [k, v] of Object.entries(arqueo ?? {})) {
    const cantidad = Math.floor(Number(v));
    if (/^\d+(\.\d{2})?$/.test(k) && cantidad > 0 && cantidad < 100_000) limpio[k] = cantidad;
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("cerrar_caja", {
    p_turno: turno,
    p_contado: c,
    p_arqueo: Object.keys(limpio).length ? limpio : null,
    p_notas: String(notas ?? "").trim().slice(0, 500) || null,
  });
  return error ? { ok: false, error: mensaje(error, "No se pudo cerrar la caja.") } : { ok: true };
}

/** Dueño/admin: exigir la caja abierta para facturar de contado y registrar abonos. */
export async function cambiarCajaObligatoria(valor: boolean): Promise<Resultado> {
  const sesion = await obtenerSesion();
  if (!sesion?.empresa) return { ok: false, error: "No hay una empresa activa." };
  const supabase = await createClient();
  const { error } = await supabase.from("empresas").update({ caja_obligatoria: Boolean(valor) }).eq("id", sesion.empresa.id);
  return error ? { ok: false, error: mensaje(error, "No se pudo guardar.") } : { ok: true };
}
