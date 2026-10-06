import { FORMAS_PAGO } from "../cobros";
import type { DefRecurso, Opcion } from "./tipos";

/** Compras (0021): proveedores, compras registradas, cuentas por pagar y pagos a proveedores. */

const SI_NO: readonly Opcion[] = [
  { valor: "true", etiqueta: "Sí" },
  { valor: "false", etiqueta: "No" },
];

const FORMAS: readonly Opcion[] = FORMAS_PAGO.map((f) => ({ valor: f.valor, etiqueta: f.etiqueta }));

const ESTADOS: readonly Opcion[] = [
  { valor: "emitido", etiqueta: "Vigente" },
  { valor: "anulado", etiqueta: "Anulado" },
];

export const TIPOS_COMPRA: readonly Opcion[] = [
  { valor: "inventario", etiqueta: "Productos" },
  { valor: "gasto", etiqueta: "Gasto" },
];

const CONDICIONES: readonly Opcion[] = [
  { valor: "contado", etiqueta: "Contado" },
  { valor: "credito", etiqueta: "Crédito" },
];

const ESTADOS_CUENTA: readonly Opcion[] = [
  { valor: "vencida", etiqueta: "Vencida" },
  { valor: "al_dia", etiqueta: "Al día" },
];

export const proveedores: DefRecurso = {
  id: "proveedores",
  nombre: "proveedor",
  nombrePlural: "Proveedores",
  vista: "v_proveedores",
  tabla: "proveedores",
  clave: "id",
  ambito: "empresa",
  escritura: "empresa",
  titulo: "nombre",
  orden: [{ columna: "nombre", dir: "asc" }],
  columnas: [
    { clave: "nombre", etiqueta: "Nombre", tipo: "texto", ancho: 260, buscable: true },
    { clave: "rtn", etiqueta: "RTN", tipo: "texto", ancho: 150, buscable: true, formato: "codigo" },
    { clave: "telefono", etiqueta: "Teléfono", tipo: "texto", ancho: 130, buscable: true },
    { clave: "contacto", etiqueta: "Contacto", tipo: "texto", ancho: 180, buscable: true },
    { clave: "correo", etiqueta: "Correo", tipo: "texto", ancho: 220, buscable: true, oculta: true },
    { clave: "dias_credito", etiqueta: "Plazo", tipo: "entero", ancho: 90, vacio: "Contado" },
    { clave: "compras", etiqueta: "Compras", tipo: "entero", ancho: 100 },
    { clave: "ultima_compra", etiqueta: "Última compra", tipo: "fecha", ancho: 150 },
    { clave: "saldo", etiqueta: "Le debés", tipo: "decimal", ancho: 130, formato: "moneda", vacio: "—" },
    { clave: "activo", etiqueta: "Activo", tipo: "booleano", ancho: 90, opciones: SI_NO, oculta: true },
  ],
  campos: [
    {
      nombre: "nombre",
      etiqueta: "Nombre o razón social",
      tipo: "texto",
      requerido: true,
      mayusculas: true,
      maxLargo: 160,
      placeholder: "DISTRIBUIDORA DE REPUESTOS S.A.",
      ancho: "completo",
    },
    {
      nombre: "rtn",
      etiqueta: "RTN",
      tipo: "texto",
      patron: "^\\d{4}-?\\d{4}-?\\d{6}$",
      mensajePatron: "Son 14 dígitos: 0801-1990-123456.",
      placeholder: "0801-1990-123456",
      ayuda: "El de sus facturas: sirve para el libro de compras.",
    },
    { nombre: "telefono", etiqueta: "Teléfono", tipo: "texto", maxLargo: 30, placeholder: "2222-0000" },
    { nombre: "contacto", etiqueta: "Contacto", tipo: "texto", maxLargo: 120, placeholder: "Vendedor que te atiende" },
    {
      nombre: "correo",
      etiqueta: "Correo",
      tipo: "texto",
      minusculas: true,
      maxLargo: 120,
      patron: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$",
      mensajePatron: "Correo no válido.",
    },
    { nombre: "direccion", etiqueta: "Dirección", tipo: "texto", maxLargo: 200, ancho: "completo" },
    {
      nombre: "dias_credito",
      etiqueta: "Plazo de crédito",
      tipo: "entero",
      sufijo: "días",
      min: 0,
      max: 365,
      porDefecto: 0,
      ayuda: "Cuántos días te da para pagar. 0 = le comprás de contado.",
    },
    { nombre: "notas", etiqueta: "Notas", tipo: "textoLargo", maxLargo: 500, ancho: "completo" },
    { nombre: "activo", etiqueta: "Activo", tipo: "booleano", porDefecto: true },
  ],
  mensajes: {
    duplicado: "Ya hay un proveedor con ese RTN.",
    enUso: "No se puede eliminar: el proveedor tiene compras. Desactivalo.",
  },
};

