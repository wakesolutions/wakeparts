"use server";

import type { PostgrestError } from "@supabase/supabase-js";
import { FORMAS_PAGO } from "@/lib/cobros";
import type {
  Compra,
  CuentaCompra,
  EstadoProveedor,
  NuevaCompra,
  NuevoPagoProveedor,
  PagoProveedor,
  ProveedorBreve,
} from "@/lib/compras";
import { obtenerSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import type { Resultado } from "@/lib/ventas";

// Compras, proveedores y cuentas por pagar (0021). La autoridad son RLS y las
// funciones de la base (registrar_compra, registrar_pago_proveedor…, dueño/admin);
// aquí se valida forma y se traducen errores.

const esUuid = (v: unknown): v is string =>
  typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const esId = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v > 0;
const esFecha = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const dinero = (v: unknown) => Math.round(Number(v) * 100) / 100;

function mensaje(error: PostgrestError, porDefecto: string) {
  if (error.code === "PGRST202" || error.code === "42P01") return "Falta ejecutar la migración 0021 en la base.";
  if (error.code === "P0001") return error.message;
  if (error.code === "23505") return "Esa factura del proveedor ya está registrada.";
  if (error.code === "42501") return "No tenés permiso para esta acción.";
  console.error("[compras]", error);
  return porDefecto;
}

const COLUMNAS_CUENTA = "id, numero, documento, fecha, vence, id_proveedor, proveedor_nombre, total, pagado, pendiente, dias_vencida, estado";

const cuenta = (c: Record<string, unknown>): CuentaCompra => ({
  ...(c as unknown as CuentaCompra),
  total: Number(c.total),
  pagado: Number(c.pagado),
  pendiente: Number(c.pendiente),
  dias_vencida: Number(c.dias_vencida),
});

/** Proveedores activos para elegir en una compra (por nombre, RTN o teléfono). */
export async function buscarProveedores(texto: string): Promise<ProveedorBreve[]> {
  const sesion = await obtenerSesion();
  if (!sesion?.empresa) return [];
  const termino = String(texto ?? "").replace(/["\\*%_(),]/g, " ").trim().slice(0, 60);
  const supabase = await createClient();
  let q = supabase
    .from("proveedores")
    .select("id, nombre, rtn, telefono, dias_credito")
    .eq("id_empresa", sesion.empresa.id)
    .eq("activo", true)
    .order("nombre")
    .limit(8);
  if (termino) {
    const digitos = termino.replace(/\D/g, "");
    q = q.or(
      [`nombre.ilike."*${termino}*"`, `telefono.ilike."*${termino}*"`, ...(digitos.length >= 4 ? [`rtn.ilike."*${digitos}*"`] : [])].join(","),
    );
  }
  const { data } = await q;
  return (data ?? []) as ProveedorBreve[];
}

/** Alta rápida de un proveedor desde la compra (nombre, RTN y plazo). */
export async function crearProveedor(datos: { nombre: string; rtn?: string | null; dias_credito?: number }): Promise<Resultado<{ proveedor: ProveedorBreve }>> {
  const sesion = await obtenerSesion();
  if (!sesion?.empresa) return { ok: false, error: "No hay una empresa activa." };
  const nombre = String(datos.nombre ?? "").trim().slice(0, 160);
  const rtn = datos.rtn ? String(datos.rtn).replace(/\D/g, "") : null;
  const dias = Math.max(0, Math.min(365, Math.round(Number(datos.dias_credito ?? 0)) || 0));
  if (!nombre) return { ok: false, error: "Escribí el nombre del proveedor." };
  if (rtn && rtn.length !== 14) return { ok: false, error: "El RTN son 14 dígitos." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("proveedores")
    .insert({ id_empresa: sesion.empresa.id, nombre, rtn, dias_credito: dias })
    .select("id, nombre, rtn, telefono, dias_credito")
    .single();
  if (error || !data) {
    if (error?.code === "23505") return { ok: false, error: "Ya hay un proveedor con ese RTN." };
    return { ok: false, error: error ? mensaje(error, "No se pudo crear el proveedor.") : "No se pudo crear el proveedor." };
  }
  return { ok: true, proveedor: data as ProveedorBreve };
}

export async function registrarCompra(compra: NuevaCompra): Promise<Resultado<{ id: string; numero: string }>> {
  const sesion = await obtenerSesion();
  if (!sesion?.empresa) return { ok: false, error: "No hay una empresa activa." };
  if (compra?.tipo !== "inventario" && compra?.tipo !== "gasto") return { ok: false, error: "Tipo de compra no válido." };
  if (!esId(compra.id_proveedor)) return { ok: false, error: "Elegí el proveedor." };
  if (!esFecha(compra.fecha)) return { ok: false, error: "Revisá la fecha." };
  if (compra.condicion !== "contado" && compra.condicion !== "credito") return { ok: false, error: "Elegí contado o crédito." };
  if (compra.condicion === "credito" && compra.vence !== null && !esFecha(compra.vence)) return { ok: false, error: "Revisá el vencimiento." };
  if (compra.condicion === "contado" && !FORMAS_PAGO.some((f) => f.valor === compra.forma_pago)) return { ok: false, error: "Elegí la forma de pago." };
  if (!Array.isArray(compra.lineas) || !compra.lineas.length || compra.lineas.length > 300) return { ok: false, error: "La compra no tiene líneas." };
  const lineas = [];
  for (const l of compra.lineas) {
    if ("id_producto" in l) {
      if (compra.tipo !== "inventario" || !esId(l.id_producto) || !(Number(l.cantidad) > 0) || !(Number(l.costo) >= 0)) {
        return { ok: false, error: "Revisá cantidades y costos." };
      }
      lineas.push({ id_producto: l.id_producto, cantidad: dinero(l.cantidad), costo: dinero(l.costo), exento: Boolean(l.exento) });
    } else {
      const descripcion = String(l.descripcion ?? "").trim().slice(0, 240);
      if (compra.tipo !== "gasto" || !descripcion || !(Number(l.monto) > 0)) return { ok: false, error: "Revisá la descripción y el monto." };
      lineas.push({ descripcion, monto: dinero(l.monto), exento: Boolean(l.exento) });
    }
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("registrar_compra", {
    p_empresa: sesion.empresa.id,
    p_compra: {
      tipo: compra.tipo,
      id_proveedor: compra.id_proveedor,
      documento: compra.documento?.trim().slice(0, 40) || null,
      cai: compra.cai?.trim().slice(0, 40) || null,
      fecha: compra.fecha,
      condicion: compra.condicion,
      vence: compra.condicion === "credito" ? compra.vence : null,
      forma_pago: compra.condicion === "contado" ? compra.forma_pago : null,
      referencia: compra.condicion === "contado" ? compra.referencia?.trim().slice(0, 80) || null : null,
      de_caja: compra.condicion === "contado" && compra.forma_pago === "efectivo" && Boolean(compra.de_caja),
      isv: compra.isv === null ? null : dinero(compra.isv),
      notas: compra.notas?.trim().slice(0, 300) || null,
      lineas,
    },
  });
  if (error || !data) return { ok: false, error: error ? mensaje(error, "No se pudo registrar la compra.") : "No se pudo registrar la compra." };
  const { data: c } = await supabase.from("compras").select("numero").eq("id", data).single();
  return { ok: true, id: data as string, numero: c?.numero ?? "" };
}

export async function leerCompra(id: string): Promise<Compra | null> {
  if (!esUuid(id)) return null;
  const supabase = await createClient();
  const [{ data: c }, { data: lineas }, { data: pagos }, { data: cuentaPagar }] = await Promise.all([
    supabase
      .from("compras")
      .select(
        "id, numero, tipo, fecha, id_proveedor, proveedor_nombre, proveedor_rtn, documento, cai_proveedor, condicion, vence, forma_pago, referencia_pago, subtotal, importe_exento, importe_gravado, isv, total, notas, estado, motivo_anulacion, id_turno, creado_por",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("compras_lineas").select("id, codigo, descripcion, cantidad, costo, exento, total").eq("id_compra", id).order("orden"),
    supabase.from("pagos_proveedores_aplicaciones").select("monto, pagos_proveedores(id, numero, fecha, estado)").eq("id_compra", id),
    supabase.from("v_cuentas_pagar").select("pendiente").eq("id", id).maybeSingle(),
  ]);
  if (!c) return null;
  const { data: u } = c.creado_por ? await supabase.from("usuarios").select("nombre").eq("id", c.creado_por).maybeSingle() : { data: null };
  const { id_turno, creado_por: _creado, ...resto } = c;
  void _creado;
  type Aplicacion = { monto: number; pagos_proveedores: { id: string; numero: string; fecha: string; estado: "emitido" | "anulado" } | null };
  return {
    ...(resto as unknown as Compra),
    subtotal: Number(c.subtotal),
    importe_exento: Number(c.importe_exento),
    importe_gravado: Number(c.importe_gravado),
    isv: Number(c.isv),
    total: Number(c.total),
    de_caja: id_turno !== null,
    registro: u?.nombre ?? null,
    pendiente: cuentaPagar ? Number(cuentaPagar.pendiente) : null,
    lineas: (lineas ?? []).map((l) => ({ ...l, cantidad: Number(l.cantidad), costo: Number(l.costo), total: Number(l.total) })),
    pagos: ((pagos ?? []) as unknown as Aplicacion[])
      .filter((a) => a.pagos_proveedores)
      .map((a) => ({ ...a.pagos_proveedores!, monto: Number(a.monto) })),
  };
}

export async function anularCompra(id: string, motivo: string): Promise<Resultado> {
  if (!esUuid(id)) return { ok: false, error: "Compra no válida." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("anular_compra", { p_compra: id, p_motivo: String(motivo ?? "").slice(0, 300) });
  return error ? { ok: false, error: mensaje(error, "No se pudo anular.") } : { ok: true };
}

/** Todas las compras al crédito con algo pendiente (tablero de cuentas por pagar). */
export async function carteraProveedores(): Promise<CuentaCompra[]> {
  const sesion = await obtenerSesion();
  if (!sesion?.empresa) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_cuentas_pagar")
    .select(COLUMNAS_CUENTA)
    .eq("id_empresa", sesion.empresa.id)
    .gt("pendiente", 0)
    .order("vence")
    .limit(5000);
  return (data ?? []).map(cuenta);
}

export async function estadoProveedor(idProveedor: number): Promise<EstadoProveedor | null> {
  if (!esId(idProveedor)) return null;
  const supabase = await createClient();
  const [{ data: p }, { data: compras }, { data: pagos }] = await Promise.all([
    supabase.from("proveedores").select("id, nombre, rtn, telefono, dias_credito").eq("id", idProveedor).maybeSingle(),
    supabase.from("v_cuentas_pagar").select(COLUMNAS_CUENTA).eq("id_proveedor", idProveedor).gt("pendiente", 0).order("vence"),
    supabase
      .from("pagos_proveedores")
      .select("id, numero, fecha, monto, forma_pago, estado")
      .eq("id_proveedor", idProveedor)
      .order("fecha", { ascending: false })
      .limit(30),
  ]);
  if (!p) return null;
  const lista = (compras ?? []).map(cuenta);
  return {
    proveedor: {
      ...(p as ProveedorBreve),
      pendiente: lista.reduce((s, c) => s + c.pendiente, 0),
      vencido: lista.filter((c) => c.estado === "vencida").reduce((s, c) => s + c.pendiente, 0),
    },
    compras: lista,
    pagos: (pagos ?? []).map((x) => ({ ...(x as EstadoProveedor["pagos"][number]), monto: Number(x.monto) })),
  };
}

export async function registrarPagoProveedor(pago: NuevoPagoProveedor): Promise<Resultado<{ id: string; numero: string }>> {
  if (!esId(pago?.id_proveedor)) return { ok: false, error: "Elegí un proveedor." };
  const monto = dinero(pago.monto);
  if (!(monto > 0) || monto > 99_999_999) return { ok: false, error: "Escribí un monto mayor que cero." };
  if (!FORMAS_PAGO.some((f) => f.valor === pago.forma_pago)) return { ok: false, error: "Elegí la forma de pago." };
  const aplicaciones = [];
  for (const a of pago.aplicaciones ?? []) {
    const m = dinero(a.monto);
    if (!esUuid(a.id_compra) || !(m > 0)) return { ok: false, error: "Revisá el reparto entre compras." };
    aplicaciones.push({ id_compra: a.id_compra, monto: m });
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("registrar_pago_proveedor", {
    p_proveedor: pago.id_proveedor,
    p_monto: monto,
    p_forma_pago: pago.forma_pago,
    p_referencia: pago.referencia?.trim().slice(0, 80) || null,
    p_notas: pago.notas?.trim().slice(0, 300) || null,
    p_aplicaciones: aplicaciones.length ? aplicaciones : null,
    p_de_caja: pago.forma_pago === "efectivo" && Boolean(pago.de_caja),
  });
  if (error || !data) return { ok: false, error: error ? mensaje(error, "No se pudo registrar el pago.") : "No se pudo registrar el pago." };
  const { data: p } = await supabase.from("pagos_proveedores").select("numero").eq("id", data).single();
  return { ok: true, id: data as string, numero: p?.numero ?? "" };
}

export async function leerPagoProveedor(id: string): Promise<PagoProveedor | null> {
  if (!esUuid(id)) return null;
  const supabase = await createClient();
  const [{ data: p }, { data: aplicaciones }] = await Promise.all([
    supabase
      .from("v_pagos_proveedores")
      .select("id, numero, fecha, id_proveedor, proveedor_nombre, monto, forma_pago, referencia, notas, estado, motivo_anulacion, de_caja, pago")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("v_pagos_proveedores_aplicaciones").select("id_compra, numero, documento, total, monto").eq("id_pago", id).order("numero"),
  ]);
  if (!p) return null;
  return {
    ...(p as unknown as PagoProveedor),
    monto: Number(p.monto),
    aplicaciones: (aplicaciones ?? []).map((a) => ({ ...a, total: Number(a.total), monto: Number(a.monto) })),
  };
}

export async function anularPagoProveedor(id: string, motivo: string): Promise<Resultado> {
  if (!esUuid(id)) return { ok: false, error: "Pago no válido." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("anular_pago_proveedor", { p_pago: id, p_motivo: String(motivo ?? "").slice(0, 300) });
  return error ? { ok: false, error: mensaje(error, "No se pudo anular.") } : { ok: true };
}
