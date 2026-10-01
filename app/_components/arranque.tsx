"use client";

import { useFormStatus } from "react-dom";
import { iniciarSesionConGoogle } from "@/app/auth/actions";
import styles from "./arranque.module.css";

const RPM_MAX = 8000;
const REDLINE = 6500;
const C = 200; // centro del viewBox

/** 0 rpm → -120°, 8000 rpm → +120° */
const angulo = (rpm: number) => -120 + (rpm / RPM_MAX) * 240;

function polar(r: number, grados: number) {
  const rad = (grados * Math.PI) / 180;
  return { x: C + r * Math.sin(rad), y: C - r * Math.cos(rad) };
}

function arco(r: number, desde: number, hasta: number) {
  const a = polar(r, desde);
  const b = polar(r, hasta);
  const grande = hasta - desde > 180 ? 1 : 0;
  return `M ${a.x} ${a.y} A ${r} ${r} 0 ${grande} 1 ${b.x} ${b.y}`;
}

const MARCAS = Array.from({ length: RPM_MAX / 250 + 1 }, (_, i) => i * 250);

function Tacometro() {
  const { pending } = useFormStatus();

  return (
    <svg
      viewBox="0 0 400 400"
      className={styles.dial}
      data-revolucionando={pending || undefined}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="wp-dial-fondo" cx="50%" cy="42%" r="60%">
          <stop offset="0%" stopColor="var(--wp-dial)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="var(--wp-dial)" />
        </radialGradient>
      </defs>

      <circle cx={C} cy={C} r={196} fill="url(#wp-dial-fondo)" />

      {/* Zona roja */}
      <path
        d={arco(183, angulo(REDLINE), angulo(RPM_MAX))}
        className={styles.zonaRoja}
      />

      {MARCAS.map((rpm) => {
        const mayor = rpm % 1000 === 0;
        const roja = rpm >= REDLINE;
        return (
          <line
            key={rpm}
            x1={C}
            y1={C - 178}
            x2={C}
            y2={C - (mayor ? 156 : 168)}
            transform={`rotate(${angulo(rpm)} ${C} ${C})`}
            className={roja ? styles.marcaRoja : styles.marca}
            strokeWidth={mayor ? 3.5 : 1.5}
          />
        );
      })}

      {MARCAS.filter((rpm) => rpm % 1000 === 0).map((rpm) => {
        const p = polar(134, angulo(rpm));
        return (
          <text
            key={rpm}
            x={p.x}
            y={p.y}
            className={rpm >= REDLINE ? styles.numeroRojo : styles.numero}
          >
            {rpm / 1000}
          </text>
        );
      })}

      <text x={C} y={C + 118} className={styles.unidad}>
        ×1000 r/min
      </text>

      {/* Aguja: el grupo externo hace el barrido, el interno la vibración */}
      <g className={styles.aguja}>
        <g className={styles.vibracion}>
          <path
            d={`M ${C - 5} ${C - 40} L ${C - 1.4} ${C - 176} L ${C + 1.4} ${C - 176} L ${C + 5} ${C - 40} Z`}
            className={styles.agujaCuerpo}
          />
        </g>
      </g>
    </svg>
  );
}

function BotonArranque() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={styles.boton}
    >
      <span className={styles.bisel} aria-hidden="true" />
      <span className={styles.anillo} aria-hidden="true" />
      <span className={styles.tapa}>
        <span className={styles.etiqueta}>
          {pending ? "Entrando" : "Entrar"}
        </span>
      </span>
    </button>
  );
}

function Lectura() {
  const { pending } = useFormStatus();
  return (
    <p className={styles.lcd} role="status" aria-live="polite">
      <span className={styles.led} data-activo={pending || undefined} />
      {pending ? "Conectando…" : "Listo"}
    </p>
  );
}

export function Arranque({ error }: { error?: string }) {
  return (
    <form action={iniciarSesionConGoogle} className={styles.instrumento}>
      <div className={styles.cluster}>
        <Tacometro />
        <BotonArranque />
      </div>
      <Lectura />
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

