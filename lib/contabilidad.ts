/** Contabilidad (0022): tipos y cálculos compartidos por el servidor, la demo y la UI. */

import { centavos } from "./formato";

export type TipoCuenta = "activo" | "pasivo" | "patrimonio" | "ingreso" | "costo" | "gasto";
export type Naturaleza = "deudora" | "acreedora";

export const TIPOS_CUENTA: readonly { valor: TipoCuenta; etiqueta: string }[] = [
  { valor: "activo", etiqueta: "Activo" },
  { valor: "pasivo", etiqueta: "Pasivo" },
  { valor: "patrimonio", etiqueta: "Patrimonio" },
  { valor: "ingreso", etiqueta: "Ingreso" },
  { valor: "costo", etiqueta: "Costo" },
  { valor: "gasto", etiqueta: "Gasto" },
];

/** Las cuentas que usa el sistema en los asientos automáticos. */
export const CLAVES_CUENTA: readonly { valor: string; etiqueta: string }[] = [
  { valor: "caja", etiqueta: "Caja (efectivo)" },
  { valor: "bancos", etiqueta: "Bancos (tarjeta, transferencia…)" },
  { valor: "clientes", etiqueta: "Clientes (ventas al crédito)" },
  { valor: "inventario", etiqueta: "Inventario" },
  { valor: "isv_credito", etiqueta: "ISV de compras" },
  { valor: "proveedores", etiqueta: "Proveedores" },
  { valor: "isv_debito", etiqueta: "ISV de ventas" },
  { valor: "capital", etiqueta: "Capital (apertura)" },
  { valor: "ventas", etiqueta: "Ventas" },
  { valor: "devoluciones_ventas", etiqueta: "Devoluciones y rebajas" },
  { valor: "otros_ingresos", etiqueta: "Otros ingresos (notas de débito)" },
  { valor: "sobrantes_caja", etiqueta: "Sobrantes de caja" },
  { valor: "costo_ventas", etiqueta: "Costo de ventas" },
  { valor: "gastos_generales", etiqueta: "Gastos (compras de gasto, salidas de caja)" },
  { valor: "faltantes_caja", etiqueta: "Faltantes de caja" },
];

export type OrigenAsiento =
  | "manual"
  | "factura"
  | "nota_credito"
  | "nota_debito"
  | "abono"
  | "compra"
  | "pago_proveedor"
  | "caja_entrada"
  | "caja_salida"
  | "cierre_caja"
  | "apertura_inventario";

export const ORIGENES: Record<OrigenAsiento, string> = {
  manual: "Manual",
  factura: "Venta",
  nota_credito: "Nota de crédito",
  nota_debito: "Nota de débito",
  abono: "Abono",
  compra: "Compra",
  pago_proveedor: "Pago a proveedor",
  caja_entrada: "Entrada de caja",
  caja_salida: "Salida de caja",
  cierre_caja: "Cierre de caja",
  apertura_inventario: "Apertura",
};

/** Cuenta para elegir en un asiento (solo de detalle: sin subcuentas). */
export type CuentaBreve = { id: number; codigo: string; nombre: string; tipo: TipoCuenta };

export type LineaAsiento = {
  id: number;
  id_cuenta: number;
  codigo: string;
  cuenta: string;
  debe: number;
  haber: number;
  descripcion: string | null;
};

export type Asiento = {
  id: string;
  numero: number;
  fecha: string;
  concepto: string;
  origen: OrigenAsiento;
  referencia: string | null;
  es_reversa: boolean;
  revertido: boolean;
  registro: string | null;
  lineas: LineaAsiento[];
};

/** El libro de un día: sus asientos y si cuadra. */
export type DiaContable = {
  fecha: string;
  asientos: Asiento[];
  debe: number;
  haber: number;
  /** Mes cerrado: no admite asientos. */
  cerrado: boolean;
};

export type NuevoAsiento = {
  fecha: string;
  concepto: string;
  lineas: { id_cuenta: number; debe: number; haber: number; descripcion: string | null }[];
};

export type FilaBalanza = {
  id: number;
  codigo: string;
  nombre: string;
  tipo: TipoCuenta;
  naturaleza: Naturaleza;
  id_padre: number | null;
  activo: boolean;
  saldo_inicial: number;
  debe: number;
  haber: number;
  saldo_final: number;
};

export type Mayor = {
  saldo_inicial: number;
  movimientos: {
    id_asiento: string;
    numero: number;
    fecha: string;
    concepto: string;
    referencia: string | null;
    descripcion: string | null;
    debe: number;
    haber: number;
    saldo: number;
  }[];
};

