import { NextResponse } from "next/server";
import { rechazoCron } from "@/lib/cron";
import { registrar } from "@/lib/registro";
import { clienteServicio } from "@/lib/suscripcion-servidor";

/**
 * Limpieza diaria (cron-job.org, una vez al día; correrlo más seguido no hace
 * daño). Header obligatorio: `Authorization: Bearer <CRON_SECRET>`.
 *
 * Cumple los plazos que promete /privacidad:
 * - `limpiar_registros()` (0011): visitas de más de 180 días y el resto
 *   (sesiones, errores, cambios) de más de 730.
 * - `limpiar_notificaciones()` (0014): leídas o resueltas de más de 90 días.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function manejar(request: Request) {
  const rechazo = rechazoCron(request);
  if (rechazo) return rechazo;

  const db = clienteServicio();
  const [registros, notificaciones] = await Promise.all([
    db.rpc("limpiar_registros"),
    db.rpc("limpiar_notificaciones"),
  ]);
  const error = registros.error ?? notificaciones.error;
  if (error) {
    await registrar({ tipo: "error", evento: "limpieza.cron_error", mensaje: `${error.code ?? "?"} ${error.message}`.slice(0, 300) });
    return NextResponse.json({ error: "Error en la limpieza." }, { status: 500 });
  }

  const resumen = { registros: Number(registros.data ?? 0), notificaciones: Number(notificaciones.data ?? 0) };
  await registrar({ tipo: "accion", evento: "limpieza.cron", mensaje: "Limpieza de registros y notificaciones", datos: resumen });
  return NextResponse.json({ ok: true, borrados: resumen });
}

export const GET = manejar;
export const POST = manejar;
