import type { CSSProperties } from "react";
import { centavos, moneda } from "@/lib/formato";
import styles from "./contabilidad.module.css";

/**
 * Nivel de burbuja (momento firma de la contabilidad): la burbuja se corre
 * hacia el lado que pesa más y se centra, en verde, cuando debe = haber.
 */
export function Nivel({ debe, haber, compacto }: { debe: number; haber: number; compacto?: boolean }) {
  const diferencia = centavos(debe - haber);
  const cuadra = diferencia === 0;
  const escala = Math.max(debe, haber, 1);
  // Lado del haber a la derecha: si pesa más el debe, la burbuja (aire) sube hacia el haber.
  const corrimiento = Math.max(-1, Math.min(1, (diferencia / escala) * 3));
  return (
    <div
      className={styles.nivel}
      data-cuadra={cuadra || undefined}
      data-vacio={(debe === 0 && haber === 0) || undefined}
      data-compacto={compacto || undefined}
      style={{ "--corrimiento": corrimiento } as CSSProperties}
      role="img"
      aria-label={
        debe === 0 && haber === 0
          ? "Sin movimientos"
          : cuadra
            ? `Cuadra: debe y haber ${moneda(debe)}`
            : `No cuadra: diferencia de ${moneda(Math.abs(diferencia))}`
      }
    >
      <div className={styles.nivelLado}>
        <span className={styles.etiqueta}>Debe</span>
        <strong>{moneda(debe)}</strong>
      </div>
      <div className={styles.tubo} aria-hidden="true">
        <span className={styles.marcaIzq} />
        <span className={styles.marcaDer} />
        <span className={styles.burbuja} />
      </div>
      <div className={styles.nivelLado} data-lado="haber">
        <span className={styles.etiqueta}>Haber</span>
        <strong>{moneda(haber)}</strong>
      </div>
      <p className={styles.nivelLectura}>
        {debe === 0 && haber === 0 ? "Sin movimientos" : cuadra ? "Cuadra" : `Diferencia ${moneda(Math.abs(diferencia))}`}
      </p>
    </div>
  );
}
