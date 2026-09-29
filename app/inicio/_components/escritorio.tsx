"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import { CapaVentanas } from "@/components/ventanas/ventana";
import { VentanasProvider } from "@/components/ventanas/contexto";
import { aplicarPaleta, paletaActual } from "@/lib/paletas-cliente";
import type { Sesion } from "@/lib/sesion";
import { BarraMenu } from "./barra-menu";
import { Dock } from "./dock";
import { MODULOS } from "./modulos";
import { RecorridoProvider } from "./recorrido/recorrido";
import { SesionProvider } from "./sesion-contexto";

/** Shell del escritorio: barra de menú, fondo, ventanas y dock. */
export function Escritorio({
  sesion,
  recorrido = null,
  children,
}: {
  sesion: Sesion;
  /** ¿Mostrar el recorrido guiado? null = decide este navegador (sin la migración 0008 o en el sandbox). */
  recorrido?: boolean | null;
  children: ReactNode;
}) {
  // La paleta de la empresa manda sobre la cookie.
  useEffect(() => {
    if (sesion.empresa && paletaActual() !== sesion.empresa.paleta) aplicarPaleta(sesion.empresa.paleta);
  }, [sesion.empresa]);

  const modulos = useMemo(() => MODULOS.filter((m) => !m.visible || m.visible(sesion)), [sesion]);

  return (
    <SesionProvider value={sesion}>
      <VentanasProvider modulos={modulos}>
        <RecorridoProvider pendiente={recorrido}>
          <div className="wp-carbono flex min-h-dvh flex-col">
            <BarraMenu />
            {children}
            <CapaVentanas />
            <Dock />
          </div>
        </RecorridoProvider>
      </VentanasProvider>
    </SesionProvider>
  );
}
