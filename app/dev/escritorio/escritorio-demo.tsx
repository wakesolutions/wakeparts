"use client";

import type { ReactNode } from "react";
import { Escritorio } from "@/app/inicio/_components/escritorio";
import { ApisProvider } from "@/components/datos/apis";
import ui from "@/components/ui/controles.module.css";
import { avisarCambioNotificaciones } from "@/lib/ir-a";
import type { Sesion } from "@/lib/sesion";
import { APIS_DEMO, simularPedidoWeb } from "@/components/demo/datos-demo";

/** Escritorio del sandbox con datos de demostración en memoria. */
export function EscritorioDemo({ sesion, children }: { sesion: Sesion; children: ReactNode }) {
  return (
    <ApisProvider valor={APIS_DEMO}>
      <Escritorio sesion={sesion}>
        {children}
        <div className="fixed bottom-28 left-4 z-10">
          <button
            type="button"
            className={ui.boton}
            onClick={() => {
              simularPedidoWeb();
              avisarCambioNotificaciones();
            }}
          >
            Simular pedido web
          </button>
        </div>
      </Escritorio>
    </ApisProvider>
  );
}