export const compras: DefRecurso = {
  id: "compras",
  nombre: "compra",
  nombrePlural: "Compras",
  genero: "f",
  vista: "v_compras",
  tabla: "compras",
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
    { clave: "fecha", etiqueta: "Fecha", tipo: "fecha", ancho: 120 },
    { clave: "numero", etiqueta: "Número", tipo: "texto", ancho: 130, buscable: true, formato: "codigo" },
    {
      clave: "tipo",
      etiqueta: "Tipo",
      tipo: "texto",
      ancho: 110,
      opciones: TIPOS_COMPRA,
      filtro: { tipo: "opciones", opciones: TIPOS_COMPRA },
    },
    { clave: "proveedor_nombre", etiqueta: "Proveedor", tipo: "texto", ancho: 240, buscable: true },
    { clave: "documento", etiqueta: "Factura del proveedor", tipo: "texto", ancho: 200, buscable: true, formato: "codigo" },
    { clave: "total", etiqueta: "Total", tipo: "decimal", ancho: 130, formato: "moneda" },
    { clave: "isv", etiqueta: "ISV", tipo: "decimal", ancho: 110, formato: "moneda", oculta: true },
    {
      clave: "condicion",
      etiqueta: "Condición",
      tipo: "texto",
      ancho: 110,
      opciones: CONDICIONES,
      filtro: { tipo: "opciones", opciones: CONDICIONES },
    },
    { clave: "pendiente", etiqueta: "Por pagar", tipo: "decimal", ancho: 130, formato: "moneda", vacio: "—" },
    { clave: "vence", etiqueta: "Vence", tipo: "fecha", ancho: 120, oculta: true },
    { clave: "forma_pago", etiqueta: "Forma", tipo: "texto", ancho: 120, opciones: FORMAS, oculta: true },
    {
      clave: "estado",
      etiqueta: "Estado",
      tipo: "texto",
      ancho: 110,
      opciones: ESTADOS,
      filtro: { tipo: "opciones", opciones: ESTADOS },
    },
    { clave: "registro", etiqueta: "Registró", tipo: "texto", ancho: 160, oculta: true },
  ],
  campos: [],
};

/** Proveedores a los que se les debe (v_cuentas_proveedores). Se abre el estado de cuenta. */
export const cuentasProveedores: DefRecurso = {
  id: "cuentas_proveedores",
  nombre: "cuenta",
  nombrePlural: "Cuentas por pagar",
  genero: "f",
  vista: "v_cuentas_proveedores",
  tabla: "proveedores",
  clave: "id",
  ambito: "empresa",
  escritura: "ninguna",
  acciones: { crear: false, editar: false, eliminar: false },
  titulo: "nombre",
  orden: [
    { columna: "vencido", dir: "desc" },
    { columna: "pendiente", dir: "desc" },
  ],
  columnasInternas: ["en_mora"],
  columnas: [
    { clave: "nombre", etiqueta: "Proveedor", tipo: "texto", ancho: 260, buscable: true },
    { clave: "rtn", etiqueta: "RTN", tipo: "texto", ancho: 150, buscable: true, formato: "codigo", oculta: true },
    { clave: "pendiente", etiqueta: "Le debés", tipo: "decimal", ancho: 140, formato: "moneda" },
    { clave: "vencido", etiqueta: "Vencido", tipo: "decimal", ancho: 130, formato: "moneda", vacio: "—", alerta: "en_mora" },
    { clave: "compras", etiqueta: "Compras", tipo: "entero", ancho: 100 },
    { clave: "proximo_vence", etiqueta: "Próximo vencimiento", tipo: "fecha", ancho: 170 },
    { clave: "ultimo_pago", etiqueta: "Último pago", tipo: "fecha", ancho: 140 },
    {
      clave: "estado",
      etiqueta: "Estado",
      tipo: "texto",
      ancho: 110,
      opciones: ESTADOS_CUENTA,
      filtro: { tipo: "opciones", opciones: ESTADOS_CUENTA },
    },
  ],
  campos: [],
};

export const pagosProveedores: DefRecurso = {
  id: "pagos_proveedores",
  nombre: "pago",
  nombrePlural: "Pagos a proveedores",
  vista: "v_pagos_proveedores",
  tabla: "pagos_proveedores",
  clave: "id",
  ambito: "empresa",
  escritura: "ninguna",
  acciones: { crear: false, editar: false, eliminar: false },
  titulo: "numero",
  orden: [{ columna: "fecha", dir: "desc" }],
  columnas: [
    { clave: "fecha", etiqueta: "Fecha", tipo: "fecha", ancho: 130 },
    { clave: "numero", etiqueta: "Pago", tipo: "texto", ancho: 120, buscable: true, formato: "codigo" },
    { clave: "proveedor_nombre", etiqueta: "Proveedor", tipo: "texto", ancho: 240, buscable: true },
    { clave: "monto", etiqueta: "Monto", tipo: "decimal", ancho: 130, formato: "moneda" },
    {
      clave: "forma_pago",
      etiqueta: "Forma",
      tipo: "texto",
      ancho: 130,
      opciones: FORMAS,
      filtro: { tipo: "opciones", opciones: FORMAS },
    },
    { clave: "de_caja", etiqueta: "De la caja", tipo: "booleano", ancho: 110, opciones: SI_NO, oculta: true },
    { clave: "referencia", etiqueta: "Referencia", tipo: "texto", ancho: 150, buscable: true },
    { clave: "compras", etiqueta: "Compras", tipo: "texto", ancho: 280, buscable: true, formato: "codigo" },
    {
      clave: "estado",
      etiqueta: "Estado",
      tipo: "texto",
      ancho: 110,
      opciones: ESTADOS,
      filtro: { tipo: "opciones", opciones: ESTADOS },
    },
    { clave: "pago", etiqueta: "Pagó", tipo: "texto", ancho: 160, oculta: true },
  ],
  campos: [],
};
