"use client";

import { useIdentidad } from "./contexto";

/** Logo de la empresa activa (si tiene). Se actualiza en vivo al cambiarlo en Taller. */
export function LogoEmpresa({ className }: { className?: string }) {
  const { identidad } = useIdentidad();
  if (!identidad.logo) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={identidad.logo} alt="" className={className} />;
}
