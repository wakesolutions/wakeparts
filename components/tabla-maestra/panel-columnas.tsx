"use client";

import { useState } from "react";
import ui from "@/components/ui/controles.module.css";
import { IconoAgarre, IconoFlechaAbajo, IconoFlechaArriba } from "@/components/ui/iconos";
import type { DefRecurso } from "@/lib/recursos/tipos";
import styles from "./tabla-maestra.module.css";
import type { ColumnaCfg } from "./utilidades";

type Props = {
  def: DefRecurso;
  columnas: ColumnaCfg[];
  onCambiar: (c: ColumnaCfg[]) => void;
  onRestablecer: () => void;
};

export function PanelColumnas({ def, columnas, onCambiar, onRestablecer }: Props) {
  const [arrastrando, setArrastrando] = useState<number | null>(null);
  const etiqueta = (clave: string) => def.columnas.find((c) => c.clave === clave)?.etiqueta ?? clave;
  const visibles = columnas.filter((c) => c.visible).length;

  function mover(desde: number, hasta: number) {
    if (hasta < 0 || hasta >= columnas.length || desde === hasta) return;
    const copia = [...columnas];
    const [item] = copia.splice(desde, 1);
    copia.splice(hasta, 0, item);
    onCambiar(copia);
  }

  return (
    <div className={styles.panelColumnas}>
      <div className={styles.panelEncabezado}>
        <span className={ui.etiquetaSeccion}>Columnas · {visibles} visibles</span>
        <button type="button" className={`${ui.boton} ${ui.fantasma}`} onClick={onRestablecer}>
          Restablecer
        </button>
      </div>
      <ul className={styles.listaColumnas}>
        {columnas.map((c, i) => (
          <li
            key={c.clave}
            draggable
            data-arrastrando={arrastrando === i || undefined}
            onDragStart={(e) => {
              setArrastrando(i);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => {
              e.preventDefault();
              if (arrastrando !== null && arrastrando !== i) {
                mover(arrastrando, i);
                setArrastrando(i);
              }
            }}
            onDragEnd={() => setArrastrando(null)}
            className={styles.itemColumna}
          >
            <span className={styles.agarre} aria-hidden="true">
              <IconoAgarre tamano={14} />
            </span>
            <label className={styles.opcionCheck}>
              <input
                type="checkbox"
                className={ui.casilla}
                checked={c.visible}
                // Siempre queda al menos una columna visible.
                disabled={c.visible && visibles === 1}
                onChange={() =>
                  onCambiar(columnas.map((x) => (x.clave === c.clave ? { ...x, visible: !x.visible } : x)))
                }
              />
              {etiqueta(c.clave)}
            </label>
            <span className={styles.moverBotones}>
              <button
                type="button"
                className={`${ui.boton} ${ui.fantasma} ${ui.icono}`}
                aria-label={`Subir ${etiqueta(c.clave)}`}
                disabled={i === 0}
                onClick={() => mover(i, i - 1)}
              >
                <IconoFlechaArriba tamano={13} />
              </button>
              <button
                type="button"
                className={`${ui.boton} ${ui.fantasma} ${ui.icono}`}
                aria-label={`Bajar ${etiqueta(c.clave)}`}
                disabled={i === columnas.length - 1}
                onClick={() => mover(i, i + 1)}
              >
                <IconoFlechaAbajo tamano={13} />
              </button>
            </span>
          </li>
        ))}
      </ul>
      <p className={styles.nota}>Arrastrá para reordenar. Se guarda en tu usuario.</p>
    </div>
  );
}
