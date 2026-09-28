import type { DefRecurso, Opcion } from "./tipos";

/** Personas de la empresa activa. Ámbito "empresa": el servidor filtra solo. */

export const ROLES: readonly Opcion[] = [
  { valor: "dueno", etiqueta: "Dueño" },
  { valor: "admin", etiqueta: "Administrador" },
  { valor: "vendedor", etiqueta: "Vendedor" },
];

const ESTADOS: readonly Opcion[] = [
  { valor: "true", etiqueta: "Activo" },
  { valor: "false", etiqueta: "Inactivo" },
];

export const miembros: DefRecurso = {
  id: "miembros",
  nombre: "miembro",
  nombrePlural: "Miembros",
  vista: "v_miembros",
  tabla: "empresas_usuarios",
  clave: "id_usuario",
  ambito: "empresa",
  escritura: "empresa",
  // Se entra por invitación y nadie se borra: se desactiva (conserva su historial).
  acciones: { crear: false, eliminar: false },
  titulo: "nombre",
  orden: [{ columna: "nombre", dir: "asc" }],
  columnas: [
    { clave: "nombre", etiqueta: "Nombre", tipo: "texto", ancho: 220, buscable: true },
    { clave: "correo", etiqueta: "Correo", tipo: "texto", ancho: 260, buscable: true, formato: "codigo" },
    { clave: "telefono", etiqueta: "Teléfono", tipo: "texto", ancho: 140, oculta: true },
    {
      clave: "rol",
      etiqueta: "Rol",
      tipo: "texto",
      ancho: 150,
      opciones: ROLES,
      filtro: { tipo: "opciones", opciones: ROLES },
    },
    { clave: "activo", etiqueta: "Estado", tipo: "booleano", ancho: 120, opciones: ESTADOS },
    { clave: "creado_en", etiqueta: "Miembro desde", tipo: "fecha", ancho: 150 },
  ],
  campos: [
    {
      nombre: "rol",
      etiqueta: "Rol",
      tipo: "opciones",
      requerido: true,
      presentacion: "tarjetas",
      opciones: ROLES,
      ancho: "completo",
      ayuda: "Dueño: control total. Administrador: gestiona todo menos a los dueños. Vendedor: vende y consulta.",
    },
    {
      nombre: "activo",
      etiqueta: "Acceso activo",
      tipo: "booleano",
      ancho: "completo",
      ayuda: "Si lo desactivás, deja de ver la empresa pero se conserva su historial.",
    },
  ],
};

export const invitaciones: DefRecurso = {
  id: "invitaciones",
  nombre: "invitación",
  nombrePlural: "Invitaciones",
  genero: "f",
  vista: "v_invitaciones",
  tabla: "invitaciones",
  clave: "id",
  ambito: "empresa",
  escritura: "empresa",
  titulo: "correo",
  orden: [{ columna: "creado_en", dir: "desc" }],
  columnas: [
    { clave: "correo", etiqueta: "Correo", tipo: "texto", ancho: 280, buscable: true, formato: "codigo" },
    {
      clave: "rol",
      etiqueta: "Rol",
      tipo: "texto",
      ancho: 150,
      opciones: ROLES,
      filtro: { tipo: "opciones", opciones: ROLES },
    },
    { clave: "invitado_por", etiqueta: "Invitado por", tipo: "texto", ancho: 200 },
    { clave: "creado_en", etiqueta: "Fecha", tipo: "fecha", ancho: 140 },
  ],
  campos: [
    {
      nombre: "correo",
      etiqueta: "Correo de Google",
      tipo: "texto",
      requerido: true,
      minusculas: true,
      soloAlCrear: true,
      maxLargo: 120,
      patron: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$",
      mensajePatron: "Correo no válido.",
      placeholder: "empleado@gmail.com",
      ancho: "completo",
      ayuda: "Cuando esa persona entre a Wake Parts con esta cuenta de Google, quedará dentro de tu empresa.",
    },
    {
      nombre: "rol",
      etiqueta: "Rol",
      tipo: "opciones",
      requerido: true,
      presentacion: "tarjetas",
      opciones: ROLES,
      porDefecto: "vendedor",
      ancho: "completo",
    },
  ],
  mensajes: {
    duplicado: "Ya hay una invitación pendiente para ese correo.",
  },
};
