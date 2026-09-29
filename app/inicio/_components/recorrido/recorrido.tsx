"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { marcarRecorrido } from "@/app/acciones/perfil";
import { useVentanas } from "@/components/ventanas/contexto";
import ui from "@/components/ui/controles.module.css";
import { useSesion } from "../sesion-contexto";
import { PASOS, type ContextoPaso } from "./pasos";
import styles from "./recorrido.module.css";

type Rect = { x: number; y: number; w: number; h: number };

const Ctx = createContext<{ iniciar: () => void } | null>(null);

/** Para «Repetir recorrido» (Mi usuario). */
export function useRecorrido() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useRecorrido debe usarse dentro del escritorio");
  return c;
}

const clave = (usuario: string) => `wp:recorrido:${usuario}`;

function vistoLocal(usuario: string) {
  try {
    return localStorage.getItem(clave(usuario)) !== null;
  } catch {
    return false;
  }
}

function guardarLocal(usuario: string, visto: boolean) {
  try {
    if (visto) localStorage.setItem(clave(usuario), new Date().toISOString());
    else localStorage.removeItem(clave(usuario));
  } catch {
    // Sin almacenamiento: queda la marca en la base.
  }
}

/**
 * Recorrido guiado del escritorio. Sale solo la primera vez (la marca vive en
 * `usuarios.recorrido_visto_en`; si la base no la tiene, en este navegador).
 * `pendiente`: true/false desde la base, null = no se sabe.
 */
export function RecorridoProvider({ pendiente, children }: { pendiente: boolean | null; children: ReactNode }) {
  const sesion = useSesion();
  const [activo, setActivo] = useState(false);
  const usuario = sesion.usuario.id;

  useEffect(() => {
    const mostrar = pendiente ?? !vistoLocal(usuario);
    if (!mostrar) return;
    // Después de la entrada del escritorio.
    const t = setTimeout(() => setActivo(true), 900);
    return () => clearTimeout(t);
  }, [pendiente, usuario]);

  const terminar = useCallback(() => {
    setActivo(false);
    guardarLocal(usuario, true);
    void marcarRecorrido(true).catch(() => {});
  }, [usuario]);

  const valor = useMemo(
    () => ({
      iniciar: () => {
        guardarLocal(usuario, false);
        setActivo(true);
      },
    }),
    [usuario],
  );

  return (
    <Ctx.Provider value={valor}>
      {children}
      {activo && <Recorrido onTerminar={terminar} />}
    </Ctx.Provider>
  );
}

function medir(selector?: string): Rect | null {
  if (!selector) return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > window.innerHeight) return null;
  return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
}

const MARGEN = 8;
const ANCHO_TARJETA = 348;

/** Dónde va la tarjeta: debajo, arriba, a la derecha o a la izquierda del objetivo; si no cabe, abajo al centro. */
function ubicar(r: Rect | null, alto: number) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const ancho = Math.max(240, Math.min(ANCHO_TARJETA, vw - 24));
  const centroX = (x: number) => Math.min(Math.max(12, x), vw - ancho - 12);
  if (!r) return { x: (vw - ancho) / 2, y: Math.max(12, (vh - alto) / 2), ancho };
  const hueco = 16;
  const abajo = r.y + r.h + MARGEN + hueco;
  const arriba = r.y - MARGEN - hueco - alto;
  if (abajo + alto < vh - 12) return { x: centroX(r.x + r.w / 2 - ancho / 2), y: abajo, ancho };
  if (arriba > 12) return { x: centroX(r.x + r.w / 2 - ancho / 2), y: arriba, ancho };
  const derecha = r.x + r.w + MARGEN + hueco;
  const yLado = Math.min(Math.max(12, r.y + r.h / 2 - alto / 2), vh - alto - 12);
  if (derecha + ancho < vw - 12) return { x: derecha, y: yLado, ancho };
  const izquierda = r.x - MARGEN - hueco - ancho;
  if (izquierda > 12) return { x: izquierda, y: yLado, ancho };
  return { x: (vw - ancho) / 2, y: vh - alto - 24, ancho };
}

