"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  apiCompatibilidad,
  catalogoVehiculos,
  type ApiCatalogoVehiculos,
  type ApiCompatibilidad,
} from "@/components/compatibilidad/api";
import { apiIdentidad, type ApiIdentidad } from "@/components/identidad/api";
import { apiImagenes, type ApiImagenes } from "@/components/imagenes/api";
import {
  apiEmpresa,
  apiPerfil,
  apiRecursos,
  type ApiEmpresa,
  type ApiPerfil,
  type ApiRecursos,
} from "./api-recursos";
import { apiNotificaciones, type ApiNotificaciones } from "@/components/notificaciones/api";
import { apiInventario, type ApiInventario } from "@/components/inventario/api";
import { apiReportes, type ApiReportes } from "@/components/reportes/api";
import { apiSitioWeb, type ApiSitioWeb } from "@/components/sitio-web/api";
import { apiVentas, type ApiVentas } from "@/components/ventas/api";

/**
 * Acceso a datos de los módulos interactivos (mostrador, fotos, compatibilidad,
 * entradas e importación, reportes, apariencia de la empresa, sitio web).
 * Por defecto son Server Actions; el sandbox (/dev) y la demo pública (/demo)
 * inyectan datos en memoria con <ApisProvider valor={…}>: sin sesión ni base.
 * Las tablas y formularios genéricos, la empresa y el perfil también pasan por aquí.
 */
export type Apis = {
  compatibilidad: ApiCompatibilidad;
  vehiculos: ApiCatalogoVehiculos;
  imagenes: ApiImagenes;
  ventas: ApiVentas;
  inventario: ApiInventario;
  reportes: ApiReportes;
  identidad: ApiIdentidad;
  sitioWeb: ApiSitioWeb;
  notificaciones: ApiNotificaciones;
  recursos: ApiRecursos;
  empresa: ApiEmpresa;
  perfil: ApiPerfil;
};

const REALES: Apis = {
  compatibilidad: apiCompatibilidad,
  vehiculos: catalogoVehiculos,
  imagenes: apiImagenes,
  ventas: apiVentas,
  inventario: apiInventario,
  reportes: apiReportes,
  identidad: apiIdentidad,
  sitioWeb: apiSitioWeb,
  notificaciones: apiNotificaciones,
  recursos: apiRecursos,
  empresa: apiEmpresa,
  perfil: apiPerfil,
};

const Ctx = createContext<Partial<Apis>>({});

export function ApisProvider({ valor, children }: { valor: Partial<Apis>; children: ReactNode }) {
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useApi<K extends keyof Apis>(clave: K): Apis[K] {
  return useContext(Ctx)[clave] ?? REALES[clave];
}
