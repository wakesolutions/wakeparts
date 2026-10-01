import type { DefRecurso, Opcion } from "./tipos";

/** Ventas: clientes, CAI y documentos emitidos (cotizaciones y facturas). */

const SI_NO: readonly Opcion[] = [
  { valor: "true", etiqueta: "Sí" },
  { valor: "false", etiqueta: "No" },
];

export const TIPOS_DOCUMENTO: readonly Opcion[] = [
  { valor: "cotizacion", etiqueta: "Cotización" },
  { valor: "factura", etiqueta: "Factura" },
];

export const ESTADOS_DOCUMENTO: readonly Opcion[] = [
  { valor: "emitido", etiqueta: "Emitido" },
  { valor: "anulado", etiqueta: "Anulado" },
];

const RTN = {
  patron: "^\\d{4}-?\\d{4}-?\\d{6}$",
  mensajePatron: "Son 14 dígitos: 0801-1990-123456.",
  placeholder: "0801-1990-123456",
} as const;

export const clientes: DefRecurso = {
  id: "clientes",
  nombre: "cliente",
  nombrePlural: "Clientes",
  vista: "v_clientes",
  tabla: "clientes",
  clave: "id",
  ambito: "empresa",
  escritura: "miembros",
  titulo: "nombre",
  orden: [{ columna: "nombre", dir: "asc" }],
  columnas: [
    { clave: "nombre", etiqueta: "Nombre", tipo: "texto", ancho: 260, buscable: true },
    { clave: "rtn", etiqueta: "RTN", tipo: "texto", ancho: 150, buscable: true, formato: "codigo" },
    { clave: "telefono", etiqueta: "Teléfono", tipo: "texto", ancho: 130, buscable: true },
    { clave: "correo", etiqueta: "Correo", tipo: "texto", ancho: 220, buscable: true, oculta: true },
    { clave: "direccion", etiqueta: "Dirección", tipo: "texto", ancho: 240, oculta: true },
    { clave: "facturas", etiqueta: "Facturas", tipo: "entero", ancho: 100 },
    { clave: "ultima_compra", etiqueta: "Último documento", tipo: "fecha", ancho: 160 },
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
      placeholder: "TRANSPORTES LÓPEZ S. DE R.L.",
      ancho: "completo",
    },
    { nombre: "rtn", etiqueta: "RTN", tipo: "texto", ...RTN, ayuda: "Para facturas con RTN." },
    { nombre: "telefono", etiqueta: "Teléfono", tipo: "texto", maxLargo: 30, placeholder: "9999-0000" },
    {
      nombre: "correo",
      etiqueta: "Correo",
      tipo: "texto",
      minusculas: true,
      maxLargo: 120,
      patron: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$",
      mensajePatron: "Correo no válido.",
    },
    { nombre: "direccion", etiqueta: "Dirección", tipo: "texto", maxLargo: 200 },
    { nombre: "notas", etiqueta: "Notas", tipo: "textoLargo", maxLargo: 500, ancho: "completo" },
    { nombre: "activo", etiqueta: "Activo", tipo: "booleano", porDefecto: true },
  ],
  mensajes: {
    duplicado: "Ya hay un cliente con ese RTN.",
    enUso: "No se puede eliminar: el cliente tiene documentos. Desactivalo.",
  },
};

