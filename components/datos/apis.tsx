"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  apiCompatibilidad,
  catalogoVehiculos,
  type ApiCatalogoVehiculos,
  type ApiCompatibilidad,
} from "@/components/compatibilidad/api";
import { apiImagenes, type ApiImagenes } from "@/components/imagenes/api";
import { apiInventario, type ApiInventario } from "@/components/inventario/api";
import { apiReportes, type ApiReportes } from "@/components/reportes/api";
import { apiVentas, type ApiVentas } from "@/components/ventas/api";

/**
 * Acceso a datos de los módulos interactivos (mostrador, fotos, compatibilidad,
 * entradas e importación, reportes).
 * Por defecto son Server Actions; el sandbox de desarrollo inyecta datos de
 * demostración con <ApisProvider valor={…}> para revisar la UI sin sesión.
 */
export type Apis = {
  compatibilidad: ApiCompatibilidad;
  vehiculos: ApiCatalogoVehiculos;
  imagenes: ApiImagenes;
  ventas: ApiVentas;
  inventario: ApiInventario;
  reportes: ApiReportes;
};

const REALES: Apis = {
  compatibilidad: apiCompatibilidad,
  vehiculos: catalogoVehiculos,
  imagenes: apiImagenes,
  ventas: apiVentas,
  inventario: apiInventario,
  reportes: apiReportes,
};

const Ctx = createContext<Partial<Apis>>({});

export function ApisProvider({ valor, children }: { valor: Partial<Apis>; children: ReactNode }) {
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useApi<K extends keyof Apis>(clave: K): Apis[K] {
  return useContext(Ctx)[clave] ?? REALES[clave];
}
