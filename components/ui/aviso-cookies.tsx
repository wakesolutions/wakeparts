"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./aviso-cookies.module.css";

const CLAVE = "wp:aviso-cookies";

/**
 * Aviso de cookies. Wake Parts solo usa cookies necesarias (sesión y paleta),
 * así que es informativo: no hay nada opcional que aceptar o rechazar.
 * Si algún día se agrega analítica o publicidad, esto debe pasar a pedir
 * consentimiento ANTES de cargarlas (ver docs/bitacora.md).
 */
export function AvisoCookies() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let visto = false;
    try {
      visto = localStorage.getItem(CLAVE) !== null;
    } catch {
      // Sin almacenamiento: se muestra y se oculta al cerrar (vuelve en la próxima visita).
    }
    if (visto) return;
    const t = setTimeout(() => setVisible(true), 1200);
    return () => clearTimeout(t);
  }, []);

  function cerrar() {
    setVisible(false);
    try {
      localStorage.setItem(CLAVE, new Date().toISOString());
    } catch {
      // sin almacenamiento
    }
  }

  if (!visible) return null;

  return (
    <section className={styles.aviso} role="region" aria-label="Aviso de cookies">
      <span className={styles.led} aria-hidden="true" />
      <p className={styles.texto}>
        <strong>Usamos solo cookies necesarias:</strong> para mantener tu sesión iniciada y recordar los colores de tu
        taller. Nada de publicidad ni rastreo.{" "}
        <Link href="/cookies" className={styles.enlace}>
          Más información
        </Link>
      </p>
      <button type="button" className={styles.boton} onClick={cerrar}>
        Entendido
      </button>
    </section>
  );
}