export const cai: DefRecurso = {
  id: "cai",
  nombre: "CAI",
  nombrePlural: "CAI",
  vista: "v_cai",
  tabla: "cai",
  clave: "id",
  ambito: "empresa",
  escritura: "empresa",
  titulo: "cai",
  orden: [{ columna: "fecha_limite", dir: "desc" }],
  columnasInternas: ["tipo_documento"],
  columnas: [
    { clave: "cai", etiqueta: "CAI", tipo: "texto", ancho: 330, buscable: true, formato: "codigo" },
    { clave: "establecimiento", etiqueta: "Estab.", tipo: "texto", ancho: 90, formato: "codigo" },
    { clave: "punto_emision", etiqueta: "Punto", tipo: "texto", ancho: 90, formato: "codigo" },
    { clave: "rango_inicial", etiqueta: "Desde", tipo: "entero", ancho: 100 },
    { clave: "rango_final", etiqueta: "Hasta", tipo: "entero", ancho: 100 },
    { clave: "siguiente", etiqueta: "Siguiente", tipo: "entero", ancho: 110 },
    { clave: "disponibles", etiqueta: "Disponibles", tipo: "entero", ancho: 120 },
    { clave: "usado_pct", etiqueta: "Usado", tipo: "decimal", ancho: 100, formato: "porcentaje" },
    { clave: "fecha_limite", etiqueta: "Fecha límite", tipo: "fecha", ancho: 140 },
    { clave: "dias_restantes", etiqueta: "Días", tipo: "entero", ancho: 90 },
    { clave: "vigente", etiqueta: "Vigente", tipo: "booleano", ancho: 100, opciones: SI_NO },
    { clave: "activo", etiqueta: "Activo", tipo: "booleano", ancho: 90, opciones: SI_NO, oculta: true },
  ],
  campos: [
    {
      nombre: "cai",
      etiqueta: "CAI",
      tipo: "texto",
      requerido: true,
      mayusculas: true,
      maxLargo: 40,
      patron: "^[0-9A-Fa-f]{6}-?[0-9A-Fa-f]{6}-?[0-9A-Fa-f]{6}-?[0-9A-Fa-f]{6}-?[0-9A-Fa-f]{6}-?[0-9A-Fa-f]{2}$",
      mensajePatron: "Son 32 caracteres: 35BD6A-0195F4-B34BAA-8B7D13-37F5E8-2D.",
      placeholder: "35BD6A-0195F4-B34BAA-8B7D13-37F5E8-2D",
      ancho: "completo",
      ayuda: "Como aparece en la resolución del SAR.",
    },
    {
      nombre: "establecimiento",
      etiqueta: "Establecimiento",
      tipo: "texto",
      requerido: true,
      patron: "^\\d{1,3}$",
      mensajePatron: "Hasta 3 dígitos.",
      porDefecto: "000",
      maxLargo: 3,
    },
    {
      nombre: "punto_emision",
      etiqueta: "Punto de emisión",
      tipo: "texto",
      requerido: true,
      patron: "^\\d{1,3}$",
      mensajePatron: "Hasta 3 dígitos.",
      porDefecto: "001",
      maxLargo: 3,
    },
    { nombre: "rango_inicial", etiqueta: "Rango desde", tipo: "entero", requerido: true, min: 1, max: 99999999, placeholder: "1" },
    { nombre: "rango_final", etiqueta: "Rango hasta", tipo: "entero", requerido: true, min: 1, max: 99999999, placeholder: "500" },
    {
      nombre: "siguiente",
      etiqueta: "Siguiente número a usar",
      tipo: "entero",
      soloAlCrear: true,
      min: 1,
      max: 99999999,
      placeholder: "El primero del rango",
      ayuda: "Si ya facturaste con este CAI en otro sistema, poné el siguiente libre.",
    },
    { nombre: "fecha_limite", etiqueta: "Fecha límite de emisión", tipo: "fecha", requerido: true },
    { nombre: "activo", etiqueta: "Activo", tipo: "booleano", porDefecto: true },
  ],
  mensajes: {
    duplicado: "Ese CAI ya está registrado.",
    enUso: "No se puede eliminar: ya hay facturas con este CAI. Desactivalo.",
  },
};

