"use client";

import { createContext, useContext } from "react";
import type { Escritura } from "@/lib/recursos/tipos";
import type { Sesion } from "@/lib/sesion";

const Ctx = createContext<Sesion | null>(null);

export const SesionProvider = Ctx.Provider;

export function useSesion() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useSesion debe usarse dentro del escritorio");
  return s;
}

/** ¿El usuario puede escribir en un recurso con esta política? (La autoridad es RLS.) */
export function puedeEscribir(sesion: Sesion, escritura: Escritura) {
  if (escritura === "admin_plataforma") return sesion.usuario.esAdminPlataforma;
  if (escritura === "empresa") return sesion.rol === "dueno" || sesion.rol === "admin";
  if (escritura === "miembros") return sesion.rol !== null;
  return false;
}
