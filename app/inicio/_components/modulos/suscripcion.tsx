"use client";

import { Suscripcion } from "@/components/suscripcion/suscripcion";
import styles from "./modulos.module.css";

/** Suscripción del taller (0024): plan, consumo, pago y cancelación. Paga o cancela solo el dueño. */
export function ModuloSuscripcion() {
  return (
    <div className={styles.hojaModulo}>
      <Suscripcion />
    </div>
  );
}
