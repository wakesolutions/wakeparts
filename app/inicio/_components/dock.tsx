"use client";

import { useVentanas } from "@/components/ventanas/contexto";
import styles from "./escritorio.module.css";

export function Dock() {
  const { modulos, ventanas, enfocada, abrir, restaurar, enfocar, minimizarTodas } = useVentanas();
  const fijos = modulos.filter((m) => m.enDock !== false);

  function activar(id: string) {
    const modulo = modulos.find((m) => m.id === id);
    if (!modulo?.componente) return minimizarTodas(); // Inicio: mostrar el escritorio
    const v = ventanas.find((x) => x.id === id);
    if (!v) abrir(id);
    else if (v.estado === "minimizada") restaurar(id);
    else enfocar(id);
  }

  // Minimizadas sin ícono fijo (ventanas hijas y módulos fuera del dock), como en macOS.
  const mosaicos = ventanas.filter(
    (v) => v.estado === "minimizada" && !v.conPadre && (v.titulo || !fijos.some((m) => m.id === v.id)),
  );
  const iconoDe = (id: string) => {
    const v = ventanas.find((x) => x.id === id);
    return modulos.find((m) => m.id === (v?.padre ?? id))?.icono ?? modulos.find((m) => m.id === id)?.icono;
  };
  const nombreDe = (id: string) =>
    ventanas.find((x) => x.id === id)?.titulo ?? modulos.find((m) => m.id === id)?.nombre ?? id;

  return (
    <nav className={styles.dockZona} aria-label="Módulos">
      <ul className={styles.dock}>
        {fijos.map((m, i) => {
          const v = ventanas.find((x) => x.id === m.id);
          const esInicio = !m.componente;
          const activo = esInicio ? enfocada === null : Boolean(v);
          return (
            <li key={m.id} className={styles.dockItem}>
              {i === 1 && <span className={styles.separador} aria-hidden="true" />}
              <button
                type="button"
                className={styles.app}
                data-dock={m.id}
                data-tono={esInicio ? undefined : "metal"}
                aria-current={enfocada === m.id || (esInicio && enfocada === null) ? "page" : undefined}
                onClick={() => activar(m.id)}
              >
                <span className={styles.icono}>{m.icono}</span>
                <span className={styles.tooltip}>{m.nombre}</span>
              </button>
              <span className={styles.indicador} data-activo={activo || undefined} aria-hidden="true" />
            </li>
          );
        })}

        {mosaicos.map((v, i) => (
          <li key={v.id} className={`${styles.dockItem} ${styles.mosaicoItem}`}>
            {i === 0 && <span className={styles.separador} aria-hidden="true" />}
            <button
              type="button"
              className={`${styles.app} ${styles.mosaico}`}
              data-dock={v.id}
              onClick={() => restaurar(v.id)}
              aria-label={`Restaurar ${nombreDe(v.id)}`}
            >
              <span className={styles.icono}>{iconoDe(v.id)}</span>
              <span className={styles.mosaicoTexto} aria-hidden="true">
                {nombreDe(v.id)}
              </span>
              <span className={styles.tooltip}>{nombreDe(v.id)}</span>
            </button>
            <span className={styles.indicador} aria-hidden="true" />
          </li>
        ))}
      </ul>
    </nav>
  );
}
