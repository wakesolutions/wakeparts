"use client";

import type { ReactNode } from "react";
import { Escritorio } from "@/app/inicio/_components/escritorio";
import { ApisProvider } from "@/components/datos/apis";
import type { Sesion } from "@/lib/sesion";
import { APIS_DEMO } from "../datos-demo";

/** Escritorio del sandbox con datos de demostración en memoria. */
export function EscritorioDemo({ sesion, children }: { sesion: Sesion; children: ReactNode }) {
  return (
    <ApisProvider valor={APIS_DEMO}>
      <Escritorio sesion={sesion}>{children}</Escritorio>
    </ApisProvider>
  );
}