export type Periodo = { mes: string; asientos: number; debe: number; cerrado: boolean };

/** Fila de la balanza con las de sus subcuentas sumadas (árbol por id_padre). */
export type NodoBalanza = FilaBalanza & { nivel: number; grupo: boolean };

/**
 * Suma cada cuenta de grupo con sus subcuentas y devuelve el árbol en orden de
 * código (con nivel para la sangría). Las sumas respetan la naturaleza: una
 * subcuenta de naturaleza contraria (depreciación acumulada) resta.
 */
export function arbolBalanza(filas: FilaBalanza[]): NodoBalanza[] {
  const hijos = new Map<number | null, FilaBalanza[]>();
  for (const f of filas) hijos.set(f.id_padre, [...(hijos.get(f.id_padre) ?? []), f]);
  const salida: NodoBalanza[] = [];
  function visitar(f: FilaBalanza, nivel: number): NodoBalanza {
    const nodo: NodoBalanza = { ...f, nivel, grupo: false };
    salida.push(nodo);
    const subs = (hijos.get(f.id) ?? []).sort((a, b) => a.codigo.localeCompare(b.codigo)).map((h) => visitar(h, nivel + 1));
    if (subs.length) {
      nodo.grupo = true;
      for (const s of subs) {
        const signo = s.naturaleza === f.naturaleza ? 1 : -1;
        nodo.saldo_inicial = centavos(nodo.saldo_inicial + signo * s.saldo_inicial);
        nodo.saldo_final = centavos(nodo.saldo_final + signo * s.saldo_final);
        nodo.debe = centavos(nodo.debe + s.debe);
        nodo.haber = centavos(nodo.haber + s.haber);
      }
    }
    return nodo;
  }
  const raices = filas.filter((f) => f.id_padre === null || !filas.some((p) => p.id === f.id_padre));
  for (const r of raices.sort((a, b) => a.codigo.localeCompare(b.codigo))) visitar(r, 0);
  return salida;
}

/** Saldo de las cuentas de detalle de un tipo, con signo de su tipo (contracuentas restan). */
function totalTipo(filas: FilaBalanza[], tipo: TipoCuenta, campo: "saldo_final" | "movimiento") {
  const natural: Naturaleza = tipo === "activo" || tipo === "costo" || tipo === "gasto" ? "deudora" : "acreedora";
  const conHijos = new Set(filas.map((f) => f.id_padre));
  return centavos(
    filas
      .filter((f) => f.tipo === tipo && !conHijos.has(f.id))
      .reduce((s, f) => {
        const valor = campo === "saldo_final" ? f.saldo_final : f.naturaleza === "deudora" ? f.debe - f.haber : f.haber - f.debe;
        return s + (f.naturaleza === natural ? valor : -valor);
      }, 0),
  );
}

/** Estado de resultados del período (movimiento de ingresos, costos y gastos). */
export function estadoResultados(filas: FilaBalanza[]) {
  const ingresos = totalTipo(filas, "ingreso", "movimiento");
  const costos = totalTipo(filas, "costo", "movimiento");
  const gastos = totalTipo(filas, "gasto", "movimiento");
  const bruta = centavos(ingresos - costos);
  return { ingresos, costos, bruta, gastos, neta: centavos(bruta - gastos) };
}

/** Balance general al cierre (saldos acumulados): activo = pasivo + patrimonio + resultado. */
export function balanceGeneral(filas: FilaBalanza[]) {
  const activo = totalTipo(filas, "activo", "saldo_final");
  const pasivo = totalTipo(filas, "pasivo", "saldo_final");
  const patrimonio = totalTipo(filas, "patrimonio", "saldo_final");
  const resultado = centavos(
    totalTipo(filas, "ingreso", "saldo_final") - totalTipo(filas, "costo", "saldo_final") - totalTipo(filas, "gasto", "saldo_final"),
  );
  return { activo, pasivo, patrimonio, resultado, cuadra: Math.abs(activo - (pasivo + patrimonio + resultado)) < 0.01 };
}

/** «2026-10» → primer y último día del mes. */
export function rangoMes(mes: string) {
  const [a, m] = mes.split("-").map(Number);
  const ultimo = new Date(a, m, 0).getDate();
  return { desde: `${mes}-01`, hasta: `${mes}-${String(ultimo).padStart(2, "0")}` };
}
