"use client";

import { Mostrador } from "@/components/ventas/mostrador";
import { useSesion } from "../sesion-contexto";

/** Cotizar y facturar: el mostrador. */
export function ModuloCotizar() {
  const { rol } = useSesion();
  return <Mostrador veMargen={rol === "dueno" || rol === "admin"} />;
}
