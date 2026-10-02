/** Ventas al crédito y cuentas por cobrar (0017): tipos y cálculos compartidos por el servidor, la demo y la UI. */

import { centavos } from "./formato";

export type FormaPago = "efectivo" | "tarjeta" | "transferencia" | "deposito" | "cheque" | "otro";

export const FORMAS_PAGO: readonly { valor: FormaPago; etiqueta: string; pideReferencia: boolean }[] = [
  { valor: "efectivo", etiqueta: "Efectivo", pideReferencia: false },
  { valor: "transferencia", etiqueta: "Transferencia", pideReferencia: true },
  { valor: "deposito", etiqueta: "Depósito", pideReferencia: true },
  { valor: "tarjeta", etiqueta: "Tarjeta", pideReferencia: true },
  { valor: "cheque", etiqueta: "Cheque", pideReferencia: true },
  { valor: "otro", etiqueta: "Otro", pideReferencia: false },
];

export const etiquetaForma = (f: string) => FORMAS_PAGO.find((x) => x.valor === f)?.etiqueta ?? f;

export type EstadoCuenta = "al_dia" | "por_vencer" | "vencida" | "pagada";

/** Una factura al crédito (v_cuentas_cobrar). */
export type CuentaFactura = {
  id: string;
  numero: string;
  fecha: string;
  vence: string;
  id_cliente: number;
  cliente_nombre: string;
  total: number;
  debitos: number;
  creditos: number;
  abonado: number;
  pendiente: number;
  dias_vencida: number;
  estado: EstadoCuenta;
};

/** Crédito de un cliente (v_cuentas_clientes). */
export type CreditoCliente = {
  id: number;
  nombre: string;
  rtn: string | null;
  telefono: string | null;
  credito_habilitado: boolean;
  limite_credito: number | null;
  dias_credito: number;
  pendiente: number;
  vencido: number;
  disponible: number | null;
  facturas: number;
  dias_mora: number;
  ultimo_abono: string | null;
};

export type Recibo = {
  id: string;
  numero: string;
  fecha: string;
  id_cliente: number;
  cliente_nombre: string;
  cliente_rtn: string | null;
  monto: number;
  forma_pago: FormaPago;
  referencia: string | null;
  notas: string | null;
  estado: "emitido" | "anulado";
  motivo_anulacion: string | null;
  cobro: string | null;
  emisor: { nombre?: string; razon_social?: string | null; rtn?: string | null; telefono?: string | null; direccion?: string | null };
  aplicaciones: { id_documento: string; numero: string; fecha_factura: string; total: number; monto: number }[];
  /** Lo que el cliente sigue debiendo después de este recibo (al momento de leerlo). */
  saldo_actual: number;
};

/** Estado de cuenta: el crédito del cliente, sus facturas pendientes y sus últimos recibos. */
export type EstadoDeCuenta = {
  cliente: CreditoCliente;
  facturas: CuentaFactura[];
  recibos: Pick<Recibo, "id" | "numero" | "fecha" | "monto" | "forma_pago" | "estado">[];
};

export type NuevoAbono = {
  id_cliente: number;
  monto: number;
  forma_pago: FormaPago;
  referencia?: string | null;
  notas?: string | null;
  /** Reparto explícito (lo que se ve en pantalla es lo que se guarda). */
  aplicaciones: { id_documento: string; monto: number }[];
};

// ------------------------------------------------------------- antigüedad --

export const BANDAS = [
  { clave: "al_dia", etiqueta: "Al día", hasta: 0 },
  { clave: "d30", etiqueta: "1–30 días", hasta: 30 },
  { clave: "d60", etiqueta: "31–60", hasta: 60 },
  { clave: "d90", etiqueta: "61–90", hasta: 90 },
  { clave: "d90mas", etiqueta: "+90", hasta: Infinity },
] as const;

export type ClaveBanda = (typeof BANDAS)[number]["clave"];

export const bandaDe = (diasVencida: number): ClaveBanda =>
  BANDAS.find((b) => diasVencida <= b.hasta)?.clave ?? "d90mas";

export type ResumenCartera = {
  total: number;
  vencido: number;
  por_vencer: number;
  clientes: number;
  facturas: number;
  bandas: Record<ClaveBanda, number>;
};

/** Total por cobrar, vencido y antigüedad de saldos (solo lo positivo: un saldo a favor no se cobra). */
export function resumirCartera(facturas: Pick<CuentaFactura, "pendiente" | "dias_vencida" | "estado" | "id_cliente">[]): ResumenCartera {
  const bandas = Object.fromEntries(BANDAS.map((b) => [b.clave, 0])) as Record<ClaveBanda, number>;
  let total = 0;
  let vencido = 0;
  let porVencer = 0;
  const clientes = new Set<number>();
  let n = 0;
  for (const f of facturas) {
    if (!(f.pendiente > 0)) continue;
    n++;
    clientes.add(f.id_cliente);
    total += f.pendiente;
    if (f.estado === "vencida") vencido += f.pendiente;
    if (f.estado === "por_vencer") porVencer += f.pendiente;
    bandas[bandaDe(f.dias_vencida)] += f.pendiente;
  }
  for (const b of BANDAS) bandas[b.clave] = centavos(bandas[b.clave]);
  return { total: centavos(total), vencido: centavos(vencido), por_vencer: centavos(porVencer), clientes: clientes.size, facturas: n, bandas };
}

/**
 * Reparto de un abono: igual que registrar_pago() sin reparto, a las facturas
 * más antiguas primero (por vencimiento). Solo entre las elegidas si hay.
 */
export function repartirAbono(
  facturas: Pick<CuentaFactura, "id" | "pendiente" | "vence" | "fecha" | "numero">[],
  monto: number,
  elegidas?: ReadonlySet<string>,
) {
  let resto = centavos(monto);
  const orden = facturas
    .filter((f) => f.pendiente > 0 && (!elegidas?.size || elegidas.has(f.id)))
    .sort((a, b) => a.vence.localeCompare(b.vence) || a.fecha.localeCompare(b.fecha) || a.numero.localeCompare(b.numero));
  const reparto = new Map<string, number>();
  for (const f of orden) {
    if (resto <= 0) break;
    const aplicar = centavos(Math.min(resto, f.pendiente));
    reparto.set(f.id, aplicar);
    resto = centavos(resto - aplicar);
  }
  return { reparto, sobrante: resto };
}
