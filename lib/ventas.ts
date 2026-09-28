/** Tipos y cálculos de ventas compartidos por el mostrador, el servidor y la impresión. */

import { centavos } from "./formato";

export const TASA_ISV = 0.15;

export type GrupoBusqueda = "vehiculo" | "general" | "todos" | "complemento";
export type AjusteBusqueda = "motor" | "anio" | "modelo" | "marca" | "verificar" | "vehiculo" | null;

export type ResultadoBusqueda = {
  id: number;
  codigo: string;
  nombre: string;
  marca: string | null;
  id_categoria: number;
  categoria: string;
  oem: string | null;
  numero_parte: string | null;
  condicion: string;
  unidad: string;
  precio: number;
  exento: boolean;
  costo: number | null;
  existencia: number | null;
  controla_inventario: boolean;
  disponible: boolean;
  ubicacion: string | null;
  imagen: string | null;
  grupo: GrupoBusqueda;
  ajuste: AjusteBusqueda;
  relevancia: number;
  orden: number;
};

export type FiltroVehiculo = {
  id_marca?: number | null;
  id_modelo?: number | null;
  id_modelo_anio?: number | null;
  id_especificacion?: number | null;
};

export type ConsultaMostrador = {
  texto: string;
  vehiculo: FiltroVehiculo;
  id_categoria?: number | null;
  limite?: number;
};

export type Carrito = {
  id: string;
  nombre: string | null;
  id_cliente: number | null;
  cliente_nombre: string | null;
  cliente_rtn: string | null;
  cliente_telefono: string | null;
  id_marca: number | null;
  id_modelo: number | null;
  id_modelo_anio: number | null;
  id_especificacion: number | null;
  vehiculo: string | null;
  descuento_pct: number;
  notas: string | null;
  estado: "abierto" | "cerrado";
  lineas: number;
  creado_por_nombre: string | null;
  creado_en: string;
  actualizado_en: string;
};

export type CambiosCarrito = Partial<
  Pick<
    Carrito,
    | "nombre"
    | "id_cliente"
    | "cliente_nombre"
    | "cliente_rtn"
    | "cliente_telefono"
    | "id_marca"
    | "id_modelo"
    | "id_modelo_anio"
    | "id_especificacion"
    | "descuento_pct"
    | "notas"
  >
>;

export type LineaCarrito = {
  id: number;
  id_carrito: string;
  id_producto: number | null;
  codigo: string | null;
  descripcion: string;
  cantidad: number;
  precio: number;
  descuento_pct: number;
  exento: boolean;
  orden: number;
  costo: number | null;
  existencia: number | null;
  controla_inventario: boolean | null;
  unidad: string | null;
  oem: string | null;
  imagen: string | null;
};

export type NuevaLinea = {
  id_producto?: number | null;
  codigo?: string | null;
  descripcion: string;
  cantidad: number;
  precio: number;
  exento: boolean;
};

export type CambiosLinea = Partial<Pick<LineaCarrito, "cantidad" | "precio" | "descuento_pct" | "descripcion">>;

export type Cliente = {
  id: number;
  nombre: string;
  rtn: string | null;
  telefono: string | null;
};

export type TipoDocumento = "cotizacion" | "factura";

export type Documento = {
  id: string;
  tipo: TipoDocumento;
  numero: string;
  fecha: string;
  vence: string | null;
  cai: string | null;
  cai_rango: string | null;
  cai_fecha_limite: string | null;
  emisor: {
    nombre?: string;
    razon_social?: string | null;
    rtn?: string | null;
    telefono?: string | null;
    correo?: string | null;
    direccion?: string | null;
  };
  cliente_nombre: string;
  cliente_rtn: string | null;
  cliente_telefono: string | null;
  vehiculo: string | null;
  subtotal: number;
  descuento: number;
  importe_exento: number;
  importe_gravado: number;
  isv: number;
  total: number;
  notas: string | null;
  estado: "emitido" | "anulado";
  motivo_anulacion: string | null;
  vendedor: string | null;
  lineas: {
    id: number;
    codigo: string | null;
    descripcion: string;
    cantidad: number;
    precio: number;
    descuento_pct: number;
    descuento: number;
    exento: boolean;
    total: number;
  }[];
};

export type Resultado<T = object> = ({ ok: true } & T) | { ok: false; error: string };

// ----------------------------------------------------------------- totales --

export type Totales = {
  subtotal: number;
  descuento: number;
  exento: number;
  gravado: number;
  isv: number;
  total: number;
  costo: number;
  lineas: { bruto: number; neto: number; descuento: number }[];
};

/**
 * Mismos cálculos y redondeos que emitir_documento() en la base: descuento de
 * línea y general combinados, ISV 15 % sobre lo gravado.
 */
export function calcularTotales(
  lineas: Pick<LineaCarrito, "cantidad" | "precio" | "descuento_pct" | "exento" | "costo">[],
  descuentoGeneral: number,
): Totales {
  let subtotal = 0;
  let descuento = 0;
  let exento = 0;
  let gravado = 0;
  let costo = 0;
  const detalle = lineas.map((l) => {
    const bruto = centavos(Number(l.cantidad) * Number(l.precio));
    const neto = centavos(bruto * (1 - Number(l.descuento_pct) / 100) * (1 - descuentoGeneral / 100));
    subtotal += bruto;
    descuento += bruto - neto;
    if (l.exento) exento += neto;
    else gravado += neto;
    costo += Number(l.costo ?? 0) * Number(l.cantidad);
    return { bruto, neto, descuento: centavos(bruto - neto) };
  });
  const isv = centavos(gravado * TASA_ISV);
  return {
    subtotal: centavos(subtotal),
    descuento: centavos(descuento),
    exento: centavos(exento),
    gravado: centavos(gravado),
    isv,
    total: centavos(exento + gravado + isv),
    costo: centavos(costo),
    lineas: detalle,
  };
}

export const precioConIsv = (precio: number, exento: boolean) => centavos(precio * (exento ? 1 : 1 + TASA_ISV));

/** «0801-1990-123456» */
export function formatoRtn(rtn: string | null | undefined) {
  const d = (rtn ?? "").replace(/\D/g, "");
  return d.length === 14 ? `${d.slice(0, 4)}-${d.slice(4, 8)}-${d.slice(8)}` : (rtn ?? "");
}
