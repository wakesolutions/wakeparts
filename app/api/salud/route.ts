import { NextResponse } from "next/server";

/**
 * Chequeo de salud para el monitor de disponibilidad (UptimeRobot, cron-job.org…).
 * Público y sin datos: responde 200 si el sitio y la base contestan, 503 si la
 * base no. Lee una fila del catálogo público (lo que ya ve cualquier visitante).
 */

export const dynamic = "force-dynamic";

export async function GET() {
  const inicio = Date.now();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const llave = process.env.SUPABASE_PUBLISHABLE_KEY;
  let base = false;
  if (url && llave) {
    try {
      const r = await fetch(`${url}/rest/v1/marcas?select=id&limit=1`, {
        headers: { apikey: llave },
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      base = r.ok;
    } catch {
      base = false;
    }
  }
  return NextResponse.json(
    { ok: base, base: base ? "ok" : "sin respuesta", ms: Date.now() - inicio },
    { status: base ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
