import { leerNotificaciones, marcarNotificacionesLeidas } from "@/app/acciones/notificaciones";
import type { BandejaNotificaciones } from "@/lib/notificaciones";

/** Campanita: leer y marcar (el sandbox inyecta una versión en memoria). */
export type ApiNotificaciones = {
  leer(): Promise<BandejaNotificaciones>;
  marcarLeidas(ids?: string[]): Promise<void>;
};

export const apiNotificaciones: ApiNotificaciones = {
  leer: leerNotificaciones,
  marcarLeidas: marcarNotificacionesLeidas,
};
