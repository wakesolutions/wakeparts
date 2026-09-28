import type { DefRecurso, Opcion } from "./tipos";

/** Catálogo global de vehículos. Lectura pública, escritura: admin de plataforma. */

const POSICIONES: readonly Opcion[] = [
  { valor: "L", etiqueta: "En línea" },
  { valor: "V", etiqueta: "En V" },
  { valor: "H", etiqueta: "Bóxer" },
];

const texto = { tipo: "texto" as const, mayusculas: true, requerido: true, maxLargo: 80 };

export const marcas: DefRecurso = {
  id: "marcas",
  nombre: "marca",
  nombrePlural: "Marcas",
  genero: "f",
  vista: "v_marcas",
  tabla: "marcas",
  clave: "id",
  escritura: "admin_plataforma",
  titulo: "marca",
  orden: [{ columna: "marca", dir: "asc" }],
  columnas: [
    { clave: "id", etiqueta: "ID", tipo: "entero", ancho: 80, oculta: true, formato: "codigo" },
    { clave: "marca", etiqueta: "Marca", tipo: "texto", ancho: 260, buscable: true },
    { clave: "modelos", etiqueta: "Modelos", tipo: "entero", ancho: 120, formato: "miles" },
  ],
  campos: [{ nombre: "marca", etiqueta: "Marca", ...texto, placeholder: "TOYOTA" }],
  mensajes: {
    duplicado: "Esa marca ya existe.",
    enUso: "No se puede eliminar: la marca tiene modelos. Eliminá o mové esos modelos primero.",
  },
};

export const modelos: DefRecurso = {
  id: "modelos",
  nombre: "modelo",
  nombrePlural: "Modelos",
  vista: "v_modelos",
  tabla: "modelos",
  clave: "id",
  escritura: "admin_plataforma",
  titulo: ["marca", "modelo"],
  orden: [
    { columna: "marca", dir: "asc" },
    { columna: "modelo", dir: "asc" },
  ],
  columnasInternas: ["id_marca"],
  columnas: [
    { clave: "id", etiqueta: "ID", tipo: "entero", ancho: 80, oculta: true, formato: "codigo" },
    {
      clave: "marca",
      etiqueta: "Marca",
      tipo: "texto",
      ancho: 180,
      buscable: true,
      filtro: { tipo: "opciones", fuente: { recurso: "marcas", valor: "marca", etiqueta: "marca" } },
    },
    { clave: "modelo", etiqueta: "Modelo", tipo: "texto", ancho: 240, buscable: true },
    { clave: "anios", etiqueta: "Años", tipo: "entero", ancho: 100, formato: "miles" },
    { clave: "anio_desde", etiqueta: "Desde", tipo: "entero", ancho: 100, formato: "anio" },
    { clave: "anio_hasta", etiqueta: "Hasta", tipo: "entero", ancho: 100, formato: "anio" },
  ],
  campos: [
    {
      nombre: "id_marca",
      etiqueta: "Marca",
      tipo: "relacion",
      requerido: true,
      relacion: { recurso: "marcas", valor: "id", etiqueta: "marca" },
    },
    { nombre: "modelo", etiqueta: "Modelo", ...texto, placeholder: "COROLLA" },
  ],
  mensajes: {
    duplicado: "Esa marca ya tiene un modelo con ese nombre.",
    enUso: "No se puede eliminar: el modelo tiene años registrados.",
  },
};

export const modelosAnios: DefRecurso = {
  id: "modelos_anios",
  nombre: "año",
  nombrePlural: "Años",
  vista: "v_modelos_anios",
  tabla: "modelos_anios",
  clave: "id",
  escritura: "admin_plataforma",
  titulo: ["marca", "modelo", "anio"],
  orden: [
    { columna: "marca", dir: "asc" },
    { columna: "modelo", dir: "asc" },
    { columna: "anio", dir: "asc" },
  ],
  columnasInternas: ["id_marca", "id_modelo"],
  columnas: [
    { clave: "id", etiqueta: "ID", tipo: "entero", ancho: 80, oculta: true, formato: "codigo" },
    {
      clave: "marca",
      etiqueta: "Marca",
      tipo: "texto",
      ancho: 170,
      buscable: true,
      filtro: { tipo: "opciones", fuente: { recurso: "marcas", valor: "marca", etiqueta: "marca" } },
    },
    { clave: "modelo", etiqueta: "Modelo", tipo: "texto", ancho: 220, buscable: true },
    { clave: "anio", etiqueta: "Año", tipo: "entero", ancho: 100, buscable: true, formato: "anio" },
    { clave: "especificaciones", etiqueta: "Especificaciones", tipo: "entero", ancho: 150, formato: "miles" },
  ],
  campos: [
    {
      nombre: "id_marca",
      etiqueta: "Marca",
      tipo: "relacion",
      requerido: true,
      guardar: false,
      relacion: { recurso: "marcas", valor: "id", etiqueta: "marca" },
    },
    {
      nombre: "id_modelo",
      etiqueta: "Modelo",
      tipo: "relacion",
      requerido: true,
      relacion: {
        recurso: "modelos",
        valor: "id",
        etiqueta: "modelo",
        dependeDe: { campo: "id_marca", columna: "id_marca" },
      },
    },
    { nombre: "anio", etiqueta: "Año", tipo: "entero", requerido: true, min: 1900, max: 2100, placeholder: "2008" },
  ],
  mensajes: {
    duplicado: "Ese modelo ya tiene ese año.",
    enUso: "No se puede eliminar: el año tiene especificaciones.",
  },
};

