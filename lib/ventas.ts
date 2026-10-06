/** Tipos y cálculos de ventas compartidos por el mostrador, el servidor y la impresión. */

import type { FormaPago } from "./cobros";
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
  /** Cliente exonerado: lo gravado sale como «importe exonerado», sin ISV. */
  exonerado: boolean;
  exo_orden_compra: string | null;
  exo_constancia: string | null;
  exo_registro_sag: string | null;
  /** Contado o crédito (0017): al crédito, el cliente debe tener crédito habilitado. */
  condicion: CondicionVenta;
  /** De contado: cómo paga (0018, entra al turno de caja por forma). */
  forma_pago: FormaPago;
  referencia_pago: string | null;
};

export type CondicionVenta = "contado" | "credito";

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
    | "exonerado"
    | "exo_orden_compra"
    | "exo_constancia"
    | "exo_registro_sag"
    | "condicion"
    | "forma_pago"
    | "referencia_pago"
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
export type TipoNota = "nota_credito" | "nota_debito";
export type TipoCualquierDocumento = TipoDocumento | TipoNota;

/** Código SAR del tipo de documento (parte TT del número EEE-PPP-TT-NNNNNNNN). */
export const CODIGO_TIPO_DOCUMENTO: Record<Exclude<TipoCualquierDocumento, "cotizacion">, string> = {
  factura: "01",
  nota_credito: "06",
  nota_debito: "07",
};

export const NOMBRE_DOCUMENTO: Record<TipoCualquierDocumento, string> = {
  cotizacion: "Cotización",
  factura: "Factura",
  nota_credito: "Nota de crédito",
  nota_debito: "Nota de débito",
};

export type MotivoNota = "devolucion" | "descuento" | "correccion" | "intereses" | "gastos" | "otro";

/** Motivos de cada nota, en el orden en que se ofrecen. */
export const MOTIVOS_NOTA: Record<TipoNota, readonly { valor: MotivoNota; etiqueta: string; ayuda: string }[]> = {
  nota_credito: [
    { valor: "devolucion", etiqueta: "Devolución", ayuda: "El cliente regresa piezas de la factura." },
    { valor: "descuento", etiqueta: "Rebaja", ayuda: "Se rebaja un monto después de facturar." },
    { valor: "correccion", etiqueta: "Corrección", ayuda: "Se cobró de más por un error de precio." },
    { valor: "otro", etiqueta: "Otro", ayuda: "Cualquier otro crédito al cliente." },
  ],
  nota_debito: [
    { valor: "gastos", etiqueta: "Gastos o flete", ayuda: "Envío, encomienda u otro cargo." },
    { valor: "intereses", etiqueta: "Intereses", ayuda: "Recargo por pago atrasado." },
    { valor: "correccion", etiqueta: "Corrección", ayuda: "Se cobró de menos por un error de precio." },
    { valor: "otro", etiqueta: "Otro", ayuda: "Cualquier otro cargo al cliente." },
  ],
};

/** Motivos de una nota sin factura relacionada (0019): no hay piezas que devolver. */
export const motivosNota = (tipo: TipoNota, conFactura: boolean) =>
  conFactura ? MOTIVOS_NOTA[tipo] : MOTIVOS_NOTA[tipo].filter((m) => m.valor !== "devolucion");

export const etiquetaMotivo = (motivo: string | null | undefined) =>
  [...MOTIVOS_NOTA.nota_credito, ...MOTIVOS_NOTA.nota_debito].find((m) => m.valor === motivo)?.etiqueta ?? motivo ?? "";

/** Datos de exoneración impresos en la factura. */
export type Exoneracion = {
  orden_compra?: string | null;
  constancia?: string | null;
  registro_sag?: string | null;
};

export type Documento = {
  id: string;
  tipo: TipoCualquierDocumento;
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
    /** Establecimiento y punto de emisión (0016). */
    sucursal?: string | null;
    direccion_sucursal?: string | null;
    telefono_sucursal?: string | null;
    punto?: string | null;
  };
  cliente_nombre: string;
  cliente_rtn: string | null;
  cliente_telefono: string | null;
  vehiculo: string | null;
  subtotal: number;
  descuento: number;
  importe_exento: number;
  importe_gravado: number;
  importe_exonerado: number;
  isv: number;
  total: number;
  notas: string | null;
  estado: "emitido" | "anulado";
  motivo_anulacion: string | null;
  vendedor: string | null;
  exoneracion: Exoneracion | null;
  /** Notas: la factura que modifican. */
  id_factura: string | null;
  factura_numero: string | null;
  factura_fecha: string | null;
  factura_cai: string | null;
  motivo_tipo: MotivoNota | null;
  motivo: string | null;
  reintegra_inventario: boolean;
  /** Factura al crédito: vence = fecha de pago (0017). */
  condicion: CondicionVenta;
  dias_credito: number | null;
  forma_pago?: FormaPago | null;
  referencia_pago?: string | null;
  /** Factura: sus notas de crédito y débito (también las anuladas). */
  notasRelacionadas?: NotaRelacionada[];
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

export type NotaRelacionada = {
  id: string;
  tipo: TipoNota;
  numero: string;
  fecha: string;
  total: number;
  estado: "emitido" | "anulado";
  motivo_tipo: MotivoNota | null;
};

