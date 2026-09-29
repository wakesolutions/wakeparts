"use client";

import Link from "next/link";
import { useEffect } from "react";
import ui from "@/components/ui/controles.module.css";
import { reportarError } from "@/lib/registro-cliente";

/** Pantalla de «algo falló» (app/error.tsx y app/global-error.tsx). Reporta el error al registro. */
export function PantallaError({
  error,
  reintentar,
  origen,
}: {
  error: Error & { digest?: string };
  reintentar: () => void;
  origen: string;
}) {
  useEffect(() => {
    reportarError(error, { origen });
  }, [error, origen]);

  return (
    <main className="wp-cabina grid min-h-dvh place-items-center px-4 py-16">
      <div className="grid max-w-[46ch] justify-items-start gap-5">
        <p className="font-mono text-[0.7rem] tracking-[0.3em] text-wp-accent uppercase">Testigo encendido</p>
        <h1 className="wp-grabado text-5xl leading-[0.9] font-extrabold uppercase sm:text-6xl">
          Algo falló<span className="text-wp-accent">.</span>
        </h1>
        <p className="text-lg leading-relaxed text-wp-ink-2 text-pretty">
          Ya quedó registrado para que lo revisemos. Intentá de nuevo; si sigue pasando, avisanos con el código de abajo.
        </p>
        {error.digest && (
          <p className="font-mono text-xs text-wp-ink-3">
            Código: <span className="text-wp-ink">{error.digest}</span>
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <button type="button" className={`${ui.boton} ${ui.primario}`} onClick={() => reintentar()}>
            Intentar de nuevo
          </button>
          <Link href="/" className={`${ui.boton} ${ui.fantasma}`}>
            Ir al inicio
          </Link>
        </div>
      </div>
    </main>
  );
}
