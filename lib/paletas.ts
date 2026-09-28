/**
 * Paletas disponibles. Cada una se define en app/globals.css bajo
 * [data-paleta="<id>"]. Más adelante la paleta vendrá de la empresa del
 * usuario; por ahora se guarda en una cookie.
 */
export const PALETAS = [
  { id: "rojo-negro", nombre: "Rojo · Negro", muestra: ["#d5121e", "#121010"] },
  { id: "rojo-blanco", nombre: "Rojo · Blanco", muestra: ["#c8102e", "#efebe4"] },
] as const;

export type PaletaId = (typeof PALETAS)[number]["id"];

export const PALETA_POR_DEFECTO: PaletaId = "rojo-negro";
export const COOKIE_PALETA = "wp_paleta";

export function paletaValida(valor: string | undefined): PaletaId {
  return PALETAS.some((p) => p.id === valor)
    ? (valor as PaletaId)
    : PALETA_POR_DEFECTO;
}
