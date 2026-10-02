"use server";

import type { PostgrestError } from "@supabase/supabase-js";
import {
  FORMAS_PAGO,
  type CreditoCliente,
  type CuentaFactura,
  type EstadoDeCuenta,
  type NuevoAbono,
  type Recibo,
} from "@/lib/cobros";
import { obtenerSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import type { Resultado } from "@/lib/ventas";

// Cuentas por cobrar y abonos. La autorización real es RLS y las funciones de
// la base (registrar_pago, anular_pago); aquí se valida forma y se traducen errores.

const COLUMNAS_FACTURA =
  "id, numero, fecha, vence, id_cliente, cliente_nombre, total, debitos, creditos, abonado, pendiente, dias_vencida, estado";
const COLUMNAS_CLIENTE =
  "id, nombre, rtn, telefono, credito_habilitado, limite_credito, dias_credito, pendiente, vencido, disponible, facturas, dias_mora, ultimo_abono";

const esUuid = (v: unknown): v is string =>
  typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const esId = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v > 0;

function mensaje(error: PostgrestError, porDefecto: string) {
  if (error.code === "P0001") return error.message;
  if (error.code === "42501") return "No tenés permiso para esta acción.";
  console.error("[cobros]", error);
  return porDefecto;
}

const numeros = <T extends Record<string, unknown>>(fila: T, campos: (keyof T)[]) => {
  const copia = { ...fila };
  for (const c of campos) if (copia[c] !== null && copia[c] !== undefined) copia[c] = Number(copia[c]) as T[keyof T];
  return copia;
};

const factura = (f: unknown) =>
  numeros(f as CuentaFactura, ["total", "debitos", "creditos", "abonado", "pendiente", "dias_vencida"]);
const cliente = (c: unknown) =>
  numeros(c as CreditoCliente, ["limite_credito", "pendiente", "vencido", "disponible", "facturas", "dias_mora"]);

/** Todas las facturas al crédito con algo pendiente (para el tablero de cartera). */
export async function carteraPendiente(): Promise<CuentaFactura[]> {
  const sesion = await obtenerSesion();
  if (!sesion?.empresa) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_cuentas_cobrar")
    .select(COLUMNAS_FACTURA)
    .eq("id_empresa", sesion.empresa.id)
    .gt("pendiente", 0)
    .order("vence")
    .limit(5000);
  return (data ?? []).map(factura);
}

/** Crédito de un cliente (mostrador). Null si no es de la empresa o no tiene crédito ni saldo. */
export async function creditoCliente(idCliente: number): Promise<CreditoCliente | null> {
  if (!esId(idCliente)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("v_cuentas_clientes").select(COLUMNAS_CLIENTE).eq("id", idCliente).maybeSingle();
  return data ? cliente(data) : null;
}

export async function estadoDeCuenta(idCliente: number): Promise<EstadoDeCuenta | null> {
  if (!esId(idCliente)) return null;
  const supabase = await createClient();
  const [{ data: c }, { data: facturas }, { data: recibos }] = await Promise.all([
    supabase.from("v_cuentas_clientes").select(COLUMNAS_CLIENTE).eq("id", idCliente).maybeSingle(),
    supabase.from("v_cuentas_cobrar").select(COLUMNAS_FACTURA).eq("id_cliente", idCliente).neq("pendiente", 0).order("vence"),
    supabase
      .from("pagos")
      .select("id, numero, fecha, monto, forma_pago, estado")
      .eq("id_cliente", idCliente)
      .order("fecha", { ascending: false })
      .limit(30),
  ]);
  if (!c) return null;
  return {
    cliente: cliente(c),
    facturas: (facturas ?? []).map(factura),
    recibos: (recibos ?? []).map((r) => numeros(r as EstadoDeCuenta["recibos"][number], ["monto"])),
  };
}

export async function registrarAbono(abono: NuevoAbono): Promise<Resultado<{ id: string; numero: string }>> {
  if (!esId(abono?.id_cliente)) return { ok: false, error: "Elegí un cliente." };
  const monto = Math.round(Number(abono.monto) * 100) / 100;
  if (!(monto > 0) || monto > 99_999_999) return { ok: false, error: "Escribí un monto mayor que cero." };
  if (!FORMAS_PAGO.some((f) => f.valor === abono.forma_pago)) return { ok: false, error: "Elegí la forma de pago." };
  const aplicaciones = [];
  for (const a of abono.aplicaciones ?? []) {
    const m = Math.round(Number(a.monto) * 100) / 100;
    if (!esUuid(a.id_documento) || !(m > 0)) return { ok: false, error: "Revisá el reparto entre facturas." };
    aplicaciones.push({ id_documento: a.id_documento, monto: m });
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("registrar_pago", {
    p_cliente: abono.id_cliente,
    p_monto: monto,
    p_forma_pago: abono.forma_pago,
    p_referencia: abono.referencia?.trim().slice(0, 80) || null,
    p_notas: abono.notas?.trim().slice(0, 300) || null,
    p_aplicaciones: aplicaciones.length ? aplicaciones : null,
  });
  if (error || !data) return { ok: false, error: error ? mensaje(error, "No se pudo registrar el abono.") : "No se pudo registrar el abono." };
  const { data: p } = await supabase.from("pagos").select("numero").eq("id", data).single();
  return { ok: true, id: data as string, numero: p?.numero ?? "" };
}

export async function anularAbono(id: string, motivo: string): Promise<Resultado> {
  if (!esUuid(id)) return { ok: false, error: "Recibo no válido." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("anular_pago", { p_pago: id, p_motivo: String(motivo ?? "").slice(0, 300) });
  return error ? { ok: false, error: mensaje(error, "No se pudo anular.") } : { ok: true };
}

export async function leerRecibo(id: string): Promise<Recibo | null> {
  if (!esUuid(id)) return null;
  const supabase = await createClient();
  const [{ data: p }, { data: aplicaciones }] = await Promise.all([
    supabase
      .from("v_pagos")
      .select("id, id_empresa, numero, fecha, id_cliente, cliente_nombre, cliente_rtn, monto, forma_pago, referencia, notas, estado, motivo_anulacion, cobro")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("v_pagos_aplicaciones").select("id_documento, numero, fecha_factura, total, monto").eq("id_pago", id).order("numero"),
  ]);
  if (!p) return null;
  const [{ data: e }, { data: saldo }] = await Promise.all([
    supabase.from("empresas").select("nombre, razon_social, rtn, telefono, direccion").eq("id", p.id_empresa).maybeSingle(),
    supabase.from("v_cuentas_clientes").select("pendiente").eq("id", p.id_cliente).maybeSingle(),
  ]);
  const { id_empresa: _empresa, ...resto } = p;
  void _empresa;
  return {
    ...numeros(resto as unknown as Recibo, ["monto"]),
    emisor: e ?? {},
    aplicaciones: (aplicaciones ?? []).map((a) => numeros(a as Recibo["aplicaciones"][number], ["total", "monto"])),
    saldo_actual: Number(saldo?.pendiente ?? 0),
  };
}
