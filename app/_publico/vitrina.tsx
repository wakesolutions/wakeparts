"use client";

import Image from "next/image";
import { useState, type KeyboardEvent } from "react";
import { CAPTURAS } from "./capturas";
import styles from "./publico.module.css";

/** Capturas reales de la app (sandbox con datos de ejemplo) en un monitor de tablero. */
export function Vitrina() {
  const [actual, setActual] = useState(0);
  const c = CAPTURAS[actual];

  function teclas(e: KeyboardEvent) {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const n = (actual + (e.key === "ArrowRight" ? 1 : -1) + CAPTURAS.length) % CAPTURAS.length;
      setActual(n);
      document.getElementById(`vitrina-${CAPTURAS[n].id}`)?.focus();
    }
  }

  return (
    <div className={styles.vitrina}>
      <div className={styles.vitrinaPestanas} role="tablist" aria-label="Pantallas de Wake Parts" onKeyDown={teclas}>
        {CAPTURAS.map((x, i) => (
          <button
            key={x.id}
            id={`vitrina-${x.id}`}
            type="button"
            role="tab"
            aria-selected={i === actual}
            aria-controls="vitrina-panel"
            tabIndex={i === actual ? 0 : -1}
            className={styles.vitrinaPestana}
            onClick={() => setActual(i)}
          >
            {x.pestana}
          </button>
        ))}
      </div>

      <div id="vitrina-panel" role="tabpanel" aria-labelledby={`vitrina-${c.id}`} className={styles.monitor}>
        <div className={styles.monitorPantalla} data-tipo={c.id}>
          {CAPTURAS.map((x, i) => (
            <div key={x.id} className={styles.monitorCapa} data-visible={i === actual || undefined} aria-hidden={i !== actual}>
              <div className={x.id === "celular" ? styles.telefono : styles.monitorImagen}>
                <Image
                  src={x.src}
                  alt={x.alt}
                  width={x.ancho}
                  height={x.alto}
                  sizes={x.id === "celular" ? "(max-width: 900px) 60vw, 300px" : "(max-width: 1320px) 94vw, 1220px"}
                  priority={i === 0}
                  loading={i === 0 ? undefined : "lazy"}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.vitrinaLeyenda} key={c.id}>
        <span className={styles.vitrinaNumero}>{String(actual + 1).padStart(2, "0")} / {String(CAPTURAS.length).padStart(2, "0")}</span>
        <div>
          <p className={styles.vitrinaTitulo}>{c.titulo}</p>
          <p className={styles.vitrinaTexto}>{c.texto}</p>
        </div>
      </div>
    </div>
  );
}
