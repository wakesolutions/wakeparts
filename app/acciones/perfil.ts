"use server";

import { CAMPOS_PERFIL } from "@/lib/perfil";
import type { ResultadoGuardar, Valores } from "@/lib/recursos/tipos";
import { validarValores } from "@/lib/recursos/validar";
import { obtenerSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

export async function leerPerfil() {
  const sesion = await obtenerSesion();
  if (!sesion) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("usuarios")
    .select("nombre, telefono, id_empresa_activa, creado_en")
    .eq("id", sesion.usuario.id)
    .maybeSingle();
  return data;
}

export async function actualizarPerfil(valores: Valores): Promise<ResultadoGuardar> {
  const sesion = await obtenerSesion();
  if (!sesion) return { ok: false, error: "Tu sesión expiró. Volvé a entrar." };

  const validacion = validarValores(CAMPOS_PERFIL, valores);
  if (!validacion.ok) return { ok: false, error: "Revisá los campos marcados.", errores: validacion.errores };

  const cambios: Valores = { ...validacion.datos };
  const empresa = valores.id_empresa_activa;
  if (empresa !== undefined && empresa !== null && empresa !== "") {
    if (!sesion.empresas.some((e) => e.id === empresa)) {
      return { ok: false, error: "Empresa no válida.", errores: { id_empresa_activa: "Empresa no válida." } };
    }
    cambios.id_empresa_activa = empresa;
  }

  const supabase = await createClient();
  const { error } = await supabase.from("usuarios").update(cambios).eq("id", sesion.usuario.id);
  if (error) {
    console.error("[actualizarPerfil]", error);
    return { ok: false, error: "No se pudo guardar tu perfil." };
  }
  return { ok: true, id: sesion.usuario.id };
}

/**
 * ¿Falta mostrarle el recorrido guiado? null = no se sabe (migración 0008
 * sin aplicar): el cliente decide con su memoria local.
 */
export async function recorridoPendiente(): Promise<boolean | null> {
  const sesion = await obtenerSesion();
  if (!sesion) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("usuarios")
    .select("recorrido_visto_en")
    .eq("id", sesion.usuario.id)
    .maybeSingle();
  if (error || !data) return null;
  return data.recorrido_visto_en === null;
}

/** Marca el recorrido como visto (al terminarlo o saltarlo) o lo deja pendiente para repetirlo. */
export async function marcarRecorrido(visto: boolean) {
  const sesion = await obtenerSesion();
  if (!sesion) return { ok: false as const };
  const supabase = await createClient();
  const { error } = await supabase
    .from("usuarios")
    .update({ recorrido_visto_en: visto ? new Date().toISOString() : null })
    .eq("id", sesion.usuario.id);
  return { ok: !error };
}

/** Borra la configuración guardada de todas las tablas del usuario. */
export async function restablecerTablas() {
  const sesion = await obtenerSesion();
  if (!sesion) return { ok: false as const };
  const supabase = await createClient();
  const { error } = await supabase.from("preferencias_tablas").delete().eq("id_usuario", sesion.usuario.id);
  return { ok: !error };
}
