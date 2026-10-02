import type { DefRecurso, Opcion } from "./tipos";

/** Caja (0018): turnos por punto de emisión. Se abren y cierran desde el módulo Caja. */

const ESTADOS_TURNO: readonly Opcion[] = [
  { valor: "abierta", etiqueta: "Abierta" },
  { valor: "cerrada", etiqueta: "Cerrada" },
];

export const cajasTurnos: DefRecurso = {
  id: "cajas_turnos",
  nombre: "turno",
  nombrePlural: "Turnos",
  vista: "v_cajas_turnos",
  tabla: "cajas_turnos",
  clave: "id",
  ambito: "empresa",
  escritura: "ninguna",
  acciones: { crear: false, editar: false, eliminar: false },
  titulo: "numero",
  orden: [{ columna: "abierta_en", dir: "desc" }],
  columnas: [
    { clave: "numero", etiqueta: "Turno", tipo: "entero", ancho: 90 },
    { clave: "punto", etiqueta: "Caja", tipo: "texto", ancho: 220, buscable: true },
    {
      clave: "estado",
      etiqueta: "Estado",
      tipo: "texto",
      ancho: 110,
      opciones: ESTADOS_TURNO,
      filtro: { tipo: "opciones", opciones: ESTADOS_TURNO },
    },
    { clave: "abierta_en", etiqueta: "Apertura", tipo: "fecha", formato: "fechaHora", ancho: 190 },
    { clave: "abierta_por", etiqueta: "Abrió", tipo: "texto", ancho: 150, buscable: true },
    { clave: "cerrada_en", etiqueta: "Cierre", tipo: "fecha", formato: "fechaHora", ancho: 190 },
    { clave: "cerrada_por", etiqueta: "Cerró", tipo: "texto", ancho: 150, oculta: true },
    { clave: "facturas", etiqueta: "Ventas", tipo: "entero", ancho: 90 },
    { clave: "total_cobrado", etiqueta: "Cobrado", tipo: "decimal", ancho: 130, formato: "moneda" },
    { clave: "fondo_inicial", etiqueta: "Fondo", tipo: "decimal", ancho: 110, formato: "moneda", oculta: true },
    { clave: "efectivo_esperado", etiqueta: "Esperado", tipo: "decimal", ancho: 130, formato: "moneda" },
    { clave: "efectivo_contado", etiqueta: "Contado", tipo: "decimal", ancho: 130, formato: "moneda" },
    { clave: "diferencia", etiqueta: "Diferencia", tipo: "decimal", ancho: 120, formato: "moneda", alerta: "descuadre" },
    { clave: "notas", etiqueta: "Nota", tipo: "texto", ancho: 240, oculta: true },
  ],
  columnasInternas: ["descuadre"],
  campos: [],
};
