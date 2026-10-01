import type { DefCampo } from "./recursos/tipos";

/** Campos editables del perfil propio (Mi usuario). */
export const CAMPOS_PERFIL: readonly DefCampo[] = [
  {
    nombre: "nombre",
    etiqueta: "Nombre para mostrar",
    tipo: "texto",
    requerido: true,
    maxLargo: 120,
    ancho: "completo",
    ayuda: "Así te ven tus compañeros.",
  },
  { nombre: "telefono", etiqueta: "Teléfono", tipo: "texto", maxLargo: 30, placeholder: "9999-0000" },
];
