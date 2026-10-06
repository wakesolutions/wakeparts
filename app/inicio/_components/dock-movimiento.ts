"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, type PointerEvent as EventoReact, type RefObject } from "react";

/**
 * Movimiento del dock (0020): magnificación al pasar el mouse (como en macOS),
 * reacomodo suave cuando cambia qué hay o en qué orden (FLIP), vuelos entre la
 * guantera y el dock, y arrastrar para reordenar. Todo anima `transform` con
 * la Web Animations API; con `prefers-reduced-motion` no hay vuelos ni lupa.
 */

/** Las mismas curvas que `--ease-expo` y `--ease-inout` (la Web Animations API no lee variables CSS). */
const EXPO = "cubic-bezier(0.16, 1, 0.3, 1)";
const INOUT = "cubic-bezier(0.87, 0, 0.13, 1)";

/** Escala del ícono bajo el cursor y qué tan ancha es la «lupa» (px). */
const LUPA_MAX = 1.6;
const LUPA_ALCANCE = 72;

export const quieto = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const items = (ul: HTMLElement | null, filtro = "") =>
  ul ? [...ul.querySelectorAll<HTMLElement>(`:scope > li${filtro}`)] : [];

// ------------------------------------------------------------- magnificación --

/**
 * Lupa del dock: cada ícono crece según su distancia al cursor (curva de
 * campana) mediante la variable `--m` del `<li>`; el CSS convierte `--m` en el
 * tamaño del ícono. Solo con mouse y pantalla ancha; se congela mientras se
 * arrastra y se apaga con `apagada` (guantera o menú abiertos).
 */
export function useLupa(lista: RefObject<HTMLUListElement | null>, apagada: boolean) {
  const apagadaRef = useRef(apagada);
  useEffect(() => {
    apagadaRef.current = apagada;
    if (apagada) lista.current?.dispatchEvent(new PointerEvent("pointerleave"));
  }, [apagada, lista]);

  useEffect(() => {
    const ul = lista.current;
    if (!ul) return;
    const conMouse = window.matchMedia("(hover: hover) and (pointer: fine) and (min-width: 820px)");
    let raf = 0;
    let x = 0;

    const aplicar = () => {
      raf = 0;
      if (ul.dataset.arrastrando !== undefined) return; // congelada: el arrastre mide con estos tamaños
      for (const li of items(ul)) {
        const r = li.getBoundingClientRect();
        const d = x - (r.left + r.width / 2);
        const m = 1 + (LUPA_MAX - 1) * Math.exp(-(d * d) / (2 * LUPA_ALCANCE * LUPA_ALCANCE));
        li.style.setProperty("--m", m < 1.005 ? "1" : m.toFixed(3));
      }
    };
    const mover = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || apagadaRef.current || !conMouse.matches || quieto()) return;
      ul.dataset.lupa = "";
      x = e.clientX;
      if (!raf) raf = requestAnimationFrame(aplicar);
    };
    const salir = () => {
      if (ul.dataset.arrastrando !== undefined) return;
      cancelAnimationFrame(raf);
      raf = 0;
      delete ul.dataset.lupa;
      for (const li of items(ul)) li.style.removeProperty("--m");
    };
    ul.addEventListener("pointermove", mover);
    ul.addEventListener("pointerleave", salir);
    return () => {
      cancelAnimationFrame(raf);
      ul.removeEventListener("pointermove", mover);
      ul.removeEventListener("pointerleave", salir);
    };
  }, [lista]);
}

// ---------------------------------------------------------------- FLIP/vuelos --

/**
 * Reacomodo animado. Antes de un cambio se llama `medir()`; después del render,
 * cada ícono que se movió se desliza desde donde estaba. `volarDesde(id, rect)`
 * hace que ese ícono, al aparecer, vuele desde `rect` (la guantera) con un arco.
 */