export const documentos: DefRecurso = {
  id: "documentos",
  nombre: "documento",
  nombrePlural: "Documentos",
  vista: "v_documentos",
  tabla: "documentos",
  clave: "id",
  ambito: "empresa",
  escritura: "ninguna",
  acciones: { crear: false, editar: false, eliminar: false },
  titulo: "numero",
  orden: [{ columna: "fecha", dir: "desc" }],
  columnas: [
    { clave: "fecha", etiqueta: "Fecha", tipo: "fecha", ancho: 130 },
    {
      clave: "tipo",
      etiqueta: "Tipo",
      tipo: "texto",
      ancho: 120,
      opciones: TIPOS_DOCUMENTO,
      filtro: { tipo: "opciones", opciones: TIPOS_DOCUMENTO },
    },
    { clave: "numero", etiqueta: "Número", tipo: "texto", ancho: 200, buscable: true, formato: "codigo" },
    { clave: "cliente_nombre", etiqueta: "Cliente", tipo: "texto", ancho: 240, buscable: true },
    { clave: "cliente_rtn", etiqueta: "RTN", tipo: "texto", ancho: 150, buscable: true, formato: "codigo" },
    { clave: "vehiculo", etiqueta: "Vehículo", tipo: "texto", ancho: 220, buscable: true },
    { clave: "total", etiqueta: "Total", tipo: "decimal", ancho: 130, formato: "moneda" },
    { clave: "isv", etiqueta: "ISV", tipo: "decimal", ancho: 110, formato: "moneda", oculta: true },
    { clave: "descuento", etiqueta: "Descuento", tipo: "decimal", ancho: 120, formato: "moneda", oculta: true },
    {
      clave: "estado",
      etiqueta: "Estado",
      tipo: "texto",
      ancho: 110,
      opciones: ESTADOS_DOCUMENTO,
      filtro: { tipo: "opciones", opciones: ESTADOS_DOCUMENTO },
    },
    { clave: "vence", etiqueta: "Vence", tipo: "fecha", ancho: 120, oculta: true },
    { clave: "vendedor", etiqueta: "Vendedor", tipo: "texto", ancho: 160, buscable: true },
  ],
  campos: [],
};

export const ESTADOS_PEDIDO_WEB: readonly Opcion[] = [
  { valor: "nuevo", etiqueta: "Nuevo" },
  { valor: "atendido", etiqueta: "Atendido" },
  { valor: "descartado", etiqueta: "Descartado" },
];

/** Pedidos del sitio público (0013). Se crean desde /t/<slug>; aquí solo se leen y atienden. */
export const pedidosWeb: DefRecurso = {
  id: "pedidos_web",
  nombre: "pedido web",
  nombrePlural: "Pedidos web",
  vista: "v_pedidos_web",
  tabla: "pedidos_web",
  clave: "id",
  ambito: "empresa",
  escritura: "ninguna",
  acciones: { crear: false, editar: false, eliminar: false },
  titulo: "numero",
  orden: [{ columna: "creado_en", dir: "desc" }],
  columnas: [
    { clave: "numero", etiqueta: "N.º", tipo: "entero", ancho: 80 },
    { clave: "creado_en", etiqueta: "Recibido", tipo: "fecha", ancho: 150 },
    {
      clave: "estado",
      etiqueta: "Estado",
      tipo: "texto",
      ancho: 120,
      opciones: ESTADOS_PEDIDO_WEB,
      filtro: { tipo: "opciones", opciones: ESTADOS_PEDIDO_WEB },
    },
    { clave: "cliente_nombre", etiqueta: "Cliente", tipo: "texto", ancho: 220, buscable: true },
    { clave: "cliente_telefono", etiqueta: "Teléfono", tipo: "texto", ancho: 130, buscable: true, formato: "codigo" },
    { clave: "vehiculo", etiqueta: "Vehículo", tipo: "texto", ancho: 220, buscable: true },
    { clave: "lineas", etiqueta: "Piezas", tipo: "entero", ancho: 90 },
    { clave: "total_estimado", etiqueta: "Estimado", tipo: "decimal", ancho: 130, formato: "moneda" },
    { clave: "atendido_por", etiqueta: "Atendió", tipo: "texto", ancho: 160, oculta: true },
    { clave: "mensaje", etiqueta: "Mensaje", tipo: "texto", ancho: 260, oculta: true },
  ],
  campos: [],
};
