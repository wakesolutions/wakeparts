/** Notificaciones y tareas pendientes (migración 0014). Compartido cliente/servidor. */

/** Adónde lleva una notificación: módulo del dock, sección de ModuloTablas y registro. */
export type Enlace = { modulo?: string; seccion?: string; recurso?: string; id?: string };

export type Notificacion = {
  id: string;
  tipo: string;
  titulo: string;
  cuerpo: string | null;
  enlace: Enlace;
  esTarea: boolean;
  pendiente: boolean;
  leida: boolean;
  creadoEn: string;
  resueltaEn: string | null;
  resueltaPor: string | null;
};

export type BandejaNotificaciones = {
  items: Notificacion[];
  pendientes: number;
  noLeidas: number;
  /** Tareas pendientes por módulo (insignia en el dock). */
  porModulo: Record<string, number>;
};

export const BANDEJA_VACIA: BandejaNotificaciones = { items: [], pendientes: 0, noLeidas: 0, porModulo: {} };

export function armarBandeja(items: Notificacion[]): BandejaNotificaciones {
  const porModulo: Record<string, number> = {};
  for (const n of items) {
    if (n.pendiente && n.enlace.modulo) porModulo[n.enlace.modulo] = (porModulo[n.enlace.modulo] ?? 0) + 1;
  }
  return {
    items,
    pendientes: items.filter((n) => n.pendiente).length,
    noLeidas: items.filter((n) => !n.leida).length,
    porModulo,
  };
}

const relativo = new Intl.RelativeTimeFormat("es", { numeric: "auto" });

/** «hace 5 minutos», «ayer». */
export function hace(fecha: string, ahora = Date.now()) {
  const s = Math.round((new Date(fecha).getTime() - ahora) / 1000);
  const a = Math.abs(s);
  if (a < 45) return "ahora";
  if (a < 3600) return relativo.format(Math.round(s / 60), "minute");
  if (a < 86400) return relativo.format(Math.round(s / 3600), "hour");
  return relativo.format(Math.round(s / 86400), "day");
}
