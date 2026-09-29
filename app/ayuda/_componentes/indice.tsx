"use client";

import { useEffect, useRef, useState } from "react";
import styles from "../ayuda.module.css";

export type EntradaIndice = { id: string; numero: string; titulo: string };

/** Índice del manual: el LED marca el capítulo que se está leyendo. */
export function Indice({ capitulos }: { capitulos: EntradaIndice[] }) {
  const [actual, setActual] = useState(capitulos[0]?.id);
  const nav = useRef<HTMLElement>(null);

  // En móvil el índice es una tira horizontal: que el capítulo activo quede a la vista.
  useEffect(() => {
    const tira = nav.current;
    const enlace = tira?.querySelector<HTMLElement>("[aria-current]");
    if (!tira || !enlace || tira.scrollWidth <= tira.clientWidth) return;
    const destino = enlace.offsetLeft - (tira.clientWidth - enlace.offsetWidth) / 2;
    tira.scrollTo({ left: destino, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [actual]);

  useEffect(() => {
    const visibles = new Map<string, number>();
    const obs = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) visibles.set(e.target.id, e.isIntersecting ? e.boundingClientRect.top : Infinity);
        // El capítulo activo es el primero (más arriba) que sigue en pantalla.
        const [primero] = [...visibles].filter(([, top]) => top !== Infinity).sort((a, b) => a[1] - b[1]);
        if (primero) setActual(primero[0]);
      },
      { rootMargin: "-20% 0px -55% 0px" },
    );
    for (const c of capitulos) {
      const el = document.getElementById(c.id);
      if (el) obs.observe(el);
    }
    return () => obs.disconnect();
  }, [capitulos]);

  return (
    <nav ref={nav} className={styles.indice} aria-label="Capítulos del manual">
      <p className={styles.indiceEtiqueta}>Índice</p>
      <ol>
        {capitulos.map((c) => (
          <li key={c.id}>
            <a href={`#${c.id}`} aria-current={actual === c.id ? "location" : undefined}>
              <span className={styles.indiceNumero}>{c.numero}</span>
              {c.titulo}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
