"use client";

import { Mostrador } from "@/components/ventas/mostrador";
import { puede } from "@/lib/permisos";
import { useSesion } from "../sesion-contexto";

/** Cotizar y facturar: el mostrador. Costo y margen según el permiso del rol (0023). */
export function ModuloCotizar() {
  const sesion = useSesion();
  return <Mostrador veMargen={puede(sesion, "ver_margen")} />;
}
