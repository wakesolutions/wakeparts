"use server";

import { enviarCorreo } from "@/lib/correo";
import { registrar } from "@/lib/registro";
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

/**
 * Envía el mensaje de seguimiento por correo desde ventas@ (SMTP). El
 * destinatario se lee en el servidor (correo del dueño en
 * v_seguimiento_empresas): el navegador solo elige el taller, no la dirección.
 * Si sale bien, el taller queda marcado como contactado hoy.
 */
export async function enviarCorreoSeguimiento(
  idEmpresa: string,
  correo: { asunto: string; texto: string },
): Promise<{ ok: true; para: string; contactadoEn: string } | { ok: false; error: string }> {
  const sesion = await obtenerSesion();
  if (!sesion?.usuario.esAdminPlataforma) return { ok: false, error: "Solo el administrador de Wake Parts." };
  if (!/^[0-9a-f-]{36}$/.test(idEmpresa)) return { ok: false, error: "Taller no válido." };
  const asunto = correo.asunto.trim().slice(0, 200);
  const texto = correo.texto.trim().slice(0, 5000);
  if (!asunto || !texto) return { ok: false, error: "Escribí el asunto y el mensaje." };

  const supabase = await createClient();
  const { data: taller } = await supabase
    .from("v_seguimiento_empresas")
    .select("empresa, correo")
    .eq("id_empresa", idEmpresa)
    .maybeSingle();
  if (!taller) return { ok: false, error: "No se encontró el taller." };
  const para = String(taller.correo ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(para)) return { ok: false, error: "El taller no tiene un correo válido." };

  const r = await enviarCorreo({ para, asunto, texto });
  await registrar({
    tipo: r.ok ? "accion" : "error",
    nivel: r.ok ? "info" : "error",
    evento: r.ok ? "seguimiento.correo" : "seguimiento.correo_error",
    mensaje: r.ok ? `Correo de seguimiento a ${taller.empresa}` : r.error,
    id_usuario: sesion.usuario.id,
    correo: sesion.usuario.correo,
    id_empresa: idEmpresa,
    datos: { para, asunto },
  });
  if (!r.ok) return r;

  const contactadoEn = new Date().toISOString();
  const { error } = await supabase
    .from("seguimiento_contactos")
    .upsert({ id_empresa: idEmpresa, contactado_en: contactadoEn, actualizado_en: contactadoEn }, { onConflict: "id_empresa" });
  if (error) console.error("[enviarCorreoSeguimiento] contacto", error);
  return { ok: true, para, contactadoEn };
}
