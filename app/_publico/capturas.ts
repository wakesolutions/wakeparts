/**
 * Capturas reales de la app para la landing (public/capturas, sacadas del
 * sandbox con datos de ejemplo). Las usa la vitrina y el JSON-LD de la portada.
 */
export const CAPTURAS = [
  {
    id: "mostrador",
    pestana: "Mostrador",
    titulo: "Cotizar y facturar",
    texto: "El vehículo arriba, lo que le queda primero, lo que hay que verificar en ámbar y el total con ISV siempre a la vista.",
    src: "/capturas/mostrador.webp",
    ancho: 1920,
    alto: 1200,
    alt: "Pantalla de cotizar y facturar de Wake Parts: búsqueda de repuestos para un Toyota Corolla 2005 y carrito con total de L 1,403.00",
  },
  {
    id: "factura",
    pestana: "Factura CAI",
    titulo: "Factura con CAI",
    texto: "Numeración correlativa, rango y fecha límite del CAI, RTN, ISV 15 % y total en letras. Lista para imprimir o PDF.",
    src: "/capturas/documento.webp",
    ancho: 1200,
    alto: 1120,
    alt: "Factura de ejemplo emitida con Wake Parts con CAI, rango autorizado, fecha límite, desglose de ISV 15 % y total en letras",
  },
  {
    id: "reporte",
    pestana: "Reporte",
    titulo: "Reporte de ventas",
    texto: "Ventas, utilidad y margen contra el período anterior, ventas por día y lo más vendido. Exportable a Excel.",
    src: "/capturas/reporte.webp",
    ancho: 1920,
    alto: 1200,
    alt: "Reporte de ventas de Wake Parts con ventas del período, utilidad, margen, gráfico de ventas por día y productos más vendidos",
  },
  {
    id: "vehiculos",
    pestana: "Vehículos",
    titulo: "Qué le queda a cada pieza",
    texto: "Marcá marca, modelo, años o motor. Más de 16 000 versiones de vehículos ya cargadas.",
    src: "/capturas/compatibilidad.webp",
    ancho: 1600,
    alto: 893,
    alt: "Editor de compatibilidad de Wake Parts: repuesto asignado a Toyota Corolla 2003 a 2008 con columnas de marca, modelo, año y motor",
  },
  {
    id: "celular",
    pestana: "Celular",
    titulo: "También en el celular",
    texto: "El mismo mostrador en el teléfono, sin instalar nada. Para cuando andás en la bodega o fuera del negocio.",
    src: "/capturas/celular.webp",
    ancho: 780,
    alto: 1504,
    alt: "Wake Parts en un celular: búsqueda de repuestos por vehículo con precios y existencias",
  },
] as const;
