import "server-only";
import { NextResponse } from "next/server";
import { mismoSecreto } from "@/lib/suscripcion-servidor";

/**
 * Candado de los endpoints /api/cron/* (cron-job.org). Header obligatorio:
 * `Authorization: Bearer <CRON_SECRET>`. Devuelve la respuesta de rechazo, o
 * null si la llamada está autorizada.
 */
export function rechazoCron(request: Request): NextResponse | null {
  const esperado = process.env.CRON_SECRET?.trim();
  if (!esperado) return NextResponse.json({ error: "Falta CRON_SECRET en el servidor." }, { status: 503 });
  const recibido = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!mismoSecreto(recibido, esperado)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  return null;
}
