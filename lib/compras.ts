/** Compras, proveedores y cuentas por pagar (0021): tipos y cálculos compartidos por el servidor, la demo y la UI. */

import type { FormaPago } from "./cobros";
import { centavos } from "./formato";

export type TipoCompra = "inventario" | "gasto";
export type CondicionCompra = "contado" | "credito";

export const TASA_ISV_COMPRA = 0.15;
/** Tope del ISV que se acepta escribir a mano (productos con 18 %). */
export const TOPE_ISV_COMPRA = 0.18;

/** Proveedor para elegir en una compra. */
export type ProveedorBreve = {
  id: number;
  nombre: string;
  rtn: string | null;
  telefono: string | null;
  dias_credito: number;
};

/** Línea de una compra nueva: de productos o de gasto (montos sin ISV). */
export type LineaCompraNueva =
  | { id_producto: number; cantidad: number; costo: number; exento: boolean }
  | { descripcion: string; monto: number; exento: boolean };

/** Lo que se manda a registrar_compra(). */
export type NuevaCompra = {
  tipo: TipoCompra;
  id_proveedor: number;
  documento: string | null;
  cai: string | null;
  fecha: string;
  condicion: CondicionCompra;
  /** Crédito: si falta, fecha + plazo del proveedor. */
  vence: string | null;
  forma_pago: FormaPago | null;
  referencia: string | null;
  /** Efectivo que sale de la caja abierta. */
  de_caja: boolean;
  /** ISV de la factura del proveedor; null = 15 % de lo gravado. */
  isv: number | null;
  notas: string | null;
  lineas: LineaCompraNueva[];
};

export type Compra = {
  id: string;
  numero: string;
  tipo: TipoCompra;
  fecha: string;
  id_proveedor: number;
  proveedor_nombre: string;
  proveedor_rtn: string | null;
  documento: string | null;
  cai_proveedor: string | null;
  condicion: CondicionCompra;
  vence: string | null;
  forma_pago: FormaPago | null;
  referencia_pago: string | null;
  subtotal: number;
  importe_exento: number;
  importe_gravado: number;
  isv: number;
  total: number;
  notas: string | null;
  estado: "emitido" | "anulado";
  motivo_anulacion: string | null;
  de_caja: boolean;
  registro: string | null;
  /** Lo que queda por pagar (solo al crédito). */
  pendiente: number | null;
  lineas: { id: number; codigo: string | null; descripcion: string; cantidad: number; costo: number; exento: boolean; total: number }[];
  pagos: { id: string; numero: string; fecha: string; monto: number; estado: "emitido" | "anulado" }[];
};

export type EstadoCuentaCompra = "al_dia" | "por_vencer" | "vencida" | "pagada";

/** Una compra al crédito (v_cuentas_pagar). Los mismos campos que una factura por cobrar, para reutilizar el reparto. */
export type CuentaCompra = {
  id: string;
  numero: string;
  documento: string | null;
  fecha: string;
  vence: string;
  id_proveedor: number;
  proveedor_nombre: string;
  total: number;
  pagado: number;
  pendiente: number;
  dias_vencida: number;
  estado: EstadoCuentaCompra;
};

/** Estado de cuenta de un proveedor: lo que se le debe y los últimos pagos. */
export type EstadoProveedor = {
  proveedor: ProveedorBreve & { pendiente: number; vencido: number };
  compras: CuentaCompra[];
  pagos: { id: string; numero: string; fecha: string; monto: number; forma_pago: FormaPago; estado: "emitido" | "anulado" }[];
};

export type NuevoPagoProveedor = {
  id_proveedor: number;
  monto: number;
  forma_pago: FormaPago;
  referencia?: string | null;
  notas?: string | null;
  de_caja: boolean;
  aplicaciones: { id_compra: string; monto: number }[];
};

export type PagoProveedor = {
  id: string;
  numero: string;
  fecha: string;
  id_proveedor: number;
  proveedor_nombre: string;
  monto: number;
  forma_pago: FormaPago;
  referencia: string | null;
  notas: string | null;
  estado: "emitido" | "anulado";
  motivo_anulacion: string | null;
  de_caja: boolean;
  pago: string | null;
  aplicaciones: { id_compra: string; numero: string; documento: string | null; total: number; monto: number }[];
};

/** Totales de una compra, igual que registrar_compra(). */
export function totalesCompra(lineas: { neto: number; exento: boolean }[], isvEscrito: number | null) {
  const exento = centavos(lineas.filter((l) => l.exento).reduce((s, l) => s + l.neto, 0));
  const gravado = centavos(lineas.filter((l) => !l.exento).reduce((s, l) => s + l.neto, 0));
  const isvCalculado = centavos(gravado * TASA_ISV_COMPRA);
  const tope = centavos(gravado * TOPE_ISV_COMPRA) + 0.05;
  const isv = isvEscrito === null ? isvCalculado : centavos(isvEscrito);
  return {
    exento,
    gravado,
    subtotal: centavos(exento + gravado),
    isvCalculado,
    isv,
    isvValido: isv >= 0 && isv <= tope,
    total: centavos(exento + gravado + isv),
  };
}

/** Hoy en Honduras, AAAA-MM-DD. */
export const hoyIso = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Tegucigalpa" });

/** «2026-10-06» → fecha + días, en AAAA-MM-DD. */
export function sumarDiasIso(fecha: string, dias: number) {
  const d = new Date(`${fecha}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

export const ETIQUETA_TIPO_COMPRA: Record<TipoCompra, string> = { inventario: "Productos", gasto: "Gasto" };
