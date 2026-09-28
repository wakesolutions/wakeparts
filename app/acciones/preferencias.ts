"use server";

import { createClient } from "@/lib/supabase/server";
import type { PreferenciasTabla } from "@/lib/recursos/tipos";

const CLAVE_VALIDA = /^[a-z0-9_:.-]{1,80}$/;

export async function leerPreferenciasTabla(clave: string): Promise<PreferenciasTabla | null> {
  if (!CLAVE_VALIDA.test(clave)) return null;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data } = await supabase
    .from("preferencias_tablas")
    .select("config")
    .eq("id_usuario", auth.user.id)
    .eq("clave", clave)
    .maybeSingle();
  return (data?.config as PreferenciasTabla | undefined) ?? null;
}

export async function guardarPreferenciasTabla(clave: string, config: PreferenciasTabla) {
  if (!CLAVE_VALIDA.test(clave)) return;
  // Solo se guardan las formas conocidas; nada de payloads arbitrarios.
  const limpia: PreferenciasTabla = {
    columnas: config.columnas?.slice(0, 60).map((c) => ({
      clave: String(c.clave).slice(0, 60),
      visible: Boolean(c.visible),
      ancho: typeof c.ancho === "number" ? Math.round(Math.min(Math.max(c.ancho, 48), 900)) : undefined,
    })),
    orden: config.orden?.slice(0, 5).map((o) => ({
      columna: String(o.columna).slice(0, 60),
      dir: o.dir === "desc" ? "desc" : "asc",
    })),
    tamano: [25, 50, 100, 200].includes(Number(config.tamano)) ? Number(config.tamano) : undefined,
    densidad: config.densidad === "compacta" ? "compacta" : "normal",
  };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;

  await supabase.from("preferencias_tablas").upsert(
    { id_usuario: auth.user.id, clave, config: limpia, actualizado_en: new Date().toISOString() },
    { onConflict: "id_usuario,clave" },
  );
}
