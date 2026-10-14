"use client";

import { useEffect, useState } from "react";
import { useVentanas } from "@/components/ventanas/contexto";
import ui from "@/components/ui/controles.module.css";
import { diasHasta } from "@/lib/suscripcion";
import { useSesion } from "./sesion-contexto";
import styles from "./aviso-plan.module.css";

/**
 * Testigo bajo la barra de menú (0024): con el plan Gratis, en los últimos 3
 * días de la prueba o si un cobro no pasó, invita a abrir el módulo
 * Suscripción. Solo dueño y administradores. Ocultarlo vale 3 días en este
 * navegador (1 día si el cobro falló).
 */

type Caso = "gratis" | "prueba" | "vencida";

const OCULTO_MS: Record<Caso, number> = { gratis: 3 * 86_400_000, prueba: 86_400_000, vencida: 86_400_000 };

function leerOculto(clave: string, caso: Caso) {
  try {
    const t = Number(localStorage.getItem(clave));
    return Number.isFinite(t) && Date.now() - t < OCULTO_MS[caso];
  } catch {
    return false;
  }
}

export function AvisoPlan() {
  const sesion = useSesion();
  const { abrir } = useVentanas();
  const s = sesion.suscripcion;
  const administra = sesion.rol === "dueno" || sesion.rol === "admin";
  const dias = s?.estado === "prueba" ? diasHasta(s.pruebaHasta) : null;

  const caso: Caso | null = !s || !administra
    ? null
    : s.estado === "vencida"
      ? "vencida"
      : dias !== null && dias > 0 && dias <= 3
        ? "prueba"
        : s.planEfectivo === "gratis"
          ? "gratis"
          : null;

  const clave = `wp:aviso-plan:${sesion.empresa?.id}:${caso}`;
  // Se decide en el navegador (localStorage) después de montar: sin parpadeo en el servidor.
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura única del navegador al montar
    setVisible(caso !== null && !leerOculto(clave, caso));
  }, [caso, clave]);

  if (!caso || !visible) return null;

  const esDueno = sesion.rol === "dueno";
  const texto =
    caso === "vencida"
      ? "No pudimos cobrar tu plan. Revisá tu tarjeta para no pasar al plan Gratis."
      : caso === "prueba"
        ? `Tu prueba con todo incluido termina ${dias === 1 ? "mañana" : `en ${dias} días`}. Elegí un plan para no perder módulos.`
        : "Tu taller está en el plan Gratis. Pasate a Arranque, Avance o Pleno para quitar los límites y sumar módulos.";

  function ocultar() {
    try {
      localStorage.setItem(clave, String(Date.now()));
    } catch {
      // sin almacenamiento: solo se oculta en esta vista
    }
    setVisible(false);
  }

  return (
    <div className={styles.aviso} data-caso={caso} role="status">
      <span className={styles.led} aria-hidden="true" />
      <p className={styles.texto}>
        {texto}
        {!esDueno && <span className={styles.nota}> Solo el dueño puede cambiar el plan.</span>}
      </p>
      <button type="button" className={`${ui.boton} ${esDueno ? ui.primario : ""}`} onClick={() => abrir("suscripcion")}>
        {caso === "vencida" ? "Revisar pago" : "Ver planes"}
      </button>
      <button type="button" className={styles.cerrar} onClick={ocultar} aria-label="Ocultar el aviso por unos días">
        <svg viewBox="0 0 12 12" aria-hidden="true">
          <path d="M3 3l6 6M9 3l-6 6" />
        </svg>
      </button>
    </div>
  );
}
