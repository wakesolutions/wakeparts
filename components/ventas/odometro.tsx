import { monto } from "@/lib/formato";
import styles from "./odometro.module.css";

const DIGITOS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

/**
 * Total del ticket como un odómetro de tablero: cada dígito es una tira que
 * rueda hasta su valor (solo transform). Lectores de pantalla leen el texto.
 */
export function Odometro({ valor, etiqueta = "Total" }: { valor: number; etiqueta?: string }) {
  const texto = monto(valor);
  // Clave desde la derecha: los centavos no se re-montan al crecer el número.
  const chars = [...texto].map((c, i) => ({ c, k: texto.length - i }));
  return (
    <div className={styles.odometro} role="img" aria-label={`${etiqueta}: L ${texto}`}>
      <span className={styles.moneda} aria-hidden="true">
        L
      </span>
      <span className={styles.cifras} aria-hidden="true">
        {chars.map(({ c, k }) =>
          /\d/.test(c) ? (
            <span key={k} className={styles.columna}>
              <span className={styles.tira} style={{ transform: `translate3d(0, ${-Number(c) * 10}%, 0)` }}>
                {DIGITOS.map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </span>
            </span>
          ) : (
            <span key={k} className={styles.separador} data-punto={c === "." || undefined}>
              {c}
            </span>
          ),
        )}
      </span>
    </div>
  );
}
