/**
 * Dock personalizable por usuario (0020): qué módulos se ocultan, de qué
 * esmalte es cada ícono y en qué orden van. Se guarda en `usuarios.dock` (jsonb) y sigue al
 * usuario entre equipos; el navegador guarda una copia por si falta la migración.
 */

export type TonoIcono = "metal" | "rojo" | "ambar" | "verde" | "azul" | "marfil";

export type PreferenciasDock = {
  /** Módulos que no van fijos en el dock (se abren desde el cajón). */
  ocultos: string[];
  /** Esmalte de cada ícono; lo que falta usa el de fábrica. */
  tonos: Record<string, TonoIcono>;
  /** Orden elegido arrastrando (sin Inicio, que siempre va primero). Lo que falta va al final, en el orden de fábrica. */
  orden: string[];
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

export const DOCK_VACIO: PreferenciasDock = { ocultos: [], tonos: {}, orden: [] };

/** Un dock de fábrica nuevo (sin compartir arreglos). */
export const dockDeFabrica = (): PreferenciasDock => ({ ocultos: [], tonos: {}, orden: [] });

/** Ordena los módulos: los fijos primero, luego el orden elegido y al final los que no tienen lugar. */
export function ordenarDock<T extends { id: string }>(modulos: readonly T[], orden: readonly string[]): T[] {
  const lugar = (id: string) => {
    if (FIJOS_DOCK.includes(id)) return -1;
    const i = orden.indexOf(id);
    return i === -1 ? orden.length : i;
  };
  return modulos
    .map((m, i) => ({ m, i }))
    .sort((a, b) => lugar(a.m.id) - lugar(b.m.id) || a.i - b.i)
    .map((x) => x.m);
}

/** Esmalte de fábrica: Inicio en rojo, el resto en grafito. */
export const tonoDeFabrica = (id: string): TonoIcono => (id === "inicio" ? "rojo" : "metal");

const ID = /^[a-z][a-z0-9-]{0,39}$/;

/** Limpia lo que venga de la base, del navegador o del cliente. */
export function normalizarDock(valor: unknown): PreferenciasDock {
  if (!valor || typeof valor !== "object") return dockDeFabrica();
  const v = valor as { ocultos?: unknown; tonos?: unknown; orden?: unknown };
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
  const orden = Array.isArray(v.orden)
    ? [...new Set(v.orden.filter((x): x is string => typeof x === "string" && ID.test(x) && !FIJOS_DOCK.includes(x)))].slice(0, 40)
    : [];
  return { ocultos, tonos, orden };
}
