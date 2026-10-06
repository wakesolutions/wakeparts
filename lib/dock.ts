/**
 * Dock personalizable por usuario (0020): qué módulos se ocultan y de qué
 * esmalte es cada ícono. Se guarda en `usuarios.dock` (jsonb) y sigue al
 * usuario entre equipos; el navegador guarda una copia por si falta la migración.
 */

export type TonoIcono = "metal" | "rojo" | "ambar" | "verde" | "azul" | "marfil";

export type PreferenciasDock = {
  /** Módulos que no van fijos en el dock (se abren desde el cajón). */
  ocultos: string[];
  /** Esmalte de cada ícono; lo que falta usa el de fábrica. */
  tonos: Record<string, TonoIcono>;
};

export const TONOS_ICONO: readonly { valor: TonoIcono; etiqueta: string }[] = [
  { valor: "metal", etiqueta: "Grafito" },
  { valor: "rojo", etiqueta: "Rojo" },
  { valor: "ambar", etiqueta: "Ámbar" },
  { valor: "verde", etiqueta: "Verde" },
  { valor: "azul", etiqueta: "Azul" },
  { valor: "marfil", etiqueta: "Marfil" },
];

/** Módulos que no se pueden ocultar (Inicio es el escritorio). */
export const FIJOS_DOCK = ["inicio"];

export const DOCK_VACIO: PreferenciasDock = { ocultos: [], tonos: {} };

/** Esmalte de fábrica: Inicio en rojo, el resto en grafito. */
export const tonoDeFabrica = (id: string): TonoIcono => (id === "inicio" ? "rojo" : "metal");

const ID = /^[a-z][a-z0-9-]{0,39}$/;

/** Limpia lo que venga de la base, del navegador o del cliente. */
export function normalizarDock(valor: unknown): PreferenciasDock {
  if (!valor || typeof valor !== "object") return { ...DOCK_VACIO, tonos: {} };
  const v = valor as { ocultos?: unknown; tonos?: unknown };
  const ocultos = Array.isArray(v.ocultos)
    ? [...new Set(v.ocultos.filter((x): x is string => typeof x === "string" && ID.test(x) && !FIJOS_DOCK.includes(x)))].slice(0, 40)
    : [];
  const tonos: Record<string, TonoIcono> = {};
  if (v.tonos && typeof v.tonos === "object") {
    for (const [id, tono] of Object.entries(v.tonos as Record<string, unknown>).slice(0, 40)) {
      if (ID.test(id) && TONOS_ICONO.some((t) => t.valor === tono) && tono !== tonoDeFabrica(id)) {
        tonos[id] = tono as TonoIcono;
      }
    }
  }
  return { ocultos, tonos };
}