export function useReacomodo(lista: RefObject<HTMLUListElement | null>) {
  const antes = useRef<Map<string, DOMRect> | null>(null);
  const vuelos = useRef(new Map<string, { rect: DOMRect; t: number }>());

  const medir = useCallback(() => {
    const m = new Map<string, DOMRect>();
    for (const li of items(lista.current, "[data-id]")) m.set(li.dataset.id!, li.getBoundingClientRect());
    antes.current = m;
  }, [lista]);

  const volarDesde = useCallback((id: string, rect: DOMRect | undefined) => {
    if (rect && !quieto()) vuelos.current.set(id, { rect, t: performance.now() });
  }, []);

  // Después de cada render (barato si no hay nada pendiente).
  useLayoutEffect(() => {
    const previos = antes.current;
    antes.current = null;
    const ahora = performance.now();
    for (const [id, v] of vuelos.current) if (ahora - v.t > 2000) vuelos.current.delete(id);
    if (!previos && vuelos.current.size === 0) return;
    if (quieto()) {
      vuelos.current.clear();
      return;
    }
    for (const li of items(lista.current, "[data-id]")) {
      const id = li.dataset.id!;
      const nuevo = li.getBoundingClientRect();
      const vuelo = vuelos.current.get(id);
      if (vuelo) {
        vuelos.current.delete(id);
        const dx = vuelo.rect.left + vuelo.rect.width / 2 - (nuevo.left + nuevo.width / 2);
        const dy = vuelo.rect.top + vuelo.rect.height / 2 - (nuevo.top + nuevo.height / 2);
        const s = Math.max(0.4, Math.min(1.4, vuelo.rect.width / Math.max(nuevo.width, 1)));
        // Sale de la guantera, sube en arco por encima del dock y se posa en su lugar.
        li.animate(
          [
            { transform: `translate3d(${dx}px, ${dy}px, 0) scale(${s})`, opacity: 0.6 },
            { transform: `translate3d(${dx * 0.3}px, ${Math.min(dy * 0.3, 0) - 34}px, 0) scale(1.18)`, opacity: 1, offset: 0.55 },
            { transform: "none", opacity: 1 },
          ],
          { duration: 620, easing: EXPO },
        );
        continue;
      }
      if (!previos) continue;
      const p = previos.get(id);
      if (p) {
        const dx = p.left - nuevo.left;
        const dy = p.top - nuevo.top;
        if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
          li.animate([{ transform: `translate3d(${dx}px, ${dy}px, 0)` }, { transform: "none" }], {
            duration: 380,
            easing: EXPO,
          });
        }
      } else {
        li.animate([{ transform: "scale(0.6)", opacity: 0 }, { transform: "none", opacity: 1 }], {
          duration: 320,
          easing: EXPO,
        });
      }
    }
  });

  return { medir, volarDesde };
}

/** El ícono vuela del dock a la guantera (se encoge y se apaga); al terminar, `alLlegar`. */
export function volarA(li: HTMLElement | null, destino: DOMRect | undefined, alLlegar: () => void) {
  if (!li || !destino || quieto()) return alLlegar();
  const r = li.getBoundingClientRect();
  const dx = destino.left + destino.width / 2 - (r.left + r.width / 2);
  const dy = destino.top + destino.height / 2 - (r.top + r.height / 2);
  li.style.pointerEvents = "none";
  const a = li.animate(
    [
      { transform: "none", opacity: 1 },
      { transform: `translate3d(${dx * 0.35}px, -28px, 0) scale(1.08)`, opacity: 1, offset: 0.35 },
      { transform: `translate3d(${dx}px, ${dy}px, 0) scale(0.3)`, opacity: 0 },
    ],
    { duration: 460, easing: INOUT, fill: "forwards" },
  );
  // Una sola vez, aunque la animación no termine (pestaña en segundo plano, ventana tapada).
  let listo = false;
  const llegar = () => {
    if (listo) return;
    listo = true;
    alLlegar();
  };
  a.onfinish = llegar;
  a.oncancel = llegar;
  setTimeout(llegar, 700);
}

// ------------------------------------------------------------------- arrastre --

/**
 * Arrastrar un ícono para reordenar (mouse o lápiz; en el teléfono el dock se
 * desliza). El ícono se levanta y sigue al cursor; los demás le abren lugar.
 * Al soltar llama `alSoltar(ids en el nuevo orden, id movido)`. Escape cancela.
 */
