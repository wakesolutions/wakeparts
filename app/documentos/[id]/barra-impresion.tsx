"use client";

import { useEffect } from "react";
import ui from "@/components/ui/controles.module.css";
import { IconoImprimir } from "@/components/ui/iconos";

/** Barra superior (no se imprime) + diálogo de impresión al abrir con ?imprimir. */
export function BarraImpresion({ titulo }: { titulo: string }) {
  useEffect(() => {
    document.title = `${titulo} · Wake Parts`;
    if (new URLSearchParams(location.search).has("imprimir")) setTimeout(() => window.print(), 300);
  }, [titulo]);

  return (
    <div className="mx-auto mb-5 flex max-w-[820px] items-center justify-between gap-3 print:hidden">
      <p className="font-mono text-[0.66rem] tracking-[0.2em] text-wp-ink-3 uppercase">{titulo}</p>
      <button type="button" className={`${ui.boton} ${ui.primario}`} onClick={() => window.print()}>
        <IconoImprimir tamano={14} /> Imprimir
      </button>
    </div>
  );
}
