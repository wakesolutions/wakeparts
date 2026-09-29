"use client";

import {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
  type PointerEvent as PEvent,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import { ANCHO_MOVIL, BARRA_ALTO, DOCK_ALTO, acotar, useVentanas, type Ventana as TVentana } from "./contexto";
import styles from "./ventanas.module.css";

const EXPO = "cubic-bezier(0.16, 1, 0.3, 1)";
const QUART_IN = "cubic-bezier(0.5, 0, 0.75, 0)";
const HACIA_DOCK = "cubic-bezier(0.7, 0, 0.84, 0)";

function sinMovimiento() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const consultaMovil = `(max-width: ${ANCHO_MOVIL - 1}px)`;
function suscribirMovil(avisar: () => void) {
  const mq = window.matchMedia(consultaMovil);
  mq.addEventListener("change", avisar);
  return () => mq.removeEventListener("change", avisar);
}
const esMovilAhora = () => window.matchMedia(consultaMovil).matches;
const esMovilServidor = () => false;

/** Transform que lleva la ventana hasta su ícono del dock (o el de su ventana madre). */
function haciaDock(el: HTMLElement, ids: (string | undefined)[]) {
  const r = el.getBoundingClientRect();
  const icono = ids
    .filter(Boolean)
    .map((id) => document.querySelector<HTMLElement>(`[data-dock="${id}"]`))
    .find(Boolean);
  if (!icono) {
    const dy = window.innerHeight - (r.top + r.height / 2);
    return `translate3d(0, ${dy}px, 0) scale(0.08)`;
  }
  const d = icono.getBoundingClientRect();
  const escala = Math.max(d.width / r.width, 0.04);
  const dx = d.left + d.width / 2 - (r.left + r.width / 2);
  const dy = d.top + d.height / 2 - (r.top + r.height / 2);
  return `translate3d(${dx}px, ${dy}px, 0) scale(${escala})`;
}

type Direccion = "e" | "w" | "s" | "se" | "sw";

const VentanaActual = createContext<string | null>(null);

/** Id de la ventana que contiene al componente (para abrir ventanas hijas de ella). */
export function useVentanaActual() {
  return useContext(VentanaActual);
}

type Props = {
  ventana: TVentana;
  titulo: string;
  children: ReactNode;
  /** Reemplaza el cierre por defecto (p. ej. una ventana hija controlada por su dueña). */
  onCerrar?: () => void;
};

export function Ventana({ ventana, titulo, children, onCerrar }: Props) {
  const { enfocada, enfocar, cerrar, minimizar, alternarMaximizar, mover } = useVentanas();
  const ref = useRef<HTMLElement>(null);
  // La capa interior es la que se anima; la exterior solo posiciona.
  const marco = useRef<HTMLDivElement>(null);
  const estadoPrevio = useRef<TVentana["estado"] | null>(null);
  const rectPrevio = useRef<DOMRect | null>(null);
  const movil = useSyncExternalStore(suscribirMovil, esMovilAhora, esMovilServidor);
  const activa = enfocada === ventana.id;
  const maxi = ventana.estado === "maximizada";
  const completa = maxi && !movil;
  const oculta = ventana.estado === "minimizada";
  const destinos = [ventana.id, ventana.padre];

  // Animaciones de apertura / restauración / maximizar (FLIP).
  useLayoutEffect(() => {
    const el = marco.current;
    if (!el) return;
    const previo = estadoPrevio.current;
    estadoPrevio.current = ventana.estado;
    if (sinMovimiento() || oculta) return;

    if (previo === null || previo === "minimizada") {
      el.animate(
        [
          { transform: haciaDock(el, [ventana.id, ventana.padre]), opacity: 0 },
          { transform: "none", opacity: 1 },
        ],
        { duration: 520, easing: EXPO },
      );
    } else if (previo !== ventana.estado && rectPrevio.current) {
      const a = rectPrevio.current;
      const b = el.getBoundingClientRect();
      rectPrevio.current = null;
      el.animate(
        [
          {
            transformOrigin: "0 0",
            transform: `translate3d(${a.left - b.left}px, ${a.top - b.top}px, 0) scale(${a.width / b.width}, ${a.height / b.height})`,
          },
          { transformOrigin: "0 0", transform: "none" },
        ],
        { duration: 420, easing: EXPO },
      );
    }
  }, [ventana.estado, ventana.id, ventana.padre, oculta]);

  function animarYSalir(accion: () => void, destino: "dock" | "cerrar") {
    const el = marco.current;
    if (!el || sinMovimiento()) return accion();
    const anim = el.animate(
      destino === "dock"
        ? [
            { transform: "none", opacity: 1 },
            { transform: haciaDock(el, destinos), opacity: 0.35 },
          ]
        : [
            { transform: "none", opacity: 1 },
            { transform: "scale(0.96)", opacity: 0 },
          ],
      { duration: destino === "dock" ? 420 : 180, easing: destino === "dock" ? HACIA_DOCK : QUART_IN, fill: "forwards" },
    );
    let hecho = false;
    const terminar = () => {
      if (hecho) return;
      hecho = true;
      // Se oculta la ventana en el DOM *antes* de soltar la animación: si se
      // cancelara primero, se vería un cuadro con la ventana en su lugar (parpadeo).
      flushSync(accion);
      anim.cancel();
    };
    anim.onfinish = terminar;
    // Respaldo: si la pestaña no se está dibujando, onfinish nunca llega.
    setTimeout(terminar, destino === "dock" ? 520 : 280);
  }

  function prepararFlip() {
    rectPrevio.current = marco.current?.getBoundingClientRect() ?? null;
  }

  function alternar() {
    prepararFlip();
    alternarMaximizar(ventana.id);
  }

  // ---------------------------------------------------------- arrastre ----
  function iniciarArrastre(e: PEvent<HTMLElement>) {
    if (maxi || e.button !== 0 || (e.target as HTMLElement).closest("button")) return;
    const el = ref.current!;
    const barra = e.currentTarget;
    barra.setPointerCapture(e.pointerId);
    const x0 = e.clientX - ventana.x;
    const y0 = e.clientY - ventana.y;
    let pos = { x: ventana.x, y: ventana.y };
    el.dataset.arrastrando = "";

    const mov = (ev: PointerEvent) => {
      pos = acotar({ x: ev.clientX - x0, y: ev.clientY - y0, w: ventana.w, h: ventana.h });
      el.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
    };
    const fin = () => {
      barra.removeEventListener("pointermove", mov);
      barra.removeEventListener("pointerup", fin);
      barra.removeEventListener("pointercancel", fin);
      delete el.dataset.arrastrando;
      mover(ventana.id, pos);
    };
    barra.addEventListener("pointermove", mov);
    barra.addEventListener("pointerup", fin);
    barra.addEventListener("pointercancel", fin);
  }

  // ---------------------------------------------------------- redimensión -
  function iniciarRedimension(e: PEvent<HTMLSpanElement>) {
    const dir = e.currentTarget.dataset.dir as Direccion;
    if (maxi || !dir) return;
    e.preventDefault();
    e.stopPropagation();
    enfocar(ventana.id);
    const el = ref.current!;
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    const inicio = { mx: e.clientX, my: e.clientY, x: ventana.x, y: ventana.y, w: ventana.w, h: ventana.h };
    let g = { x: inicio.x, y: inicio.y, w: inicio.w, h: inicio.h };

    const mov = (ev: PointerEvent) => {
      const dx = ev.clientX - inicio.mx;
      const dy = ev.clientY - inicio.my;
      const w = dir.includes("e") ? inicio.w + dx : dir.includes("w") ? inicio.w - dx : inicio.w;
      const h = dir.includes("s") ? inicio.h + dy : inicio.h;
      const ancho = Math.max(w, 360);
      g = {
        w: ancho,
        h: Math.max(h, 280),
        x: dir.includes("w") ? inicio.x + (inicio.w - ancho) : inicio.x,
        y: inicio.y,
      };
      el.style.transform = `translate3d(${g.x}px, ${g.y}px, 0)`;
      el.style.width = `${g.w}px`;
      el.style.height = `${g.h}px`;
    };
    const fin = () => {
      handle.removeEventListener("pointermove", mov);
      handle.removeEventListener("pointerup", fin);
      handle.removeEventListener("pointercancel", fin);
      mover(ventana.id, g);
    };
    handle.addEventListener("pointermove", mov);
    handle.addEventListener("pointerup", fin);
    handle.addEventListener("pointercancel", fin);
  }

  const estilo = completa
    ? // Maximizada: ocupa todo el escritorio, encima de la barra de menú y del dock.
      { transform: "none", width: "100vw", height: "100dvh" }
    : maxi
      ? {
          transform: `translate3d(0, ${BARRA_ALTO}px, 0)`,
          width: "100vw",
          height: `calc(100dvh - ${BARRA_ALTO + DOCK_ALTO - 8}px)`,
        }
      : {
          transform: `translate3d(${ventana.x}px, ${ventana.y}px, 0)`,
          width: ventana.w,
          height: ventana.h,
        };

  return (
    <section
      ref={ref}
      className={styles.ventana}
      style={{ ...estilo, zIndex: ventana.z }}
      data-activa={activa || undefined}
      data-maximizada={maxi || undefined}
      data-completa={completa || undefined}
      data-hija={ventana.padre ? "" : undefined}
      hidden={oculta}
      aria-label={titulo}
      role="dialog"
      onPointerDownCapture={() => !activa && enfocar(ventana.id)}
    >
      <div ref={marco} className={styles.marco}>
        <header
          className={styles.titulo}
          onPointerDown={iniciarArrastre}
          onDoubleClick={(e) => {
            if (!(e.target as HTMLElement).closest("button")) alternar();
          }}
        >
          <div className={styles.semaforo}>
            <button
              type="button"
              className={styles.luz}
              data-luz="cerrar"
              aria-label={`Cerrar ${titulo}`}
              onClick={() => animarYSalir(() => (onCerrar ? onCerrar() : cerrar(ventana.id)), "cerrar")}
            >
              <svg viewBox="0 0 8 8" aria-hidden="true">
                <path d="m2 2 4 4M6 2 2 6" />
              </svg>
            </button>
            <button
              type="button"
              className={styles.luz}
              data-luz="minimizar"
              aria-label={`Minimizar ${titulo}`}
              onClick={() => animarYSalir(() => minimizar(ventana.id), "dock")}
            >
              <svg viewBox="0 0 8 8" aria-hidden="true">
                <path d="M1.5 4h5" />
              </svg>
            </button>
            <button
              type="button"
              className={styles.luz}
              data-luz="maximizar"
              aria-label={maxi ? `Achicar ${titulo}` : `Maximizar ${titulo}`}
              onClick={alternar}
            >
              <svg viewBox="0 0 8 8" aria-hidden="true">
                {maxi ? (
                  <path d="M4.5 1v2.5H7M3.5 7V4.5H1" />
                ) : (
                  <path d="M2 6V2.5L5.5 6zM6 2v3.5L2.5 2z" fill="currentColor" stroke="none" />
                )}
              </svg>
            </button>
          </div>
          <h2 className={styles.tituloTexto}>{titulo}</h2>
        </header>

        <div className={styles.contenido}>
          <VentanaActual.Provider value={ventana.id}>{children}</VentanaActual.Provider>
        </div>
      </div>

      {!maxi &&
        (["e", "w", "s", "se", "sw"] as Direccion[]).map((d) => (
          <span key={d} className={styles.borde} data-dir={d} onPointerDown={iniciarRedimension} aria-hidden="true" />
        ))}
    </section>
  );
}

/** Ventanas de módulos. Las hijas se montan aquí mediante portales (VentanaFlotante). */
export function CapaVentanas() {
  const { ventanas, modulos, registrarCapa, enfocada } = useVentanas();
  // Tapa barra y dock si la ventana enfocada (o la madre de una hija enfocada) está maximizada.
  const madre = ventanas.find((v) => v.id === enfocada)?.padre;
  const focoCompleto = ventanas.some((v) => (v.id === enfocada || v.id === madre) && v.estado === "maximizada");
  return (
    <div className={styles.capa} ref={registrarCapa} data-completa={focoCompleto || undefined}>
      {ventanas.map((v) => {
        if (v.titulo) return null;
        const modulo = modulos.find((m) => m.id === v.id);
        if (!modulo?.componente) return null;
        const Componente = modulo.componente;
        return (
          <Ventana key={v.id} ventana={v} titulo={modulo.nombre}>
            <Componente />
          </Ventana>
        );
      })}
    </div>
  );
}
