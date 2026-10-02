"use client";

import { CajaActual } from "@/components/caja/caja-actual";
import { Turnos } from "@/components/caja/turnos";
import { useSesion } from "../sesion-contexto";
import { ModuloTablas } from "./tablas";

/** Caja: el turno de tu punto de emisión (abrir, movimientos, arqueo y cierre) y el historial de turnos. */
export function ModuloCaja() {
  const { rol } = useSesion();
  const administra = rol === "dueno" || rol === "admin";
  return (
    <ModuloTablas
      id="caja"
      inicial="caja-actual"
      secciones={[
        {
          titulo: "Caja",
          items: [
            {
              id: "caja-actual",
              titulo: "Mi caja",
              descripcion: "El turno de tu caja: lo que se cobró, el efectivo que debería haber y el cierre con arqueo.",
              contenido: () => <CajaActual administra={administra} />,
            },
            {
              recurso: "cajas_turnos",
              descripcion: "Todos los turnos de todas las cajas. Abrí uno para ver e imprimir su corte.",
              contenido: () => <Turnos />,
            },
          ],
        },
      ]}
    />
  );
}
