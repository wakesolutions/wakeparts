"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  apiCompatibilidad,
  catalogoVehiculos,
  type ApiCatalogoVehiculos,
  type ApiCompatibilidad,
} from "@/components/compatibilidad/api";
import { apiImagenes, type ApiImagenes } from "@/components/imagenes/api";
import { apiVentas, type ApiVentas } from "@/components/ventas/api";

/**
 * Acceso a datos de los módulos interactivos (mostrador, fotos, compatibilidad).
 * Por defecto son Server Actions; el sandbox de desarrollo inyecta datos de
 * demostración con <ApisProvider valor={…}> para revisar la UI sin sesión.
 */
export type Apis = {
  compatibilidad: ApiCompatibilidad;
  vehiculos: ApiCatalogoVehiculos;
  imagenes: ApiImagenes;
  ventas: ApiVentas;
};

const REALES: Apis = {
  compatibilidad: apiCompatibilidad,
  vehiculos: catalogoVehiculos,
  imagenes: apiImagenes,
  ventas: apiVentas,
};

const Ctx = createContext<Partial<Apis>>({});

export function ApisProvider({ valor, children }: { valor: Partial<Apis>; children: ReactNode }) {
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useApi<K extends keyof Apis>(clave: K): Apis[K] {
  return useContext(Ctx)[clave] ?? REALES[clave];
}