export function useArrastre(
  lista: RefObject<HTMLUListElement | null>,
  medir: () => void,
  alSoltar: (ids: string[], movido: string) => void,
) {
  const clicAnulado = useRef(false);
  const alSoltarRef = useRef(alSoltar);
  useEffect(() => {
    alSoltarRef.current = alSoltar;
  });

  const empezar = useCallback(
    (e: EventoReact<HTMLLIElement>) => {
      const li = e.currentTarget;
      const ul = lista.current;
      if (e.button !== 0 || e.pointerType === "touch" || !ul || li.dataset.arrastrable === undefined) return;
      const todos = items(ul, "[data-arrastrable]");
      const rects = todos.map((el) => el.getBoundingClientRect());
      const desde = todos.indexOf(li);
      if (desde < 0) return;
      const x0 = e.clientX;
      const y0 = e.clientY;
      const hueco = rects.length > 1 ? Math.max(0, rects[1].left - rects[0].right) : 12;
      const paso = rects[desde].width + hueco;
      const centros = rects.map((r) => r.left + r.width / 2);
      let activo = false;
      let hasta = desde;

      const limpiar = () => {
        window.removeEventListener("pointermove", mover);
        window.removeEventListener("pointerup", soltar);
        window.removeEventListener("pointercancel", cancelar);
        window.removeEventListener("keydown", tecla);
        delete ul.dataset.arrastrando;
        delete li.dataset.arrastrado;
      };
      const devolver = () => {
        for (const el of todos) el.style.transform = "";
      };
      const mover = (ev: PointerEvent) => {
        const dx = ev.clientX - x0;
        const dy = ev.clientY - y0;
        if (!activo) {
          if (Math.hypot(dx, dy) < 6) return;
          activo = true;
          ul.dataset.arrastrando = "";
          li.dataset.arrastrado = "";
        }
        // No se sale del tramo de íconos arrastrables (Inicio y la guantera quedan fijos).
        const x = Math.max(rects[0].left - rects[desde].left - 10, Math.min(rects.at(-1)!.left - rects[desde].left + 10, dx));
        li.style.transform = `translate3d(${x}px, ${Math.max(-40, Math.min(0, dy * 0.3)) - 12}px, 0) scale(1.14)`;
        const centro = centros[desde] + x;
        hasta = centros.filter((c, i) => i !== desde && c < centro).length;
        todos.forEach((el, i) => {
          if (i === desde) return;
          const corre = desde < hasta && i > desde && i <= hasta ? -paso : desde > hasta && i >= hasta && i < desde ? paso : 0;
          el.style.transform = corre ? `translate3d(${corre}px, 0, 0)` : "";
        });
      };
      const soltar = () => {
        limpiar();
        if (!activo) return;
        clicAnulado.current = true;
        setTimeout(() => (clicAnulado.current = false), 0);
        medir(); // posiciones a la vista (con el ícono levantado) para aterrizar desde ahí
        devolver();
        const ids = todos.map((el) => el.dataset.id!);
        const [movido] = ids.splice(desde, 1);
        ids.splice(hasta, 0, movido);
        alSoltarRef.current(ids, movido);
      };
      const cancelar = () => {
        limpiar();
        if (!activo) return;
        clicAnulado.current = true;
        medir();
        devolver();
        alSoltarRef.current(todos.map((el) => el.dataset.id!), li.dataset.id!);
      };
      const tecla = (ev: KeyboardEvent) => ev.key === "Escape" && cancelar();

      window.addEventListener("pointermove", mover);
      window.addEventListener("pointerup", soltar);
      window.addEventListener("pointercancel", cancelar);
      window.addEventListener("keydown", tecla);
    },
    [lista, medir],
  );

  /** Después de soltar, el clic que dispara el navegador no debe abrir el módulo. */
  const anularClic = useCallback(() => {
    if (!clicAnulado.current) return false;
    clicAnulado.current = false;
    return true;
  }, []);

  return { empezar, anularClic };
}
