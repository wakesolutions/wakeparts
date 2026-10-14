import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { VERSION_LEGAL, type ContextoAceptacion } from "@/lib/legal";

/**
 * Guarda la constancia de que el usuario de la sesión aceptó los términos y la
 * privacidad vigentes (`registrar_aceptacion_legal`, 0026). La IP y el
 * dispositivo los toma la base de los headers x-cliente-* (lib/supabase/server.ts).
 * Usa el cliente con la sesión del usuario: nunca la llave secreta.
 */
export async function guardarAceptacionLegal(
  supabase: SupabaseClient,
  contexto: ContextoAceptacion,
  empresa: string | null,
  detalle: Record<string, unknown> = {},
): Promise<{ ok: true; id: number } | { ok: false; codigo: string | null; mensaje: string }> {
  const { data, error } = await supabase.rpc("registrar_aceptacion_legal", {
    p_contexto: contexto,
    p_version: VERSION_LEGAL,
    p_empresa: empresa,
    p_detalle: detalle,
  });
  if (error || data == null) return { ok: false, codigo: error?.code ?? null, mensaje: error?.message ?? "sin respuesta" };
  return { ok: true, id: Number(data) };
}
