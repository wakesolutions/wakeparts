import type { Papel } from "./identidad";

/**
 * URL de una página imprimible con «imprimir» (abre el diálogo al cargar) y,
 * si se pide, el papel: «carta» u hoja, «ticket» o tira térmica. Sin papel,
 * la página usa el predeterminado de la empresa (Taller › Factura). La demo
 * ya trae su propio «?id=», por eso se agrega con «&».
 */
export function urlImprimir(url: string, papel?: Papel) {
  const params = ["imprimir", ...(papel ? [`papel=${papel}`] : [])].join("&");
  return `${url}${url.includes("?") ? "&" : "?"}${params}`;
}

export const otroPapel = (papel: Papel): Papel => (papel === "ticket" ? "carta" : "ticket");

export const NOMBRE_PAPEL: Record<Papel, string> = { carta: "Carta", ticket: "Ticket" };
