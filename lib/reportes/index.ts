import type { DefReporte } from "./tipos";

/** Ventas: facturas emitidas del período contra el período anterior de igual largo (0009). */
const ventas: DefReporte = {
  id: "ventas",
  titulo: "Reporte de ventas",
  descripcion: "Facturas emitidas en el período, comparadas con el período anterior del mismo largo.",
  funcion: "reporte_ventas",
  periodo: "30d",
  vacio: "No hay facturas en este período. Probá con un rango más amplio.",
  indicadores: [
    { clave: "ventas", etiqueta: "Ventas con ISV", formato: "moneda", destacado: true },
    { clave: "facturas", etiqueta: "Facturas", formato: "entero" },
    { clave: "ticket", etiqueta: "Ticket promedio", formato: "moneda" },
    { clave: "utilidad", etiqueta: "Utilidad", formato: "moneda", ayuda: "Ventas sin ISV menos el costo de lo vendido." },
    { clave: "margen", etiqueta: "Margen", formato: "porcentaje" },
    { clave: "isv", etiqueta: "ISV cobrado", formato: "moneda" },
    { clave: "descuentos", etiqueta: "Descuentos", formato: "moneda", inverso: true },
    { clave: "cotizado", etiqueta: "Cotizado", formato: "moneda" },
    { clave: "anuladas", etiqueta: "Anuladas", formato: "entero", inverso: true },
  ],
  serie: {
    clave: "ventas",
    etiqueta: "Ventas por día",
    formato: "moneda",
    secundaria: { clave: "facturas", etiqueta: "Facturas", formato: "entero" },
  },
  rankings: [
    {
      clave: "productos",
      titulo: "Lo más vendido",
      medida: "total",
      ancho: "completo",
      columnas: [
        { clave: "descripcion", etiqueta: "Producto", formato: "texto", principal: true },
        { clave: "codigo", etiqueta: "Código", formato: "codigo", secundaria: true },
        { clave: "cantidad", etiqueta: "Cant.", formato: "cantidad" },
        { clave: "utilidad", etiqueta: "Utilidad", formato: "moneda" },
        { clave: "total", etiqueta: "Vendido", formato: "moneda" },
      ],
    },
    {
      clave: "categorias",
      titulo: "Por categoría",
      medida: "total",
      columnas: [
        { clave: "nombre", etiqueta: "Categoría", formato: "texto", principal: true },
        { clave: "total", etiqueta: "Vendido", formato: "moneda" },
      ],
    },
    {
      clave: "vendedores",
      titulo: "Por vendedor",
      medida: "total",
      columnas: [
        { clave: "nombre", etiqueta: "Vendedor", formato: "texto", principal: true },
        { clave: "facturas", etiqueta: "Facturas", formato: "entero" },
        { clave: "total", etiqueta: "Vendido", formato: "moneda" },
      ],
    },
    {
      clave: "clientes",
      titulo: "Mejores clientes",
      medida: "total",
      columnas: [
        { clave: "nombre", etiqueta: "Cliente", formato: "texto", principal: true },
        { clave: "facturas", etiqueta: "Facturas", formato: "entero" },
        { clave: "total", etiqueta: "Comprado", formato: "moneda" },
      ],
    },
  ],
};

const REPORTES: Record<string, DefReporte> = { ventas };

export function obtenerReporte(id: string): DefReporte {
  const def = REPORTES[id];
  if (!def) throw new Error(`Reporte desconocido: ${id}`);
  return def;
}

export function existeReporte(id: string) {
  return id in REPORTES;
}
