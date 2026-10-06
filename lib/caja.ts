/** Caja (0018): tipos y cálculos compartidos por el servidor, la demo y la UI. */

import type { FormaPago } from "./cobros";
import { centavos } from "./formato";

export type ResumenForma = {
  forma: FormaPago;
  ventas: number;
  abonos: number;
  devoluciones: number;
  cargos: number;
  /** Compras de contado y pagos a proveedores hechos desde la caja (0021). */
  pagos: number;
  neto: number;
};

/** Igual que resumen_turno(): por forma de pago, y el efectivo que debería haber. */
export type ResumenTurno = {
  fondo: number;
  formas: ResumenForma[];
  entradas: number;
  salidas: number;
  esperado_efectivo: number;
  total_cobrado: number;
  facturas: number;
  abonos: number;
  notas: number;
  /** Compras y pagos a proveedores que salieron del turno (0021). */
  pagos: number;
  movimientos: number;
  credito: number;
  anuladas: number;
};

export type TipoMovimientoCaja =
  | "venta"
  | "venta_credito"
  | "devolucion"
  | "cargo"
  | "abono"
  | "entrada"
  | "salida"
  | "compra"
  | "pago_proveedor";

export type MovimientoCaja = {
  id: string;
  fecha: string;
  tipo: TipoMovimientoCaja;
  referencia: string | null;
  detalle: string | null;
  forma_pago: FormaPago | null;
  monto: number;
  en_caja: boolean;
  estado: "emitido" | "anulado";
  usuario: string | null;
};

export type Turno = {
  id: string;
  numero: number;
  /** Nombre comercial del taller (para el corte impreso). */
  empresa: string | null;
  punto: string;
  estado: "abierta" | "cerrada";
  abierta_en: string;
  abierta_por: string | null;
  cerrada_en: string | null;
  cerrada_por: string | null;
  fondo_inicial: number;
  efectivo_contado: number | null;
  diferencia: number | null;
  arqueo: Arqueo | null;
  notas: string | null;
  /** Lo abrió quien está mirando. */
  propio: boolean;
  resumen: ResumenTurno;
  movimientos: MovimientoCaja[];
};

/** Estado de la caja para quien entra al módulo: su punto y su turno abierto, si hay. */
export type EstadoCaja = {
  punto: { id: number; codigo: string; nombre: string } | null;
  turno: Turno | null;
  obligatoria: boolean;
};

/** Cantidad por denominación: { "500": 3, "0.50": 4 }. */
export type Arqueo = Record<string, number>;

/** Billetes y monedas del lempira, de mayor a menor. */
export const DENOMINACIONES: readonly { valor: number; clave: string; tipo: "billete" | "moneda" }[] = [
  { valor: 500, clave: "500", tipo: "billete" },
  { valor: 200, clave: "200", tipo: "billete" },
  { valor: 100, clave: "100", tipo: "billete" },
  { valor: 50, clave: "50", tipo: "billete" },
  { valor: 20, clave: "20", tipo: "billete" },
  { valor: 10, clave: "10", tipo: "billete" },
  { valor: 5, clave: "5", tipo: "billete" },
  { valor: 2, clave: "2", tipo: "billete" },
  { valor: 1, clave: "1", tipo: "billete" },
  { valor: 0.5, clave: "0.50", tipo: "moneda" },
  { valor: 0.2, clave: "0.20", tipo: "moneda" },
  { valor: 0.1, clave: "0.10", tipo: "moneda" },
  { valor: 0.05, clave: "0.05", tipo: "moneda" },
];

export const totalArqueo = (a: Arqueo) =>
  centavos(DENOMINACIONES.reduce((s, d) => s + d.valor * (Number(a[d.clave]) || 0), 0));

export const ETIQUETA_MOVIMIENTO: Record<TipoMovimientoCaja, string> = {
  venta: "Venta",
  venta_credito: "Venta al crédito",
  devolucion: "Devolución",
  cargo: "Nota de débito",
  abono: "Abono",
  entrada: "Entrada",
  salida: "Salida",
  compra: "Compra",
  pago_proveedor: "Pago a proveedor",
};

/**
 * Cálculo del resumen en el navegador (demo), igual que resumen_turno() en la
 * base, a partir de los movimientos del turno.
 */
export function resumirTurno(fondo: number, movimientos: MovimientoCaja[]): ResumenTurno {
  const formas: FormaPago[] = ["efectivo", "tarjeta", "transferencia", "deposito", "cheque", "otro"];
  const vivos = movimientos.filter((m) => m.estado === "emitido");
  const de = (forma: FormaPago, tipo: TipoMovimientoCaja) =>
    centavos(vivos.filter((m) => m.en_caja && m.tipo === tipo && (m.forma_pago ?? "efectivo") === forma).reduce((s, m) => s + Math.abs(m.monto), 0));
  const porForma = formas.map((forma) => {
    const ventas = de(forma, "venta");
    const abonos = de(forma, "abono");
    const devoluciones = de(forma, "devolucion");
    const cargos = de(forma, "cargo");
    const pagos = centavos(de(forma, "compra") + de(forma, "pago_proveedor"));
    return { forma, ventas, abonos, devoluciones, cargos, pagos, neto: centavos(ventas + abonos + cargos - devoluciones - pagos) };
  });
  const entradas = centavos(vivos.filter((m) => m.tipo === "entrada").reduce((s, m) => s + m.monto, 0));
  const salidas = centavos(vivos.filter((m) => m.tipo === "salida").reduce((s, m) => s + Math.abs(m.monto), 0));
  return {
    fondo,
    formas: porForma,
    entradas,
    salidas,
    esperado_efectivo: centavos(fondo + porForma[0].neto + entradas - salidas),
    total_cobrado: centavos(porForma.reduce((s, f) => s + f.neto, 0)),
    facturas: vivos.filter((m) => m.tipo === "venta").length,
    abonos: vivos.filter((m) => m.tipo === "abono").length,
    notas: vivos.filter((m) => (m.tipo === "devolucion" || m.tipo === "cargo") && m.en_caja).length,
    pagos: vivos.filter((m) => m.tipo === "compra" || m.tipo === "pago_proveedor").length,
    movimientos: vivos.filter((m) => m.tipo === "entrada" || m.tipo === "salida").length,
    credito: centavos(vivos.filter((m) => m.tipo === "venta_credito").reduce((s, m) => s + m.monto, 0)),
    anuladas: movimientos.filter((m) => m.estado === "anulado").length,
  };
}
