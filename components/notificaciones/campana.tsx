"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { hace, type Notificacion } from "@/lib/notificaciones";
import { useNotificaciones } from "./contexto";
import styles from "./notificaciones.module.css";

function IconoCampana() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="15"
      height="15"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 11.5V7a4 4 0 0 1 8 0v4.5l1 1.2H3z" />
      <path d="M6.6 14a1.5 1.5 0 0 0 2.8 0" />
    </svg>
  );
}

/** Ícono por tipo de notificación (por ahora: pedido web). */
function IconoTipo({ tipo }: { tipo: string }) {
  if (tipo === "pedido_web") {
    return (
      <svg
        viewBox="0 0 16 16"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M1.5 2.5h2l1.6 7.6a1 1 0 0 0 1 .8h5.6a1 1 0 0 0 1-.8l1-4.6H4.2" />
        <circle cx="6.5" cy="13.2" r=".9" />
        <circle cx="11.5" cy="13.2" r=".9" />
      </svg>
    );
  }
  return <IconoCampana />;
}

// Reloj de un minuto para «hace 5 min» (sin renders de más).
function suscribirMinuto(avisar: () => void) {
  const id = setInterval(avisar, 60_000);
  return () => clearInterval(id);
}
const minuto = () => Math.floor(Date.now() / 60_000) * 60_000;

function Fila({ n, ahora, onIr }: { n: Notificacion; ahora: number; onIr: () => void }) {
  return (
    <li>
      <button
        type="button"
        className={styles.fila}
        data-pendiente={n.pendiente || undefined}
        data-leida={n.leida || undefined}
        onClick={onIr}
      >
        <span className={styles.filaIcono}>
          <IconoTipo tipo={n.tipo} />
        </span>
        <span className={styles.filaTexto}>
          <span className={styles.filaTitulo}>{n.titulo}</span>
          {n.cuerpo && <span className={styles.filaCuerpo}>{n.cuerpo}</span>}
          <span className={styles.filaMeta}>
            {hace(n.creadoEn, ahora)}
            {n.resueltaEn && ` · Resuelta${n.resueltaPor ? ` por ${n.resueltaPor}` : ""}`}
          </span>
        </span>
        {!n.leida && <span className={styles.punto} aria-label="Sin leer" />}
      </button>
    </li>
  );
}

/** Campanita de la barra de menú: insignia + panel con «Por atender» y «Recientes». */
export function Campana() {
  const { bandeja, marcarLeidas, irA } = useNotificaciones();
  const [abierta, setAbierta] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const ahora = useSyncExternalStore(suscribirMinuto, minuto, () => 0);

  useEffect(() => {
    if (!abierta) return;
    const fuera = (e: PointerEvent) => !raiz.current?.contains(e.target as Node) && setAbierta(false);
    const escape = (e: KeyboardEvent) => e.key === "Escape" && setAbierta(false);
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", fuera);
      document.removeEventListener("keydown", escape);
    };
  }, [abierta]);

  const pendientes = bandeja.items.filter((n) => n.pendiente);
  const recientes = bandeja.items.filter((n) => !n.pendiente);
  const cuenta = bandeja.pendientes || bandeja.noLeidas;
  const etiqueta =
    bandeja.pendientes > 0
      ? `Notificaciones: ${bandeja.pendientes} por atender`
      : bandeja.noLeidas > 0
        ? `Notificaciones: ${bandeja.noLeidas} sin leer`
        : "Notificaciones";

  return (
    <div className={styles.campana} ref={raiz}>
      <button
        type="button"
        className={styles.boton}
        aria-label={etiqueta}
        title={etiqueta}
        aria-expanded={abierta}
        aria-haspopup="dialog"
        data-hay={cuenta > 0 || undefined}
        onClick={() => setAbierta((a) => !a)}
      >
        <IconoCampana />
        {cuenta > 0 && (
          <span key={cuenta} className={styles.insignia} data-tarea={bandeja.pendientes > 0 || undefined}>
            {cuenta > 99 ? "99+" : cuenta}
          </span>
        )}
      </button>

      {abierta && (
        <div className={styles.panel} role="dialog" aria-label="Notificaciones">
          <div className={styles.cabecera}>
            <p className={styles.titulo}>Notificaciones</p>
            {bandeja.noLeidas > 0 && (
              <button type="button" className={styles.enlace} onClick={() => marcarLeidas()}>
                Marcar todo como leído
              </button>
            )}
          </div>

          {bandeja.items.length === 0 ? (
            <div className={styles.vacio}>
              <span className={styles.vacioIcono}>
                <IconoCampana />
              </span>
              <p>Todo al día.</p>
              <p className={styles.vacioTexto}>Cuando entre un pedido desde tu sitio web, aparece aquí.</p>
            </div>
          ) : (
            <div className={styles.lista}>
              {pendientes.length > 0 && (
                <section aria-label="Por atender">
                  <p className={styles.grupo}>
                    Por atender <span>{pendientes.length}</span>
                  </p>
                  <ul>
                    {pendientes.map((n) => (
                      <Fila
                        key={n.id}
                        n={n}
                        ahora={ahora}
                        onIr={() => {
                          irA(n);
                          setAbierta(false);
                        }}
                      />
                    ))}
                  </ul>
                </section>
              )}
              {recientes.length > 0 && (
                <section aria-label="Recientes">
                  <p className={styles.grupo}>Recientes</p>
                  <ul>
                    {recientes.map((n) => (
                      <Fila
                        key={n.id}
                        n={n}
                        ahora={ahora}
                        onIr={() => {
                          irA(n);
                          setAbierta(false);
                        }}
                      />
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Aviso emergente cuando llega una tarea con el escritorio abierto. */
export function AvisosRecien() {
  const { recien, descartarRecien, irA } = useNotificaciones();

  useEffect(() => {
    if (!recien.length) return;
    const t = setTimeout(() => descartarRecien(recien[recien.length - 1].id), 9000);
    return () => clearTimeout(t);
  }, [recien, descartarRecien]);

  return (
    <div className={styles.avisos} aria-live="polite">
      {recien.map((n) => (
        <div key={n.id} className={styles.aviso} role="status">
          <span className={styles.filaIcono}>
            <IconoTipo tipo={n.tipo} />
          </span>
          <span className={styles.filaTexto}>
            <span className={styles.avisoEtiqueta}>Nuevo</span>
            <span className={styles.filaTitulo}>{n.titulo}</span>
            {n.cuerpo && <span className={styles.filaCuerpo}>{n.cuerpo}</span>}
          </span>
          <span className={styles.avisoAcciones}>
            <button type="button" className={styles.avisoVer} onClick={() => irA(n)}>
              Ver
            </button>
            <button
              type="button"
              className={styles.avisoCerrar}
              aria-label="Cerrar aviso"
              onClick={() => descartarRecien(n.id)}
            >
              ×
            </button>
          </span>
        </div>
      ))}
    </div>
  );
}
