import type { DefColumna, DefRecurso, Opcion } from "./tipos";

/**
 * Registro de actividad (tabla `registros`, 0011): solo lectura.
 * «actividad» = lo de la empresa activa (dueño/admin): sesiones y cambios.
 * «actividad_plataforma» = todo (admin de plataforma): visitas anónimas,
 * errores y todas las empresas. RLS decide qué filas ve cada quien.
 */

export const TIPOS_REGISTRO: readonly Opcion[] = [
  { valor: "visita", etiqueta: "Visita" },
  { valor: "sesion", etiqueta: "Sesión" },
  { valor: "error", etiqueta: "Error" },
  { valor: "cambio", etiqueta: "Cambio de datos" },
  { valor: "accion", etiqueta: "Acción" },
];

export const NIVELES_REGISTRO: readonly Opcion[] = [
  { valor: "info", etiqueta: "Info" },
  { valor: "aviso", etiqueta: "Aviso" },
  { valor: "error", etiqueta: "Error" },
];

const ENTORNOS: readonly Opcion[] = [
  { valor: "production", etiqueta: "Producción" },
  { valor: "preview", etiqueta: "Vista previa" },
  { valor: "development", etiqueta: "Desarrollo" },
];

const columnas = (conEmpresa: boolean): DefColumna[] => [
  { clave: "creado_en", etiqueta: "Fecha y hora", tipo: "fecha", formato: "fechaHora", ancho: 190 },
  {
    clave: "tipo",
    etiqueta: "Tipo",
    tipo: "texto",
    ancho: 140,
    opciones: TIPOS_REGISTRO,
    filtro: { tipo: "opciones", opciones: TIPOS_REGISTRO },
  },
  {
    clave: "nivel",
    etiqueta: "Nivel",
    tipo: "texto",
    ancho: 100,
    opciones: NIVELES_REGISTRO,
    filtro: { tipo: "opciones", opciones: NIVELES_REGISTRO },
  },
  { clave: "evento", etiqueta: "Evento", tipo: "texto", ancho: 200, buscable: true, formato: "codigo" },
  { clave: "mensaje", etiqueta: "Detalle", tipo: "texto", ancho: 280, buscable: true },
  { clave: "usuario", etiqueta: "Usuario", tipo: "texto", ancho: 190, buscable: true, vacio: "Visitante" },
  { clave: "correo", etiqueta: "Correo", tipo: "texto", ancho: 230, buscable: true, oculta: true, formato: "codigo" },
  ...(conEmpresa
    ? [{ clave: "empresa", etiqueta: "Empresa", tipo: "texto", ancho: 180, buscable: true } as DefColumna]
    : []),
  { clave: "ip", etiqueta: "IP", tipo: "texto", ancho: 140, buscable: true, formato: "codigo" },
  { clave: "dispositivo", etiqueta: "Dispositivo", tipo: "texto", ancho: 250, buscable: true },
  { clave: "ubicacion", etiqueta: "Ubicación", tipo: "texto", ancho: 160, buscable: true, oculta: true },
  { clave: "ruta", etiqueta: "Página", tipo: "texto", ancho: 200, buscable: true, formato: "codigo" },
  { clave: "tabla", etiqueta: "Tabla", tipo: "texto", ancho: 150, oculta: true, buscable: true },
  { clave: "id_registro", etiqueta: "Id del registro", tipo: "texto", ancho: 140, oculta: true, buscable: true },
  { clave: "metodo", etiqueta: "Método", tipo: "texto", ancho: 90, oculta: true },
  { clave: "referente", etiqueta: "Vino de", tipo: "texto", ancho: 220, oculta: true, buscable: true },
  {
    clave: "entorno",
    etiqueta: "Entorno",
    tipo: "texto",
    ancho: 120,
    oculta: true,
    opciones: ENTORNOS,
    filtro: { tipo: "opciones", opciones: ENTORNOS },
  },
  { clave: "id", etiqueta: "N.º", tipo: "entero", ancho: 90, oculta: true },
];

const base = {
  nombre: "registro",
  nombrePlural: "Actividad",
  vista: "v_registros",
  tabla: "registros",
  clave: "id",
  escritura: "ninguna",
  acciones: { crear: false, editar: false, eliminar: false },
  titulo: "evento",
  orden: [{ columna: "creado_en", dir: "desc" }],
  // Para la ventana de detalle (no se muestran como columnas).
  columnasInternas: ["datos", "agente", "id_usuario"],
  campos: [],
} as const satisfies Partial<DefRecurso>;

export const actividad: DefRecurso = {
  ...base,
  id: "actividad",
  ambito: "empresa",
  columnas: columnas(false),
};

export const actividadPlataforma: DefRecurso = {
  ...base,
  id: "actividad_plataforma",
  nombrePlural: "Toda la plataforma",
  ambito: "global",
  columnas: columnas(true),
};