function Recorrido({ onTerminar }: { onTerminar: () => void }) {
  const sesion = useSesion();
  const { ventanas, abrir, minimizarTodas } = useVentanas();
  const pasos = useMemo(() => PASOS.filter((p) => !p.aplica || p.aplica({ sesion })), [sesion]);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  // Tamaño de la pantalla: también lo sigue el bucle, para reubicar la tarjeta.
  const [, setVista] = useState("");
  const [alto, setAlto] = useState(200);
  const tarjeta = useRef<HTMLDivElement>(null);
  const paso = pasos[i];
  const ultimo = i === pasos.length - 1;

  // Lo último del contexto, para leerlo desde efectos sin re-suscribirse.
  const ctx = useRef<ContextoPaso>({ ventanas, sesion, abrir, minimizarTodas });
  useEffect(() => {
    ctx.current = { ventanas, sesion, abrir, minimizarTodas };
  });

  // Preparar la pantalla al entrar a cada paso.
  useEffect(() => {
    paso.preparar?.(ctx.current);
  }, [paso]);

  // Si el usuario ya hizo lo que pedía el paso, seguimos.
  const hecho = paso.listo?.({ ventanas, sesion, abrir, minimizarTodas }) ?? false;
  useEffect(() => {
    if (!hecho || ultimo) return;
    const t = setTimeout(() => setI((x) => x + 1), 450);
    return () => clearTimeout(t);
  }, [hecho, ultimo]);

  // Sigue al objetivo mientras se mueve (ventanas que se abren, scroll, cambio de tamaño).
  // requestAnimationFrame para seguirlo fluido; el intervalo es respaldo si el navegador pausa los cuadros.
  useEffect(() => {
    let cuadro = 0;
    let previo = "";
    const medirAhora = () => {
      const r = medir(paso.objetivo);
      const vista = `${window.innerWidth}x${window.innerHeight}`;
      const firma = (r ? `${r.x},${r.y},${r.w},${r.h}` : "") + "|" + vista;
      if (firma !== previo) {
        previo = firma;
        setRect(r);
        setVista(vista);
      }
    };
    const seguir = () => {
      medirAhora();
      cuadro = requestAnimationFrame(seguir);
    };
    seguir();
    const respaldo = setInterval(medirAhora, 250);
    return () => {
      cancelAnimationFrame(cuadro);
      clearInterval(respaldo);
    };
  }, [paso]);

  const hayObjetivo = rect !== null;
  useLayoutEffect(() => {
    if (tarjeta.current) setAlto(tarjeta.current.offsetHeight);
  }, [i, hayObjetivo]);

  // Primer paso: el foco va a la tarjeta. Después no se roba (el usuario puede estar escribiendo).
  useEffect(() => {
    if (i === 0) tarjeta.current?.querySelector<HTMLButtonElement>("[data-principal]")?.focus();
  }, [i]);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const escribiendo = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (e.key === "Escape" && !escribiendo) onTerminar();
      else if (!escribiendo && e.key === "ArrowRight") setI((x) => Math.min(x + 1, pasos.length - 1));
      else if (!escribiendo && e.key === "ArrowLeft") setI((x) => Math.max(x - 1, 0));
    };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [onTerminar, pasos.length]);

  const pos = ubicar(rect, alto);
  const hueco = rect && { x: rect.x - MARGEN, y: rect.y - MARGEN, w: rect.w + MARGEN * 2, h: rect.h + MARGEN * 2 };

  return createPortal(
    <div className={styles.capa}>
      {/* Sin objetivo el velo cubre todo; con objetivo, el foco lo recorta. */}
      <div className={styles.velo} data-visible={!hueco || undefined} aria-hidden="true" />
      <div
        className={styles.foco}
        data-visible={hueco ? "" : undefined}
        aria-hidden="true"
        style={
          hueco
            ? { transform: `translate3d(${hueco.x}px, ${hueco.y}px, 0)`, width: hueco.w, height: hueco.h }
            : undefined
        }
      />

      <div
        ref={tarjeta}
        className={styles.tarjeta}
        role="dialog"
        aria-modal="false"
        aria-labelledby="recorrido-titulo"
        style={{ transform: `translate3d(${Math.round(pos.x)}px, ${Math.round(pos.y)}px, 0)`, width: pos.ancho }}
      >
        <div className={styles.cabecera}>
          <span className={styles.etiqueta}>
            Recorrido · {i + 1}/{pasos.length}
          </span>
          <ol className={styles.progreso} aria-hidden="true">
            {pasos.map((p, n) => (
              <li key={p.id} data-estado={n < i ? "hecho" : n === i ? "actual" : undefined} />
            ))}
          </ol>
        </div>
        <div className={styles.cuerpo} key={paso.id} aria-live="polite">
          <h2 id="recorrido-titulo" className={styles.titulo}>
            {paso.titulo}
          </h2>
          <p className={styles.texto}>{paso.texto}</p>
        </div>
        <div className={styles.botones}>
          <button type="button" className={styles.saltar} onClick={onTerminar}>
            {i === 0 ? "Ahora no" : "Salir"}
          </button>
          {i > 0 && (
            <button type="button" className={`${ui.boton} ${ui.fantasma}`} onClick={() => setI(i - 1)}>
              Anterior
            </button>
          )}
          <button
            type="button"
            data-principal=""
            className={`${ui.boton} ${ui.primario}`}
            onClick={() => (ultimo ? onTerminar() : setI(i + 1))}
          >
            {i === 0 ? "Empezar" : ultimo ? "Listo" : "Siguiente"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
