"use client";

import { Seguimiento } from "@/components/seguimiento/seguimiento";
import styles from "./modulos.module.css";

/** Seguimiento: talleres registrados y qué tanto lo usan. Solo el admin de Wake Parts. */
export function ModuloSeguimiento() {
  return (
    <div className={styles.cuerpoPropio}>
      <Seguimiento />
    </div>
  );
}
