"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";

export type DefModulo = {
  id: string;
  nombre: string;
  icono: ReactNode;
  /** Contenido de la ventana. Sin componente = acción especial (p. ej. Inicio). */
  componente?: ComponentType;
  tamano?: { w: number; h: number };
  /** false = no tiene ícono fijo en el dock (se abre desde otro lado, p. ej. la barra de menú). */
  enDock?: boolean;
};

export type EstadoVentana = "normal" | "minimizada" | "maximizada";

export type Ventana = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  estado: EstadoVentana;
  /** Estado al que vuelve al restaurarse desde el dock. */
  previo?: Exclude<EstadoVentana, "minimizada">;
  /** Ventanas hijas (formularios, detalles): título propio y ventana padre. */
  titulo?: string;
  padre?: string;
  /** Se minimizó junto con su padre (vuelve con él, sin mosaico propio en el dock). */
  conPadre?: boolean;
};

type Geometria = Pick<Ventana, "x" | "y" | "w" | "h">;

type Contexto = {
  modulos: DefModulo[];
  ventanas: Ventana[];
  enfocada: string | null;
  /** Nodo donde se montan las ventanas (para portales de ventanas hijas). */
  capa: HTMLElement | null;
  registrarCapa: (el: HTMLElement | null) => void;
  abrir: (id: string) => void;
  abrirHija: (id: string, opciones: { titulo: string; padre?: string; tamano?: { w: number; h: number } }) => void;
  renombrar: (id: string, titulo: string) => void;
  cerrar: (id: string) => void;
  minimizar: (id: string) => void;
  restaurar: (id: string) => void;
  alternarMaximizar: (id: string) => void;
  enfocar: (id: string) => void;
  mover: (id: string, g: Partial<Geometria>) => void;
  minimizarTodas: () => void;
};

const Ctx = createContext<Contexto | null>(null);

export const BARRA_ALTO = 34;
export const DOCK_ALTO = 96;
export const ANCHO_MOVIL = 768;
const CLAVE_GEOMETRIA = "wp:ventanas";

const esMovil = () => typeof window !== "undefined" && window.innerWidth < ANCHO_MOVIL;

function leerGeometrias(): Record<string, Geometria & { max?: boolean }> {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_GEOMETRIA) ?? "{}");
  } catch {
    return {};
  }
}

function guardarGeometria(id: string, g: Geometria, max: boolean) {
  try {
    const todas = leerGeometrias();
    todas[id] = { x: g.x, y: g.y, w: g.w, h: g.h, max };
    localStorage.setItem(CLAVE_GEOMETRIA, JSON.stringify(todas));
  } catch {
    // Sin almacenamiento: la ventana abre en la posición por defecto.
  }
}

/** Mantiene la ventana dentro del escritorio visible. */
export function acotar(g: Geometria): Geometria {
  if (typeof window === "undefined") return g;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = Math.min(Math.max(g.w, 360), vw - 16);
  const h = Math.min(Math.max(g.h, 280), vh - BARRA_ALTO - 16);
  return {
    w,
    h,
    x: Math.min(Math.max(g.x, 8 - w + 140), vw - 140),
    y: Math.min(Math.max(g.y, BARRA_ALTO + 6), vh - 60),
  };
}

// ------------------------------------------------------ pantalla completa ---

function entrarPantallaCompleta() {
  const raiz = document.documentElement;
  if (!document.fullscreenElement && raiz.requestFullscreen) {
    raiz.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
    return true;
  }
  return false;
}

function salirPantallaCompleta() {
  if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
}

