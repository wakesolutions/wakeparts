/**
 * Versión vigente de los textos legales (/terminos, /privacidad, /cookies).
 * Es la fecha visible en esas páginas y la que queda en cada constancia de
 * aceptación (`aceptaciones_legales`, 0026). Cambiala al editar cualquier texto
 * legal: quien acepte después queda con la versión nueva.
 */
export const VERSION_LEGAL = "2026-10-14";
export const VERSION_LEGAL_TEXTO = "14 de octubre de 2026";

/** Dónde se aceptaron los términos. */
export type ContextoAceptacion = "registro" | "suscripcion";

export const ERROR_SIN_ACEPTAR = "Para seguir, marcá que aceptás los Términos de uso y la Política de privacidad.";
