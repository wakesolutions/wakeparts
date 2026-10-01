"use server";

import { obtenerSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

/**
 * Anota que el admin de plataforma contactó a un taller (0015). La base lo
 * exige con RLS; esto es el segundo candado (correo en ADMINS_PLATAFORMA).
 */
export async function guardarContacto(
  idEmpresa: string,
  cambio: { contactado: boolean; nota: string },
): Promise<{ ok: true; contactadoEn: string | null } | { ok: false; error: string }> {
  const sesion = await obtenerSesion();
  if (!sesion?.usuario.esAdminPlataforma) return { ok: false, error: "Solo el administrador de Wake Parts." };
  if (!/^[0-9a-f-]{36}$/.test(idEmpresa)) return { ok: false, error: "Taller no válido." };

  const contactadoEn = cambio.contactado ? new Date().toISOString() : null;
  const supabase = await createClient();
  const { error } = await supabase.from("seguimiento_contactos").upsert(
    {
      id_empresa: idEmpresa,
      ...(cambio.contactado ? { contactado_en: contactadoEn } : {}),
      nota: cambio.nota.trim().slice(0, 1000) || null,
      actualizado_en: new Date().toISOString(),
    },
    { onConflict: "id_empresa" },
  );
  if (error) {
    console.error("[guardarContacto]", error);
    return { ok: false, error: error.code === "42P01" ? "Falta ejecutar la migración 0015." : "No se pudo guardar." };
  }
  return { ok: true, contactadoEn };
}