export function VentanasProvider({ modulos, children }: { modulos: DefModulo[]; children: ReactNode }) {
  const [ventanas, setVentanas] = useState<Ventana[]>([]);
  const [capa, registrarCapa] = useState<HTMLElement | null>(null);
  const zTope = useRef(10);
  // Solo salimos de pantalla completa si fuimos nosotros quienes entramos.
  const pantallaCompletaPropia = useRef(false);

  const actualizar = useCallback((fn: (v: Ventana) => Ventana) => {
    setVentanas((vs) => vs.map(fn));
  }, []);

  /** Lleva la ventana al frente y, encima de ella, a sus hijas visibles. */
  const alFrente = (vs: Ventana[], id: string): Ventana[] => {
    const z = ++zTope.current;
    const conZ = vs.map((x) => (x.id === id ? { ...x, z } : x));
    return conZ.map((x) => (x.padre === id && x.estado !== "minimizada" ? { ...x, z: ++zTope.current } : x));
  };

  const enfocar = useCallback((id: string) => {
    setVentanas((vs) => {
      const v = vs.find((x) => x.id === id);
      if (!v) return vs;
      const hijas = vs.filter((x) => x.padre === id && x.estado !== "minimizada");
      const ya = v.z === zTope.current || (hijas.length > 0 && hijas.every((h) => h.z > v.z) && Math.max(...hijas.map((h) => h.z)) === zTope.current);
      return ya ? vs : alFrente(vs, id);
    });
  }, []);

  const restaurarEn = (vs: Ventana[], id: string): Ventana[] => {
    const z = ++zTope.current;
    return vs.map((v) => {
      if (v.id === id) return { ...v, z, estado: v.estado === "minimizada" ? (v.previo ?? "normal") : v.estado };
      // Las hijas vuelven con la madre, encima de ella.
      if (v.padre === id && v.conPadre) {
        return { ...v, z: ++zTope.current, estado: v.previo ?? "normal", conPadre: false };
      }
      return v;
    });
  };

  const abrir = useCallback(
    (id: string) => {
      const modulo = modulos.find((m) => m.id === id);
      if (!modulo?.componente) return;
      setVentanas((vs) => {
        if (vs.some((v) => v.id === id)) return restaurarEn(vs, id);
        const guardada = leerGeometrias()[id];
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const w = Math.min(modulo.tamano?.w ?? 1100, vw - 32);
        // Al abrir, la ventana no debe quedar tapada por el dock.
        const h = Math.min(modulo.tamano?.h ?? 680, vh - BARRA_ALTO - DOCK_ALTO - 16);
        const base = guardada ?? {
          w,
          h,
          x: Math.round((vw - Math.min(w, vw - 16)) / 2),
          y: Math.round(BARRA_ALTO + Math.max(12, (vh - BARRA_ALTO - DOCK_ALTO - h) / 2)),
        };
        // La posición guardada pudo ser de otra pantalla: que no quede bajo el dock.
        const g = acotar({ ...base, h: Math.min(base.h, vh - BARRA_ALTO - DOCK_ALTO - 16) });
        const y = Math.min(g.y, Math.max(BARRA_ALTO + 6, vh - DOCK_ALTO - g.h - 8));
        const z = ++zTope.current;
        // Pantalla completa no se restaura sola: necesita un gesto del usuario.
        return [...vs, { id, ...g, y, z, estado: esMovil() ? "maximizada" : "normal" }];
      });
    },
    [modulos],
  );

  const abrirHija = useCallback<Contexto["abrirHija"]>((id, { titulo, padre, tamano }) => {
    setVentanas((vs) => {
      if (vs.some((v) => v.id === id)) {
        return restaurarEn(vs, id).map((v) => (v.id === id ? { ...v, titulo } : v));
      }
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const w = Math.min(tamano?.w ?? 520, vw - 32);
      const h = Math.min(tamano?.h ?? 620, vh - BARRA_ALTO - DOCK_ALTO - 16);
      const madre = vs.find((v) => v.id === padre);
      // Centrada sobre la ventana madre (o la pantalla), corrida hacia la derecha.
      const centro =
        madre && madre.estado === "normal"
          ? { x: madre.x + madre.w / 2 + 80, y: madre.y + madre.h / 2 + 12 }
          : { x: vw / 2 + 80, y: BARRA_ALTO + (vh - BARRA_ALTO - DOCK_ALTO) / 2 };
      const g = acotar({ w, h, x: Math.round(centro.x - w / 2), y: Math.round(centro.y - h / 2) });
      const z = ++zTope.current;
      return [...vs, { id, ...g, z, estado: esMovil() ? "maximizada" : "normal", titulo, padre }];
    });
  }, []);

  const renombrar = useCallback(
    (id: string, titulo: string) => actualizar((v) => (v.id === id && v.titulo !== titulo ? { ...v, titulo } : v)),
    [actualizar],
  );

  const cerrar = useCallback((id: string) => {
    setVentanas((vs) => vs.filter((v) => v.id !== id && v.padre !== id));
  }, []);

  const minimizar = useCallback(
    (id: string) =>
      actualizar((v) => {
        if (v.estado === "minimizada") return v;
        if (v.id === id) return { ...v, estado: "minimizada", previo: v.estado, conPadre: false };
        if (v.padre === id) return { ...v, estado: "minimizada", previo: v.estado, conPadre: true };
        return v;
      }),
    [actualizar],
  );

  const restaurar = useCallback((id: string) => setVentanas((vs) => restaurarEn(vs, id)), []);

  const alternarMaximizar = useCallback(
    (id: string) => {
      const actual = ventanas.find((v) => v.id === id);
      if (!actual) return;
      const maximizar = actual.estado !== "maximizada";
      // La API de pantalla completa exige llamarse dentro del gesto del usuario.
      if (!esMovil()) {
        if (maximizar) pantallaCompletaPropia.current = entrarPantallaCompleta() || pantallaCompletaPropia.current;
        else if (!ventanas.some((v) => v.id !== id && v.estado === "maximizada")) salirPantallaCompleta();
      }
      if (!actual.titulo) guardarGeometria(id, actual, false);
      setVentanas((vs) =>
        alFrente(
          vs.map((v) => (v.id === id ? { ...v, estado: maximizar ? "maximizada" : "normal" } : v)),
          id,
        ),
      );
    },
    [ventanas],
  );

  const mover = useCallback(
    (id: string, g: Partial<Geometria>) =>
      actualizar((v) => {
        if (v.id !== id) return v;
        const nueva = { ...v, ...acotar({ x: v.x, y: v.y, w: v.w, h: v.h, ...g }) };
        if (!v.titulo) guardarGeometria(id, nueva, false);
        return nueva;
      }),
    [actualizar],
  );

  const minimizarTodas = useCallback(() => {
    setVentanas((vs) =>
      vs.map((v) => {
        if (v.estado === "minimizada") return v;
        const conMadre = Boolean(v.padre && vs.some((m) => m.id === v.padre));
        return { ...v, estado: "minimizada", previo: v.estado, conPadre: conMadre };
      }),
    );
  }, []);

  // Si el usuario sale de pantalla completa (Esc), las ventanas maximizadas vuelven a su tamaño.
  useEffect(() => {
    const alCambiar = () => {
      if (document.fullscreenElement || !pantallaCompletaPropia.current) return;
      pantallaCompletaPropia.current = false;
      if (!esMovil()) {
        setVentanas((vs) => vs.map((v) => (v.estado === "maximizada" ? { ...v, estado: "normal" } : v)));
      }
    };
    document.addEventListener("fullscreenchange", alCambiar);
    return () => document.removeEventListener("fullscreenchange", alCambiar);
  }, []);

  // Sin ventanas maximizadas visibles, se sale de pantalla completa.
  const hayMaximizada = ventanas.some((v) => v.estado === "maximizada");
  useEffect(() => {
    if (!hayMaximizada && pantallaCompletaPropia.current) {
      pantallaCompletaPropia.current = false;
      salirPantallaCompleta();
    }
  }, [hayMaximizada]);

  const enfocada = useMemo(() => {
    const visibles = ventanas.filter((v) => v.estado !== "minimizada");
    return visibles.length ? visibles.reduce((a, b) => (a.z > b.z ? a : b)).id : null;
  }, [ventanas]);

  const valor: Contexto = {
    modulos,
    ventanas,
    enfocada,
    capa,
    registrarCapa,
    abrir,
    abrirHija,
    renombrar,
    cerrar,
    minimizar,
    restaurar,
    alternarMaximizar,
    enfocar,
    mover,
    minimizarTodas,
  };

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useVentanas() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useVentanas debe usarse dentro de <VentanasProvider>");
  return ctx;
}
