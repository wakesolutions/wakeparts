"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Escritorio } from "@/app/inicio/_components/escritorio";
import { ApisProvider, type Apis } from "@/components/datos/apis";
import { APIS_DEMO } from "@/components/demo/datos-demo";
import { SESION_DEMO_PUBLICA } from "@/components/demo/sesion-demo";
import { CONTACTO } from "@/lib/sitio";
import styles from "./demo.module.css";

const EVENTO_VENTA = "wp:demo:venta";

/** La demo con un aviso extra: cuando emiten su primera cotización o factura. */
function apisDeLaDemo(): Partial<Apis> {
  const ventas = APIS_DEMO.ventas!;
  return {
    ...APIS_DEMO,
    ventas: {
      ...ventas,
      emitir: async (...args: Parameters<typeof ventas.emitir>) => {
        const r = await ventas.emitir(...args);
        if (r.ok) window.dispatchEvent(new CustomEvent(EVENTO_VENTA, { detail: args[1] }));
        return r;
      },
    },
  };
}

export function DemoPublica({ saludo }: { saludo: string }) {
  const apis = useMemo(() => apisDeLaDemo(), []);
  return (
    <ApisProvider valor={apis}>
      <Escritorio sesion={SESION_DEMO_PUBLICA} recorrido={null}>
        <main className="flex flex-1 items-center px-4 pb-48 sm:px-10 lg:px-20">
          <div>
            <p
              className="wp-entra font-mono text-[0.7rem] tracking-[0.3em] text-wp-accent uppercase"
              style={{ animationDelay: "150ms" }}
            >
              {saludo} · Yonker Demo
            </p>
            <h1
              className="wp-grabado mt-3 text-[clamp(3.5rem,10vw,9rem)] leading-[0.85] font-extrabold tracking-[-0.03em] uppercase"
              style={{ fontVariationSettings: '"wdth" 62' }}
            >
              <span className="wp-linea">
                <span style={{ animationDelay: "250ms" }}>Ana</span>
              </span>
            </h1>
            <p
              className="wp-entra mt-6 max-w-[44ch] text-base leading-relaxed text-wp-ink-2 sm:text-lg"
              style={{ animationDelay: "450ms" }}
            >
              Este es el tablero de un yonker de ejemplo. Abrí <strong className="text-wp-ink">Cotizar y facturar</strong>{" "}
              en el dock, elegí un vehículo y armá una venta: en un minuto ves cómo trabajarías todos los días.
            </p>
          </div>
        </main>
        <FranjaDemo />
        <Invitacion />
      </Escritorio>
    </ApisProvider>
  );
}

/** Siempre a la vista: qué es esto y cómo seguir. Honesto: «nada se guarda». */
function FranjaDemo() {
  return (
    <aside className={styles.franja} aria-label="Estás en la demo">
      <p className={styles.franjaTexto}>
        <strong>Estás en la demo</strong>
        Datos de ejemplo: probá todo, nada se guarda.
      </p>
      <div className={styles.acciones}>
        <Link href="/#encender" className={styles.primario}>
          Usar con mi taller
        </Link>
        <a href={CONTACTO.whatsappUrl} target="_blank" rel="noopener noreferrer" className={styles.secundario}>
          WhatsApp
        </a>
      </div>
    </aside>
  );
}

/** Una sola vez, después de su primera venta en la demo: el momento en que más ganas dan. */
function Invitacion() {
  const [tipo, setTipo] = useState<string | null>(null);
  const [vista, setVista] = useState(false);

  useEffect(() => {
    const alVender = (e: Event) => {
      if (vista) return;
      const t = (e as CustomEvent<string>).detail;
      // Que primero vean el sello «Facturado» del mostrador.
      setTimeout(() => {
        setTipo(t);
        setVista(true);
      }, 2200);
    };
    window.addEventListener(EVENTO_VENTA, alVender);
    return () => window.removeEventListener(EVENTO_VENTA, alVender);
  }, [vista]);

  if (!tipo) return null;
  return (
    <aside className={styles.invitacion} role="dialog" aria-label="Seguir con mi taller">
      <p className={styles.sobre}>{tipo === "factura" ? "Primera factura" : "Primera cotización"}</p>
      <p className={styles.titulo}>Así de rápido, todos los días</p>
      <p className={styles.texto}>
        Con tus productos y tu CAI es igual. Entrá con tu cuenta y en un par de minutos tenés tu taller listo, o escribinos y
        te lo dejamos configurado.
      </p>
      <div className={styles.acciones}>
        <Link href="/#encender" className={styles.primario}>
          Crear mi taller
        </Link>
        <a href={CONTACTO.whatsappUrl} target="_blank" rel="noopener noreferrer" className={styles.secundario}>
          Que me ayuden por WhatsApp
        </a>
      </div>
      <button type="button" className={styles.cerrar} onClick={() => setTipo(null)}>
        Seguir probando
      </button>
    </aside>
  );
}
