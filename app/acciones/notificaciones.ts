"use server";

import { armarBandeja, BANDEJA_VACIA, type BandejaNotificaciones, type Notificacion } from "@/lib/notificaciones";
import { obtenerSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

/**
 * Bandeja de la campanita: todas las tareas pendientes + las últimas 30
 * notificaciones (30 días). La consulta el escritorio cada ~30 s. Sin la
 * migración 0014 devuelve una bandeja vacía.
 */
export async function leerNotificaciones(): Promise<BandejaNotificaciones> {
  const sesion = await obtenerSesion();
  if (!sesion?.empresa) return BANDEJA_VACIA;
  const supabase = await createClient();
  const desde = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const campos = "id, tipo, titulo, cuerpo, enlace, es_tarea, pendiente, leida, creado_en, resuelta_en, resuelta_por";
  const [pendientes, recientes] = await Promise.all([
    supabase.from("v_notificaciones").select(campos).eq("id_empresa", sesion.empresa.id).eq("pendiente", true)
      .order("creado_en", { ascending: false }).limit(100),
    supabase.from("v_notificaciones").select(campos).eq("id_empresa", sesion.empresa.id).gte("creado_en", desde)
      .order("creado_en", { ascending: false }).limit(30),
  ]);
  if (pendientes.error || recientes.error) return BANDEJA_VACIA;

  const vistos = new Set<string>();
  const items: Notificacion[] = [];
  for (const f of [...(pendientes.data ?? []), ...(recientes.data ?? [])] as Record<string, unknown>[]) {
    const id = String(f.id);
    if (vistos.has(id)) continue;
    vistos.add(id);
    items.push({
      id,
      tipo: String(f.tipo),
      titulo: String(f.titulo),
      cuerpo: (f.cuerpo as string | null) ?? null,
      enlace: (f.enlace ?? {}) as Notificacion["enlace"],
      esTarea: Boolean(f.es_tarea),
      pendiente: Boolean(f.pendiente),
      leida: Boolean(f.leida),
      creadoEn: String(f.creado_en),
      resueltaEn: (f.resuelta_en as string | null) ?? null,
      resueltaPor: (f.resuelta_por as string | null) ?? null,
    });
  }
  items.sort((a, b) => Number(b.pendiente) - Number(a.pendiente) || b.creadoEn.localeCompare(a.creadoEn));
  return armarBandeja(items);
}

/** Marca como leídas (todas si no se pasan ids). */
export async function marcarNotificacionesLeidas(ids?: string[]): Promise<void> {
  const sesion = await obtenerSesion();
  if (!sesion?.empresa) return;
  const supabase = await createClient();
  const validos = ids?.filter((i) => /^[0-9a-f-]{36}$/.test(i)).slice(0, 200);
  await supabase.rpc("marcar_notificaciones_leidas", { p_empresa: sesion.empresa.id, p_ids: validos ?? null });
}
