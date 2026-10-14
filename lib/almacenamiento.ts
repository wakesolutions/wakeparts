import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * ¿Cabe el archivo en el almacenamiento del plan? (0024). Devuelve el mensaje
 * para el usuario o null si cabe. Sin la migración, deja pasar. La política de
 * Storage es el segundo candado.
 */
export async function verificarAlmacenamiento(
  supabase: Awaited<ReturnType<typeof createClient>>,
  idEmpresa: string,
  bytes: number,
): Promise<string | null> {
  const { error } = await supabase.rpc("verificar_almacenamiento", { p_empresa: idEmpresa, p_bytes: Math.ceil(bytes) });
  if (!error || error.code === "PGRST202" || error.code === "42883") return null;
  if (error.code === "P0001") return error.message;
  console.error("[verificarAlmacenamiento]", error.code);
  return null;
}
