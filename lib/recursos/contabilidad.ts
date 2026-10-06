import { CLAVES_CUENTA, ORIGENES, TIPOS_CUENTA } from "../contabilidad";
import type { DefRecurso, Opcion } from "./tipos";

/** Contabilidad (0022): catálogo de cuentas y asientos. */

const SI_NO: readonly Opcion[] = [
  { valor: "true", etiqueta: "Sí" },
  { valor: "false", etiqueta: "No" },
];

const TIPOS: readonly Opcion[] = TIPOS_CUENTA;
const CLAVES: readonly Opcion[] = CLAVES_CUENTA;
const NATURALEZAS: readonly Opcion[] = [
  { valor: "deudora", etiqueta: "Deudora" },
  { valor: "acreedora", etiqueta: "Acreedora" },
];
const ORIGEN: readonly Opcion[] = Object.entries(ORIGENES).map(([valor, etiqueta]) => ({ valor, etiqueta }));

export const cuentasContables: DefRecurso = {
  id: "cuentas_contables",
  nombre: "cuenta",
  nombrePlural: "Catálogo de cuentas",
  genero: "f",
  vista: "v_cuentas_contables",
  tabla: "cuentas_contables",
  clave: "id",
  ambito: "empresa",
  escritura: "empresa",
  titulo: ["codigo", "nombre"],
  orden: [{ columna: "codigo", dir: "asc" }],
  columnasInternas: ["etiqueta", "id_padre", "nivel"],
  columnas: [
    { clave: "codigo", etiqueta: "Código", tipo: "texto", ancho: 120, buscable: true, formato: "codigo" },
    { clave: "nombre", etiqueta: "Cuenta", tipo: "texto", ancho: 300, buscable: true },
    { clave: "tipo", etiqueta: "Tipo", tipo: "texto", ancho: 120, opciones: TIPOS, filtro: { tipo: "opciones", opciones: TIPOS } },
    { clave: "naturaleza", etiqueta: "Naturaleza", tipo: "texto", ancho: 120, opciones: NATURALEZAS, oculta: true },
    { clave: "padre", etiqueta: "Pertenece a", tipo: "texto", ancho: 240, buscable: true, oculta: true },
    { clave: "es_grupo", etiqueta: "Grupo", tipo: "booleano", ancho: 90, opciones: SI_NO },
    {
      clave: "clave",
      etiqueta: "La usa el sistema para",
      tipo: "texto",
      ancho: 260,
      opciones: CLAVES,
      filtro: { tipo: "opciones", opciones: CLAVES },
      vacio: "—",
    },
    { clave: "saldo", etiqueta: "Saldo", tipo: "decimal", ancho: 140, formato: "moneda", vacio: "—" },
    { clave: "activo", etiqueta: "Activa", tipo: "booleano", ancho: 90, opciones: SI_NO, oculta: true },
  ],
  campos: [
    {
      nombre: "codigo",
      etiqueta: "Código",
      tipo: "texto",
      requerido: true,
      maxLargo: 12,
      patron: "^\\d{1,12}$",
      mensajePatron: "Solo números: 6105, 610501…",
      placeholder: "610501",
      ayuda: "Que empiece con el código de su cuenta madre: así se ordena el catálogo.",
    },
    { nombre: "nombre", etiqueta: "Nombre", tipo: "texto", requerido: true, maxLargo: 120, placeholder: "Publicidad" },
    { nombre: "tipo", etiqueta: "Tipo", tipo: "opciones", requerido: true, opciones: TIPOS, porDefecto: "gasto", presentacion: "segmentos", ancho: "completo" },
    {
      nombre: "id_padre",
      etiqueta: "Pertenece a",
      tipo: "relacion",
      relacion: { recurso: "cuentas_contables", valor: "id", etiqueta: "etiqueta" },
      ancho: "completo",
      ayuda: "La cuenta de grupo donde va (6 Gastos, 1101 Efectivo…). Vacío = cuenta principal.",
    },
    {
      nombre: "naturaleza",
      etiqueta: "Naturaleza",
      tipo: "opciones",
      opciones: NATURALEZAS,
      ayuda: "Vacío = la del tipo (activo, costo y gasto: deudora). Cambiala solo en contracuentas (depreciación acumulada).",
    },
    {
      nombre: "clave",
      etiqueta: "La usa el sistema para",
      tipo: "opciones",
      opciones: CLAVES,
      ayuda: "Para que los asientos automáticos usen esta cuenta. Cada uso va en una sola cuenta.",
    },
    { nombre: "activo", etiqueta: "Activa", tipo: "booleano", porDefecto: true },
  ],
  mensajes: {
    duplicado: "Ya hay una cuenta con ese código (o ese uso del sistema ya está en otra cuenta).",
    enUso: "No se puede eliminar: la cuenta tiene movimientos o subcuentas. Desactivala.",
  },
};

export const asientos: DefRecurso = {
  id: "asientos",
  nombre: "asiento",
  nombrePlural: "Asientos",
  vista: "v_asientos",
  tabla: "asientos",
  clave: "id",
  ambito: "empresa",
  escritura: "ninguna",
  acciones: { crear: false, editar: false, eliminar: false },
  titulo: "numero",
  orden: [
    { columna: "fecha", dir: "desc" },
    { columna: "numero", dir: "desc" },
  ],
  columnas: [
    { clave: "numero", etiqueta: "N.º", tipo: "entero", ancho: 90 },
    { clave: "fecha", etiqueta: "Fecha", tipo: "fecha", ancho: 120 },
    { clave: "concepto", etiqueta: "Concepto", tipo: "texto", ancho: 380, buscable: true },
    { clave: "origen", etiqueta: "Origen", tipo: "texto", ancho: 150, opciones: ORIGEN, filtro: { tipo: "opciones", opciones: ORIGEN } },
    { clave: "referencia", etiqueta: "Referencia", tipo: "texto", ancho: 190, buscable: true, formato: "codigo" },
    { clave: "total", etiqueta: "Total", tipo: "decimal", ancho: 130, formato: "moneda" },
    { clave: "lineas", etiqueta: "Líneas", tipo: "entero", ancho: 90, oculta: true },
    { clave: "es_reversa", etiqueta: "Reversa", tipo: "booleano", ancho: 100, opciones: SI_NO, oculta: true },
    { clave: "revertido", etiqueta: "Revertido", tipo: "booleano", ancho: 110, opciones: SI_NO },
    { clave: "registro", etiqueta: "Registró", tipo: "texto", ancho: 150, oculta: true },
  ],
  campos: [],
};
