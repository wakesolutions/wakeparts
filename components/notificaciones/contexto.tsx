"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useApi } from "@/components/datos/apis";
import { useVentanas } from "@/components/ventanas/contexto";
import { EVENTO_NOTIFICACIONES, pedirDestino } from "@/lib/ir-a";
import { BANDEJA_VACIA, type BandejaNotificaciones, type Notificacion } from "@/lib/notificaciones";

/** Cada cuánto se consulta la bandeja con la pestaña visible. */
const INTERVALO_MS = 30_000;

type Ctx = {
  bandeja: BandejaNotificaciones;
  /** Tareas que llegaron mientras el escritorio estaba abierto (para el aviso emergente). */
  recien: Notificacion[];
  descartarRecien(id: string): void;
  marcarLeidas(ids?: string[]): void;
  /** Abre lo que señala la notificación (módulo, sección y registro) y la marca leída. */
  irA(n: Notificacion): void;
  refrescar(): void;
};

const Contexto = createContext<Ctx>({
  bandeja: BANDEJA_VACIA,
  recien: [],
  descartarRecien: () => {},
  marcarLeidas: () => {},
  irA: () => {},
  refrescar: () => {},
});

/**
 * Campanita del escritorio: consulta la bandeja cada 30 s (solo con la pestaña
 * visible), al volver a la pestaña y cuando otro componente avisa un cambio.
 * Sin websockets: la llave de Supabase no llega al navegador (regla 7).
 */
export function NotificacionesProvider({ children }: { children: ReactNode }) {
  const api = useApi("notificaciones");
  const { abrir } = useVentanas();
  const [bandeja, setBandeja] = useState<BandejaNotificaciones>(BANDEJA_VACIA);
  const [recien, setRecien] = useState<Notificacion[]>([]);
  const conocidas = useRef<Set<string> | null>(null);

  const refrescar = useCallback(() => {
    api
      .leer()
      .then((b) => {
        setBandeja(b);
        const previas = conocidas.current;
        conocidas.current = new Set(b.items.map((n) => n.id));
        // En la primera carga no se avisa: solo lo que llega después.
        if (previas) {
          const nuevas = b.items.filter((n) => n.pendiente && !n.leida && !previas.has(n.id));
          if (nuevas.length) setRecien((r) => [...nuevas, ...r].slice(0, 3));
        }
      })
      .catch(() => {});
  }, [api]);

  useEffect(() => {
    refrescar();
    const intervalo = setInterval(() => {
      if (document.visibilityState === "visible") refrescar();
    }, INTERVALO_MS);
    const alVolver = () => document.visibilityState === "visible" && refrescar();
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener(EVENTO_NOTIFICACIONES, refrescar);
    return () => {
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener(EVENTO_NOTIFICACIONES, refrescar);
    };
  }, [refrescar]);

  const marcarLeidas = useCallback(
    (ids?: string[]) => {
      // Optimista: la insignia baja al instante.
      setBandeja((b) => {
        const items = b.items.map((n) => (!ids || ids.includes(n.id) ? { ...n, leida: true } : n));
        return { ...b, items, noLeidas: items.filter((n) => !n.leida).length };
      });
      api.marcarLeidas(ids).catch(() => {});
    },
    [api],
  );

  const descartarRecien = useCallback((id: string) => setRecien((r) => r.filter((n) => n.id !== id)), []);

  const irA = useCallback(
    (n: Notificacion) => {
      if (!n.leida) marcarLeidas([n.id]);
      descartarRecien(n.id);
      if (n.enlace.modulo) {
        abrir(n.enlace.modulo);
        pedirDestino(n.enlace);
      }
    },
    [abrir, marcarLeidas, descartarRecien],
  );

  const valor = useMemo(
    () => ({ bandeja, recien, descartarRecien, marcarLeidas, irA, refrescar }),
    [bandeja, recien, descartarRecien, marcarLeidas, irA, refrescar],
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useNotificaciones() {
  return useContext(Contexto);
}
