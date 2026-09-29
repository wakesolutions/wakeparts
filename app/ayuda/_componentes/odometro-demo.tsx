"use client";

import { useEffect, useState } from "react";
import { Odometro } from "@/components/ventas/odometro";
import { calcularTotales } from "@/lib/ventas";
import { monto } from "@/lib/formato";
import styles from "../ayuda.module.css";

// Un ticket de ejemplo que se va armando: cada paso agrega una línea (precios sin ISV).
const PASOS = [
  { descripcion: "Pastillas de freno delanteras", precio: 820, cantidad: 1 },
  { descripcion: "Disco de freno delantero", precio: 1620, cantidad: 2 },
  { descripcion: "Líquido de frenos DOT 4", precio: 195, cantidad: 1 },
  { descripcion: "Cambio de pastillas (mano de obra)", precio: 350, cantidad: 1 },
];

/** El visor del total del mostrador, con un carrito que se llena solo. */
export function OdometroDemo() {
  const [n, setN] = useState(PASOS.length);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setN((x) => (x >= PASOS.length ? 1 : x + 1)), 2200);
    return () => clearInterval(id);
  }, []);

  const lineas = PASOS.slice(0, n);
  const t = calcularTotales(
    lineas.map((l) => ({ cantidad: l.cantidad, precio: l.precio, descuento_pct: 0, exento: false, costo: 0 })),
    0,
  );

  return (
    <div className={styles.ticketDemo}>
      <ul className={styles.ticketLineas}>
        {PASOS.map((l, i) => (
          <li key={l.descripcion} data-fuera={i >= n || undefined}>
            <span>
              {l.cantidad} × {l.descripcion}
            </span>
            <span className={styles.mono}>L {monto(l.precio * l.cantidad)}</span>
          </li>
        ))}
      </ul>
      <dl className={styles.ticketTotales}>
        <div>
          <dt>Subtotal</dt>
          <dd>L {monto(t.subtotal)}</dd>
        </div>
        <div>
          <dt>ISV 15 %</dt>
          <dd>L {monto(t.isv)}</dd>
        </div>
      </dl>
      <Odometro valor={t.total} />
    </div>
  );
}