/** Línea de una factura con lo ya devuelto en notas de crédito vigentes. */
export type LineaAcreditable = {
  id: number;
  codigo: string | null;
  descripcion: string;
  cantidad: number;
  precio: number;
  descuento_pct: number;
  exento: boolean;
  total: number;
  controla_inventario: boolean;
  devuelto: number;
  acreditado: number;
};

export type LineaNota = { id_linea: number; cantidad: number } | { descripcion: string; monto: number; exento: boolean };

/** Lo que se manda a emitir_nota(). */
export type NuevaNota = {
  tipo: TipoNota;
  motivo_tipo: MotivoNota;
  motivo: string;
  /** Devolución: líneas de la factura; lo demás: montos libres sin ISV. */
  lineas: LineaNota[];
  reintegrar: boolean;
};

/** Lo que se manda a emitir_nota_libre() (0019): nota sin factura, a nombre de un cliente. */
export type NuevaNotaLibre = {
  tipo: TipoNota;
  motivo_tipo: MotivoNota;
  motivo: string;
  /** Cliente registrado; si es null, nombre y RTN libres (vacío = consumidor final). */
  id_cliente: number | null;
  cliente_nombre: string | null;
  cliente_rtn: string | null;
  lineas: { descripcion: string; monto: number; exento: boolean }[];
  /** null = la nota no mueve dinero (no cae en la caja). */
  forma_pago: FormaPago | null;
  referencia_pago: string | null;
};

/** Factura emitida que se puede modificar con una nota (buscador del módulo Notas). */
export type FacturaParaNota = {
  id: string;
  numero: string;
  fecha: string;
  cliente_nombre: string;
  total: number;
  saldo: number;
};

/** Punto de emisión con el que factura quien está en el mostrador. */
export type PuntoEmision = {
  id: number;
  codigo: string;
  nombre: string;
  sucursal: string;
};

export type Resultado<T = object> = ({ ok: true } & T) | { ok: false; error: string };

// ----------------------------------------------------------------- totales --

export type Totales = {
  subtotal: number;
  descuento: number;
  exento: number;
  gravado: number;
  exonerado: number;
  isv: number;
  total: number;
  costo: number;
  lineas: { bruto: number; neto: number; descuento: number }[];
};

/**
 * Mismos cálculos y redondeos que emitir_documento() en la base: descuento de
 * línea y general combinados, ISV 15 % sobre lo gravado. Con `exonerado`, lo
 * gravado pasa a «importe exonerado» y no lleva ISV.
 */
export function calcularTotales(
  lineas: Pick<LineaCarrito, "cantidad" | "precio" | "descuento_pct" | "exento" | "costo">[],
  descuentoGeneral: number,
  exonerado = false,
): Totales {
  let subtotal = 0;
  let descuento = 0;
  let exento = 0;
  let gravado = 0;
  let exoneradoTotal = 0;
  let costo = 0;
  const detalle = lineas.map((l) => {
    const bruto = centavos(Number(l.cantidad) * Number(l.precio));
    const neto = centavos(bruto * (1 - Number(l.descuento_pct) / 100) * (1 - descuentoGeneral / 100));
    subtotal += bruto;
    descuento += bruto - neto;
    if (l.exento) exento += neto;
    else if (exonerado) exoneradoTotal += neto;
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
    exonerado: centavos(exoneradoTotal),
    isv,
    total: centavos(exento + exoneradoTotal + gravado + isv),
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

/** Cantidad que todavía se puede devolver de una línea de factura. */
export const pendienteDevolver = (l: Pick<LineaAcreditable, "cantidad" | "devuelto">) => centavos(l.cantidad - l.devuelto);

/**
 * Totales de una nota de crédito o débito, igual que emitir_nota(): en una
 * devolución, la parte proporcional de cada línea (o lo que le queda si vuelve
 * todo); en lo demás, montos sin ISV. Lo gravado de una factura exonerada va
 * como exonerado.
 */
export function totalesNota(
  lineas: ({ linea: LineaAcreditable; cantidad: number } | { monto: number; exento: boolean })[],
  exonerada: boolean,
) {
  let exento = 0;
  let gravado = 0;
  let exonerado = 0;
  const netos = lineas.map((l) => {
    let neto = 0;
    let esExento: boolean;
    if ("linea" in l) {
      const { linea, cantidad } = l;
      if (cantidad > 0) {
        neto =
          cantidad === pendienteDevolver(linea)
            ? centavos(linea.total - linea.acreditado)
            : centavos((linea.total * cantidad) / linea.cantidad);
      }
      esExento = linea.exento;
    } else {
      neto = l.monto > 0 ? centavos(l.monto) : 0;
      esExento = l.exento;
    }
    if (esExento) exento += neto;
    else if (exonerada) exonerado += neto;
    else gravado += neto;
    return neto;
  });
  const isv = centavos(gravado * TASA_ISV);
  return {
    exento: centavos(exento),
    gravado: centavos(gravado),
    exonerado: centavos(exonerado),
    isv,
    total: centavos(exento + exonerado + gravado + isv),
    netos,
  };
}
