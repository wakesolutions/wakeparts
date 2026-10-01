"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { IDENTIDAD_VACIA, type Identidad } from "@/lib/identidad";

type Ctx = {
  /** Lo que se ve ahora: lo guardado más la vista previa en curso. */
  identidad: Identidad;
  /** Lo guardado en la base. */
  guardada: Identidad;
  /** Muestra un cambio en vivo sin guardarlo. */
  previsualizar(cambio: Partial<Identidad>): void;
  /** Descarta la vista previa. */
  descartar(): void;
  /** Marca un cambio como guardado (antes de que el servidor refresque la sesión). */
  confirmar(cambio: Partial<Identidad>): void;
};

const Contexto = createContext<Ctx>({
  identidad: IDENTIDAD_VACIA,
  guardada: IDENTIDAD_VACIA,
  previsualizar: () => {},
  descartar: () => {},
  confirmar: () => {},
});

/**
 * Identidad de la empresa activa para todo el escritorio: el fondo, el color de
 * marca y el formato de documentos se ven en vivo mientras se editan en Taller.
 */
export function IdentidadProvider({ inicial, children }: { inicial: Identidad; children: ReactNode }) {
  const [guardada, setGuardada] = useState(inicial);
  const [previa, setPrevia] = useState<Partial<Identidad>>({});

  // Cuando el servidor trae otra identidad (router.refresh tras guardar), manda
  // la base. Se compara por valor: cada refresh trae un objeto nuevo aunque no cambie.
  const firma = JSON.stringify(inicial);
  const [anterior, setAnterior] = useState(firma);
  if (anterior !== firma) {
    setAnterior(firma);
    setGuardada(inicial);
  }

  const previsualizar = useCallback((cambio: Partial<Identidad>) => setPrevia((p) => ({ ...p, ...cambio })), []);
  const descartar = useCallback(() => setPrevia({}), []);
  const confirmar = useCallback((cambio: Partial<Identidad>) => {
    setGuardada((g) => ({ ...g, ...cambio }));
    setPrevia((p) => {
      const resto = { ...p };
      for (const k of Object.keys(cambio)) delete resto[k as keyof Identidad];
      return resto;
    });
  }, []);

  const valor = useMemo(
    () => ({ identidad: { ...guardada, ...previa }, guardada, previsualizar, descartar, confirmar }),
    [guardada, previa, previsualizar, descartar, confirmar],
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useIdentidad() {
  return useContext(Contexto);
}
