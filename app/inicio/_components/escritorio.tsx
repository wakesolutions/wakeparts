"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import { AmbienteEmpresa } from "@/components/identidad/ambiente-empresa";
import { IdentidadProvider } from "@/components/identidad/contexto";
import { AvisosRecien } from "@/components/notificaciones/campana";
import { NotificacionesProvider } from "@/components/notificaciones/contexto";
import { CapaVentanas } from "@/components/ventanas/ventana";
import { VentanasProvider } from "@/components/ventanas/contexto";
import { IDENTIDAD_VACIA } from "@/lib/identidad";
import { aplicarPaleta, paletaActual } from "@/lib/paletas-cliente";
import type { Sesion } from "@/lib/sesion";
import { BarraMenu } from "./barra-menu";
import { Dock } from "./dock";
import { MODULOS } from "./modulos";
import { RecorridoProvider } from "./recorrido/recorrido";
import { SesionProvider } from "./sesion-contexto";

/** Shell del escritorio: barra de menú, fondo (y color) de la empresa, ventanas y dock. */
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
      <IdentidadProvider key={sesion.empresa?.id} inicial={sesion.empresa?.identidad ?? IDENTIDAD_VACIA}>
        <VentanasProvider modulos={modulos}>
          <NotificacionesProvider>
            <RecorridoProvider pendiente={recorrido}>
              <div className="wp-carbono flex min-h-dvh flex-col">
                <AmbienteEmpresa />
                <BarraMenu />
                {children}
                <CapaVentanas />
                <Dock />
                <AvisosRecien />
              </div>
            </RecorridoProvider>
          </NotificacionesProvider>
        </VentanasProvider>
      </IdentidadProvider>
    </SesionProvider>
  );
}
