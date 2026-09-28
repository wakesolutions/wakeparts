import { COOKIE_PALETA, type PaletaId } from "./paletas";

/** Aplica la paleta al documento y la recuerda en la cookie (solo cliente). */
export function aplicarPaleta(id: PaletaId) {
  document.documentElement.setAttribute("data-paleta", id);
  document.cookie = `${COOKIE_PALETA}=${id}; path=/; max-age=31536000; samesite=lax`;
}

export function paletaActual(): string | null {
  return document.documentElement.getAttribute("data-paleta");
}