export const tiposCarrocerias: DefRecurso = {
  id: "tipos_carrocerias",
  nombre: "carrocería",
  nombrePlural: "Carrocerías",
  genero: "f",
  vista: "v_tipos_carrocerias",
  tabla: "tipos_carrocerias",
  clave: "id",
  escritura: "admin_plataforma",
  titulo: "carroceria",
  orden: [{ columna: "carroceria", dir: "asc" }],
  columnas: [
    { clave: "id", etiqueta: "ID", tipo: "entero", ancho: 80, oculta: true, formato: "codigo" },
    { clave: "carroceria", etiqueta: "Carrocería", tipo: "texto", ancho: 240, buscable: true },
    { clave: "especificaciones", etiqueta: "Especificaciones", tipo: "entero", ancho: 150, formato: "miles" },
  ],
  campos: [{ nombre: "carroceria", etiqueta: "Carrocería", ...texto, maxLargo: 40, placeholder: "PICKUP" }],
  mensajes: {
    duplicado: "Esa carrocería ya existe.",
    enUso: "No se puede eliminar: hay especificaciones con esta carrocería.",
  },
};

export const especificaciones: DefRecurso = {
  id: "especificaciones",
  nombre: "especificación",
  nombrePlural: "Especificaciones",
  genero: "f",
  vista: "v_especificaciones",
  tabla: "especificaciones",
  clave: "id",
  escritura: "admin_plataforma",
  titulo: ["marca", "modelo", "anio"],
  orden: [
    { columna: "marca", dir: "asc" },
    { columna: "modelo", dir: "asc" },
    { columna: "anio", dir: "asc" },
  ],
  columnasInternas: ["id_marca", "id_modelo", "id_modelo_anio", "id_tipo_carroceria"],
  columnas: [
    { clave: "id", etiqueta: "ID", tipo: "entero", ancho: 80, oculta: true, formato: "codigo" },
    {
      clave: "marca",
      etiqueta: "Marca",
      tipo: "texto",
      ancho: 150,
      buscable: true,
      filtro: { tipo: "opciones", fuente: { recurso: "marcas", valor: "marca", etiqueta: "marca" } },
    },
    { clave: "modelo", etiqueta: "Modelo", tipo: "texto", ancho: 190, buscable: true },
    { clave: "anio", etiqueta: "Año", tipo: "entero", ancho: 90, buscable: true, formato: "anio" },
    {
      clave: "carroceria",
      etiqueta: "Carrocería",
      tipo: "texto",
      ancho: 150,
      filtro: {
        tipo: "opciones",
        fuente: { recurso: "tipos_carrocerias", valor: "carroceria", etiqueta: "carroceria" },
      },
    },
    { clave: "motor_litros", etiqueta: "Motor", tipo: "decimal", ancho: 100, formato: "litros" },
    { clave: "motor_cc", etiqueta: "Cilindrada", tipo: "entero", ancho: 120, formato: "cc", oculta: true },
    { clave: "motor_numero_cilindros", etiqueta: "Cilindros", tipo: "entero", ancho: 110 },
    {
      clave: "motor_posicion_cilindros",
      etiqueta: "Posición",
      tipo: "texto",
      ancho: 120,
      opciones: POSICIONES,
      filtro: { tipo: "opciones", opciones: POSICIONES },
    },
    { clave: "motor_numero", etiqueta: "Código motor", tipo: "texto", ancho: 150, buscable: true, formato: "codigo" },
  ],
  campos: [
    {
      nombre: "id_marca",
      etiqueta: "Marca",
      tipo: "relacion",
      requerido: true,
      guardar: false,
      relacion: { recurso: "marcas", valor: "id", etiqueta: "marca" },
    },
    {
      nombre: "id_modelo",
      etiqueta: "Modelo",
      tipo: "relacion",
      requerido: true,
      guardar: false,
      relacion: {
        recurso: "modelos",
        valor: "id",
        etiqueta: "modelo",
        dependeDe: { campo: "id_marca", columna: "id_marca" },
      },
    },
    {
      nombre: "id_modelo_anio",
      etiqueta: "Año",
      tipo: "relacion",
      requerido: true,
      relacion: {
        recurso: "modelos_anios",
        valor: "id",
        etiqueta: "anio",
        dependeDe: { campo: "id_modelo", columna: "id_modelo" },
      },
    },
    {
      nombre: "id_tipo_carroceria",
      etiqueta: "Carrocería",
      tipo: "relacion",
      requerido: true,
      relacion: { recurso: "tipos_carrocerias", valor: "id", etiqueta: "carroceria" },
    },
    {
      nombre: "motor_cc",
      etiqueta: "Cilindrada",
      tipo: "entero",
      requerido: true,
      min: 50,
      max: 20000,
      sufijo: "cc",
      placeholder: "1800",
      ayuda: "En centímetros cúbicos: 1.8 L = 1800.",
    },
    {
      nombre: "motor_numero_cilindros",
      etiqueta: "Cilindros",
      tipo: "entero",
      requerido: true,
      min: 1,
      max: 16,
      placeholder: "4",
    },
    {
      nombre: "motor_posicion_cilindros",
      etiqueta: "Posición de cilindros",
      tipo: "opciones",
      requerido: true,
      presentacion: "tarjetas",
      opciones: POSICIONES,
      porDefecto: "L",
    },
    {
      nombre: "motor_numero",
      etiqueta: "Código de motor",
      tipo: "texto",
      mayusculas: true,
      maxLargo: 40,
      placeholder: "1ZZ-FE",
      ayuda: "Opcional.",
    },
  ],
  mensajes: {
    duplicado: "Ya existe una especificación idéntica para ese vehículo.",
    enUso: "No se puede eliminar: la especificación está en uso.",
  },
};
