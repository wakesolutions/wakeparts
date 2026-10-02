"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import ui from "@/components/ui/controles.module.css";
import { IconoImprimir } from "@/components/ui/iconos";
import type { Papel } from "@/lib/identidad";

/**
 * Barra superior (no se imprime) + diálogo de impresión al abrir con ?imprimir.
 * Con `papel`, un selector Carta | Ticket cambia el formato sin salir de la página.
 */
export function BarraImpresion({ titulo, papel }: { titulo: string; papel?: Papel }) {
  const router = useRouter();
  useEffect(() => {
    document.title = `${titulo} · Wake Parts`;
    if (new URLSearchParams(location.search).has("imprimir")) setTimeout(() => window.print(), 300);
  }, [titulo]);

  function cambiar(nuevo: Papel) {
    const params = new URLSearchParams(location.search);
    params.set("papel", nuevo);
    params.delete("imprimir");
    router.replace(`${location.pathname}?${params.toString()}`);
  }

  return (
    <div className="mx-auto mb-5 flex max-w-[820px] flex-wrap items-center justify-between gap-3 print:hidden">
      <p className="font-mono text-[0.66rem] tracking-[0.2em] text-wp-ink-3 uppercase">{titulo}</p>
      <div className="flex flex-wrap items-center gap-2">
        {papel && (
          <div role="radiogroup" aria-label="Papel" className="flex gap-0.5 rounded-lg bg-wp-bg p-0.5">
            {(["carta", "ticket"] as const).map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={papel === p}
                className={`${ui.boton} ${papel === p ? "" : ui.fantasma}`}
                onClick={() => papel !== p && cambiar(p)}
              >
                {p === "carta" ? "Carta" : "Ticket"}
              </button>
            ))}
          </div>
        )}
        <button type="button" className={`${ui.boton} ${ui.primario}`} onClick={() => window.print()}>
          <IconoImprimir tamano={14} /> Imprimir
        </button>
      </div>
    </div>
  );
}
