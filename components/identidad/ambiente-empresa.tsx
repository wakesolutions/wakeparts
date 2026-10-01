"use client";

import type { CSSProperties } from "react";
import { cssAcento } from "@/lib/identidad";
import { useIdentidad } from "./contexto";
import styles from "./identidad.module.css";

/**
 * Lo que hace que el escritorio sea «de la empresa»: el color de marca (tokens
 * de acento) y el fondo de pantalla, con un velo del color de la paleta para
 * que la barra, el saludo y las ventanas se sigan leyendo.
 */
export function AmbienteEmpresa() {
  const { identidad } = useIdentidad();
  const css = cssAcento(identidad.acento);
  const { fondo, atenuar } = identidad;

  return (
    <>
      {css && <style>{css}</style>}
      {fondo && (
        <div
          key={fondo}
          className={styles.fondo}
          aria-hidden="true"
          style={
            {
              backgroundImage: [
                // Más velo a la izquierda, donde va el saludo.
                `linear-gradient(90deg, color-mix(in oklab, var(--wp-bg) ${Math.min(92, atenuar + 30)}%, transparent), transparent 70%)`,
                `linear-gradient(color-mix(in oklab, var(--wp-bg) ${atenuar}%, transparent), color-mix(in oklab, var(--wp-bg) ${atenuar}%, transparent))`,
                `url("${fondo}")`,
              ].join(", "),
            } as CSSProperties
          }
        />
      )}
    </>
  );
}
