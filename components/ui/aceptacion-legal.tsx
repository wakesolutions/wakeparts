"use client";

import type { ReactNode } from "react";
import { VERSION_LEGAL_TEXTO } from "@/lib/legal";
import ui from "./controles.module.css";
import styles from "./aceptacion-legal.module.css";

/**
 * Casilla «Acepto los Términos de uso y la Política de privacidad». La usan el
 * registro de la empresa y el pago de un plan; el servidor exige que llegue
 * marcada y guarda la constancia (`registrar_aceptacion_legal`, 0026). Los
 * enlaces abren en otra pestaña para no perder lo escrito.
 */
export function AceptacionLegal({
  id,
  marcada,
  onCambiar,
  invalida = false,
  describedBy,
  extra,
}: {
  id: string;
  marcada: boolean;
  onCambiar: (v: boolean) => void;
  invalida?: boolean;
  describedBy?: string;
  /** Texto que se suma a la aceptación (p. ej. la autorización del cobro). */
  extra?: ReactNode;
}) {
  return (
    <div className={styles.aceptacion} data-invalida={invalida || undefined}>
      <input
        id={id}
        type="checkbox"
        className={ui.casilla}
        checked={marcada}
        onChange={(e) => onCambiar(e.target.checked)}
        aria-invalid={invalida || undefined}
        aria-describedby={describedBy}
      />
      <label htmlFor={id}>
        Acepto los{" "}
        <a href="/terminos" target="_blank" rel="noopener">
          Términos de uso
        </a>{" "}
        y la{" "}
        <a href="/privacidad" target="_blank" rel="noopener">
          Política de privacidad
        </a>{" "}
        de Wake Parts (versión del {VERSION_LEGAL_TEXTO}){extra ? <> {extra}</> : "."}
      </label>
    </div>
  );
}
