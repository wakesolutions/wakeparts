"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { cambiarPaletaEmpresa } from "@/app/acciones/empresa";
import { cerrarSesion } from "@/app/auth/actions";
import { useIdentidad } from "@/components/identidad/contexto";
import { useVentanas } from "@/components/ventanas/contexto";
import { PALETAS, type PaletaId } from "@/lib/paletas";
import { aplicarPaleta } from "@/lib/paletas-cliente";
import { useSesion } from "./sesion-contexto";
import styles from "./escritorio.module.css";

function suscribirMinuto(avisar: () => void) {
  const id = setInterval(avisar, 15_000);
  return () => clearInterval(id);
}
const minutoActual = () => Math.floor(Date.now() / 60_000) * 60_000;
const sinHora = () => null;

function Reloj() {
  const ms = useSyncExternalStore(suscribirMinuto, minutoActual, sinHora);
  if (ms === null) return <span className={styles.reloj} />;

  const ahora = new Date(ms);
  const texto = new Intl.DateTimeFormat("es-HN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(ahora);

  return (
    <time className={styles.reloj} dateTime={ahora.toISOString()}>
      {texto}
    </time>
  );
}

function SelectorPaleta({ inicial }: { inicial: PaletaId }) {
  const [actual, setActual] = useState(inicial);
  const [, iniciar] = useTransition();

  function elegir(id: PaletaId) {
    const anterior = actual;
    aplicarPaleta(id);
    setActual(id);
    iniciar(async () => {
      const r = await cambiarPaletaEmpresa(id).catch(() => ({ ok: false as const }));
      if (!r.ok) {
        aplicarPaleta(anterior);
        setActual(anterior);
      }
    });
  }

  return (
    <div className={styles.paletas} role="radiogroup" aria-label="Paleta de la empresa">
      {PALETAS.map((p) => (
        <button
          key={p.id}
          type="button"
          role="radio"
          aria-checked={actual === p.id}
          aria-label={p.nombre}
          title={`Paleta ${p.nombre}`}
          onClick={() => elegir(p.id)}
          className={styles.perilla}
          style={{ background: `linear-gradient(135deg, ${p.muestra[0]} 50%, ${p.muestra[1]} 50%)` }}
        />
      ))}
    </div>
  );
}

export function BarraMenu() {
  const { usuario, empresa, rol } = useSesion();
  const { identidad } = useIdentidad();
  const { enfocada, modulos, ventanas, abrir } = useVentanas();
  const moduloActivo =
    ventanas.find((v) => v.id === enfocada)?.titulo ?? modulos.find((m) => m.id === enfocada)?.nombre;
  const administra = rol === "dueno" || rol === "admin";

  return (
    <header className={`wp-metal ${styles.barra}`}>
      <div className={styles.barraIzquierda}>
        {identidad.logo ? (
          // Con logo, la barra es de la empresa: su logo y su nombre van primero.
          <span className={styles.marcaEmpresa}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={identidad.logo} alt="" className={styles.logo} />
            {empresa?.nombre}
          </span>
        ) : (
          <span className={styles.marca}>
            Wake<span className="text-wp-accent">Parts</span>
          </span>
        )}
        <span className={styles.moduloActivo} key={moduloActivo ?? "escritorio"}>
          {moduloActivo ?? "Escritorio"}
        </span>
        {empresa && !identidad.logo && <span className={styles.empresa}>{empresa.nombre}</span>}
      </div>

      <div className={styles.barraDerecha}>
        {empresa && administra && <SelectorPaleta key={empresa.paleta} inicial={empresa.paleta} />}
        <Reloj />
        <button
          type="button"
          className={styles.usuario}
          title={`${usuario.correo} · Mi usuario`}
          onClick={() => abrir("mi-usuario")}
        >
          {usuario.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={usuario.avatar}
              alt=""
              width={20}
              height={20}
              referrerPolicy="no-referrer"
              className={styles.avatar}
            />
          ) : null}
          <span className={styles.nombre}>{usuario.nombre}</span>
        </button>
        <a href="/ayuda" target="_blank" rel="noopener" className={styles.manual} title="Manual del propietario">
          Manual
        </a>
        <form action={cerrarSesion}>
          <button type="submit" className={styles.apagar}>
            Salir
          </button>
        </form>
      </div>
    </header>
  );
}
