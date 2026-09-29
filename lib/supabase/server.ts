import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { contextoDe } from "@/lib/registro";

/** Solo ASCII imprimible: los headers HTTP no admiten otra cosa con seguridad. */
const ascii = (v: string | null | undefined) => (v ?? "").replace(/·/g, "/").replace(/[^\x20-\x7E]/g, "").slice(0, 500);

/**
 * Cliente de Supabase para Server Components, Server Actions y Route Handlers.
 * Crear uno nuevo por request: nunca compartirlo entre requests.
 * Envía la IP y el dispositivo del usuario (x-cliente-*) para que la auditoría
 * de la base (`registrar_cambio`, 0011) sepa desde dónde se hizo cada cambio.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const h = await headers();
  const cliente = contextoDe(h);
  let ruta = "";
  try {
    ruta = cliente.referente ? new URL(cliente.referente).pathname : "";
  } catch {
    // referente inválido
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      global: {
        headers: {
          "x-cliente-ip": ascii(cliente.ip),
          "x-cliente-dispositivo": ascii(cliente.dispositivo),
          "x-cliente-agente": ascii(cliente.agente),
          "x-cliente-ruta": ascii(ruta),
          "x-cliente-entorno": ascii(process.env.VERCEL_ENV ?? process.env.NODE_ENV),
        },
      },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Llamado desde un Server Component: no puede escribir cookies.
            // El proxy se encarga de refrescar la sesión.
          }
        },
      },
    },
  );
}
