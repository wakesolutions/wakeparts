/**
 * Exportación de todos los datos propios de una empresa (Taller › Exportar
 * datos): un .zip con un Excel por tema. La portabilidad la promete el
 * contrato (cláusula novena). Compartido por el servidor, la demo y la UI.
 */

/** Una hoja: de qué vista o tabla sale y con qué nombre de archivo. */
export type FuenteExportacion = {
  archivo: string;
  /** Vista o tabla, siempre filtrada por la empresa (RLS además). */
  fuente: string;
  /** Selección de PostgREST; con relaciones para traer números legibles. */
  seleccion?: string;
  orden?: string;
  /** La fila de la empresa se busca por `id`, no por `id_empresa`. */
  porId?: boolean;
  descripcion: string;
};

export const FUENTES_EXPORTACION: readonly FuenteExportacion[] = [
  { archivo: "01 Empresa", fuente: "empresas", porId: true, descripcion: "Datos del taller, apariencia y formato de documentos." },
  { archivo: "02 Usuarios", fuente: "v_miembros", orden: "nombre", descripcion: "Personas con acceso, rol y punto de emisión." },
  { archivo: "03 Puntos de emision", fuente: "v_puntos_emision", orden: "codigo", descripcion: "Sucursales y cajas." },
  { archivo: "04 CAI", fuente: "v_cai", orden: "fecha_limite", descripcion: "Rangos autorizados por el SAR." },
  { archivo: "05 Productos", fuente: "v_productos", orden: "codigo", descripcion: "Inventario con costos, precios y existencias." },
  { archivo: "06 Compatibilidades", fuente: "v_productos_compatibilidades", descripcion: "Qué producto le queda a qué vehículo." },
  { archivo: "07 Kardex", fuente: "v_movimientos_inventario", orden: "creado_en", descripcion: "Entradas y salidas de inventario." },
  { archivo: "08 Categorias propias", fuente: "v_categorias", orden: "ruta", descripcion: "Categorías creadas por el taller." },
  { archivo: "09 Marcas propias", fuente: "v_marcas_productos", orden: "nombre", descripcion: "Marcas de repuestos creadas por el taller." },
  { archivo: "10 Fotos", fuente: "productos_imagenes", seleccion: "*, productos(codigo, nombre)", descripcion: "Lista de fotos de productos con su ruta." },
  { archivo: "11 Clientes", fuente: "v_clientes", orden: "nombre", descripcion: "Clientes, RTN, exoneración y crédito." },
  { archivo: "12 Documentos", fuente: "documentos", orden: "fecha", descripcion: "Cotizaciones, facturas y notas de crédito y débito." },
  {
    archivo: "13 Lineas de documentos",
    fuente: "documentos_lineas",
    seleccion: "*, documentos(numero, tipo, fecha)",
    descripcion: "Detalle de cada documento.",
  },
  { archivo: "14 Cuentas por cobrar", fuente: "v_cuentas_cobrar", orden: "vence", descripcion: "Facturas al crédito con lo pendiente." },
  { archivo: "15 Abonos", fuente: "pagos", orden: "fecha", descripcion: "Recibos de abono." },
  {
    archivo: "16 Abonos por factura",
    fuente: "pagos_aplicaciones",
    seleccion: "*, pagos(numero, fecha), documentos(numero)",
    descripcion: "Cómo se repartió cada abono.",
  },
  { archivo: "17 Turnos de caja", fuente: "cajas_turnos", orden: "abierta_en", descripcion: "Aperturas, cierres y arqueos." },
  {
    archivo: "18 Entradas y salidas de caja",
    fuente: "cajas_movimientos",
    seleccion: "*, cajas_turnos(numero)",
    orden: "creado_en",
    descripcion: "Movimientos manuales de efectivo.",
  },
  { archivo: "19 Pedidos web", fuente: "pedidos_web", orden: "creado_en", descripcion: "Pedidos recibidos desde el sitio del taller." },
  {
    archivo: "20 Lineas de pedidos web",
    fuente: "pedidos_web_lineas",
    seleccion: "*, pedidos_web(numero)",
    descripcion: "Piezas de cada pedido web.",
  },
];

/** Columnas internas que no le sirven a nadie fuera del sistema. */
export const COLUMNAS_OMITIDAS = new Set(["id_empresa", "texto_busqueda", "codigos"]);

export type HojaExportada = { archivo: string; filas: Record<string, unknown>[] };

export type DatosExportacion = { empresa: string; generado: string; hojas: HojaExportada[] };

const fechaHora = new Intl.DateTimeFormat("es-HN", {
  timeZone: "America/Tegucigalpa",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const ISO_FECHA_HORA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const ISO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Valor de celda legible: fechas en hora de Honduras, JSON como texto. */
export function valorCelda(v: unknown): string | number | boolean | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" || typeof v === "boolean") return v;
  if (typeof v === "string") {
    if (ISO_FECHA_HORA.test(v)) return fechaHora.format(new Date(v));
    if (ISO_FECHA.test(v)) return v.split("-").reverse().join("/");
    return v;
  }
  return JSON.stringify(v);
}

/** Aplana relaciones de PostgREST: { documentos: { numero } } → documentos_numero. */
export function aplanar(fila: Record<string, unknown>): Record<string, unknown> {
  const plano: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fila)) {
    if (COLUMNAS_OMITIDAS.has(k)) continue;
    if (v && typeof v === "object" && !Array.isArray(v) && !(k === "emisor" || k === "exoneracion" || k === "resumen" || k === "arqueo" || k === "sitio" || k === "formato_documento")) {
      for (const [k2, v2] of Object.entries(v as Record<string, unknown>)) plano[`${k}_${k2}`] = v2;
    } else {
      plano[k] = v;
    }
  }
  return plano;
}

/** «precio_final» → «Precio final». */
export const encabezado = (clave: string) => {
  const t = clave.replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export function leeme(datos: DatosExportacion): string {
  const lineas = [
    `Exportación de datos de ${datos.empresa}`,
    `Generada: ${fechaHora.format(new Date(datos.generado))} (hora de Honduras)`,
    "",
    "Cada archivo de Excel tiene un tema. Los números de documento, de pedido y de turno",
    "permiten relacionar unos con otros (por ejemplo, las líneas con su factura).",
    "",
    ...datos.hojas.map((h) => {
      const f = FUENTES_EXPORTACION.find((x) => x.archivo === h.archivo);
      return `${h.archivo}.xlsx (${h.filas.length} filas): ${f?.descripcion ?? ""}`;
    }),
    "",
    "Las fotos no van en este archivo: la hoja «10 Fotos» lista la ruta de cada una.",
    "Wake Parts · ventas@wake.solutions",
  ];
  return lineas.join("\r\n");
}
