"use client";

import type { Enlace } from "./notificaciones";

/**
 * «Ir a» dentro del escritorio: después de abrir un módulo, le pide que muestre
 * una sección (ModuloTablas) y un registro (p. ej. un pedido web). Si quien lo
 * consume todavía no está montado, lo toma al montarse (una sola vez).
 */

const EVENTO = "wp:ir-a";
let seccionPendiente: { modulo: string; seccion: string } | null = null;
let registroPendiente: { recurso: string; id: string } | null = null;

export function pedirDestino(e: Enlace) {
  seccionPendiente = e.modulo && e.seccion ? { modulo: e.modulo, seccion: e.seccion } : null;
  registroPendiente = e.recurso && e.id ? { recurso: e.recurso, id: e.id } : null;
  window.dispatchEvent(new CustomEvent<Enlace>(EVENTO, { detail: e }));
}

export function tomarSeccion(modulo: string): string | null {
  if (seccionPendiente?.modulo !== modulo) return null;
  const s = seccionPendiente.seccion;
  seccionPendiente = null;
  return s;
}

export function tomarRegistro(recurso: string): string | null {
  if (registroPendiente?.recurso !== recurso) return null;
  const id = registroPendiente.id;
  registroPendiente = null;
  return id;
}

/** Para componentes ya montados: avisa cada pedido de destino. */
export function escucharDestino(fn: () => void) {
  window.addEventListener(EVENTO, fn);
  return () => window.removeEventListener(EVENTO, fn);
}

/** Avisa a la campanita que algo cambió (p. ej. se atendió un pedido) para que refresque ya. */
export const EVENTO_NOTIFICACIONES = "wp:notificaciones:actualizar";

export function avisarCambioNotificaciones() {
  window.dispatchEvent(new Event(EVENTO_NOTIFICACIONES));
}
