import { NextResponse } from "next/server";
import { enviarCorreo } from "@/lib/correo";
import { estadoDesdeN1co, fechaN1co, n1coConfigurado, obtenerSuscripcionN1co } from "@/lib/n1co";
import { registrar } from "@/lib/registro";
import { URL_SITIO } from "@/lib/sitio";
import {
  activarSuscripcion,
  anotarRecordatorio,
  cambiarEstadoSuscripcion,
  clienteServicio,
  duenoDeEmpresa,
  mismoSecreto,
  planDesdeN1co,
  registrarEventoSuscripcion,
} from "@/lib/suscripcion-servidor";

/**
 * Cron de suscripciones (cron-job.org, una vez al día; correrlo más seguido no
 * repite correos). Header obligatorio: `Authorization: Bearer <CRON_SECRET>`.
 *
 * 1. Prueba: avisos a 3 días, a 1 día y al terminar (pasa a Gratis).
 * 2. Suscripciones con tarjeta cuyo periodo ya terminó: se consulta n1co y se
 *    actualiza (renovada, pago pendiente o cancelada).
 * 3. Canceladas o vencidas sin gracia: pasan a Gratis con un aviso.
 *
 * Cada aviso queda en `empresas_planes.recordatorios` con una clave única:
 * nunca se manda dos veces.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LOTE = 200;
type Fila = {
  id_empresa: string;
  plan: string;
  estado: string;
  plan_prueba: string | null;
  prueba_hasta: string | null;
  periodo_fin: string | null;
  n1co_suscripcion_id: string | null;
  recordatorios: string[];
};

const dia = (iso: string) =>
  new Intl.DateTimeFormat("es-HN", { day: "numeric", month: "long", timeZone: "America/Tegucigalpa" }).format(new Date(iso));

async function avisar(f: Fila, clave: string, asunto: string, cuerpo: (nombre: string, empresa: string) => string) {
  if (f.recordatorios.includes(clave)) return false;
  const dueno = await duenoDeEmpresa(f.id_empresa);
  if (dueno) {
    const r = await enviarCorreo({
      para: dueno.correo,
      asunto: `${asunto} · ${dueno.empresa}`,
      texto: `Hola${dueno.nombre ? ` ${dueno.nombre.split(" ")[0]}` : ""}:\n\n${cuerpo(dueno.nombre, dueno.empresa)}\n\nEntrá a ${URL_SITIO}/inicio?abrir=suscripcion (módulo Suscripción).`,
    });
    if (!r.ok) return false;
  }
  f.recordatorios = [...f.recordatorios, clave];
  await anotarRecordatorio(f.id_empresa, f.recordatorios);
  return true;
}

async function procesar() {
  const db = clienteServicio();
  const ahora = Date.now();
  const resumen = { prueba: 0, sincronizadas: 0, aGratis: 0, correos: 0, errores: 0 };

  // 1. Pruebas que vencen pronto o ya vencieron.
  const { data: pruebas } = await db
    .from("empresas_planes")
    .select("id_empresa, plan, estado, plan_prueba, prueba_hasta, periodo_fin, n1co_suscripcion_id, recordatorios")
    .eq("estado", "prueba")
    .lte("prueba_hasta", new Date(ahora + 3.5 * 86_400_000).toISOString())
    .limit(LOTE);
  for (const f of (pruebas ?? []) as Fila[]) {
    resumen.prueba++;
    const fin = new Date(f.prueba_hasta!).getTime();
    const dias = Math.ceil((fin - ahora) / 86_400_000);
    if (fin <= ahora) {
      if (
        await avisar(f, `prueba-fin:${f.prueba_hasta}`, "Terminó tu prueba de Wake Parts", () =>
          "Terminó tu prueba con todo incluido. Tu taller pasó al plan Gratis: tus datos siguen ahí, pero con los límites del plan. Elegí Arranque, Avance o Pleno para seguir sin límites.",
        )
      )
        resumen.correos++;
      await cambiarEstadoSuscripcion(f.id_empresa, "gratis", { plan: "gratis" });
      await registrarEventoSuscripcion({ idEmpresa: f.id_empresa, origen: "cron", tipo: "prueba_fin", clave: `prueba_fin:${f.id_empresa}:${f.prueba_hasta}` });
      resumen.aGratis++;
    } else if (dias <= 1) {
      if (
        await avisar(f, `prueba-1:${f.prueba_hasta}`, "Mañana termina tu prueba de Wake Parts", () =>
          `Tu prueba termina el ${dia(f.prueba_hasta!)}. Elegí un plan hoy para no perder módulos ni quedar con los límites del plan Gratis.`,
        )
      )
        resumen.correos++;
    } else if (dias <= 3) {
      if (
        await avisar(f, `prueba-3:${f.prueba_hasta}`, "Te quedan 3 días de prueba en Wake Parts", () =>
          `Tu prueba con todo incluido termina el ${dia(f.prueba_hasta!)}. Desde el módulo Suscripción podés elegir Arranque, Avance o Pleno, al mes o al año (dos meses gratis).`,
        )
      )
        resumen.correos++;
    }
  }

  // 2. Con tarjeta y periodo vencido: preguntar a n1co.
  if (n1coConfigurado()) {
    const { data: vencidas } = await db
      .from("empresas_planes")
      .select("id_empresa, plan, estado, plan_prueba, prueba_hasta, periodo_fin, n1co_suscripcion_id, recordatorios")
      .in("estado", ["activa", "vencida"])
      .not("n1co_suscripcion_id", "is", null)
      .lte("periodo_fin", new Date(ahora).toISOString())
      .limit(LOTE);
    for (const f of (vencidas ?? []) as Fila[]) {
      try {
        const sub = await obtenerSuscripcionN1co(f.n1co_suscripcion_id!);
        const estado = estadoDesdeN1co(sub.subscriptionStatus);
        const periodoFin = fechaN1co(sub.currentPeriodEnd);
        const cobrado = await planDesdeN1co(sub.planId);
        if (estado === "activa" && cobrado) {
          await activarSuscripcion({ idEmpresa: f.id_empresa, plan: cobrado.plan.codigo, ciclo: cobrado.ciclo, n1coId: f.n1co_suscripcion_id!, periodoFin });
        } else if (estado === "vencida") {
          await cambiarEstadoSuscripcion(f.id_empresa, "vencida", { periodoFin });
          if (
            await avisar(f, `pago-vencido:${periodoFin ?? f.periodo_fin}`, "No pudimos cobrar tu plan de Wake Parts", () =>
              "El cobro de tu suscripción no pasó. Revisá tu tarjeta en el módulo Suscripción: en 3 días el taller pasa al plan Gratis (sin perder datos).",
            )
          )
            resumen.correos++;
        } else if (estado === "cancelada") {
          await cambiarEstadoSuscripcion(f.id_empresa, "cancelada", { periodoFin });
        }
        // Otro estado (Inicio, Error, desconocido): no se toca; queda en el resumen.
        resumen.sincronizadas++;
      } catch {
        resumen.errores++;
      }
    }
  }

  // 3. Canceladas que ya terminaron y vencidas sin gracia → Gratis.
  const { data: terminadas } = await db
    .from("empresas_planes")
    .select("id_empresa, plan, estado, plan_prueba, prueba_hasta, periodo_fin, n1co_suscripcion_id, recordatorios")
    .in("estado", ["cancelada", "vencida"])
    .lte("periodo_fin", new Date(ahora).toISOString())
    .limit(LOTE);
  for (const f of (terminadas ?? []) as Fila[]) {
    const gracia = f.estado === "vencida" ? 3 * 86_400_000 : 0;
    if (new Date(f.periodo_fin!).getTime() + gracia > ahora) continue;
    if (
      await avisar(f, `a-gratis:${f.periodo_fin}`, "Tu taller pasó al plan Gratis", () =>
        "Terminó el periodo de tu plan. El taller sigue funcionando con el plan Gratis y todos tus datos; cuando quieras, elegí un plan en el módulo Suscripción.",
      )
    )
      resumen.correos++;
    await cambiarEstadoSuscripcion(f.id_empresa, "gratis", { plan: "gratis", limpiarN1co: true });
    await registrarEventoSuscripcion({ idEmpresa: f.id_empresa, origen: "cron", tipo: "a_gratis", clave: `a_gratis:${f.id_empresa}:${f.periodo_fin}` });
    resumen.aGratis++;
  }

  return resumen;
}

async function manejar(request: Request) {
  const esperado = process.env.CRON_SECRET?.trim();
  if (!esperado) return NextResponse.json({ error: "Falta CRON_SECRET en el servidor." }, { status: 503 });
  const recibido = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!mismoSecreto(recibido, esperado)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  try {
    const resumen = await procesar();
    await registrar({ tipo: "accion", evento: "suscripcion.cron", mensaje: "Recordatorios de suscripción", datos: resumen });
    return NextResponse.json({ ok: true, ...resumen });
  } catch (e) {
    await registrar({ tipo: "error", evento: "suscripcion.cron_error", mensaje: e instanceof Error ? e.message : "Error" });
    return NextResponse.json({ error: "Error en el cron." }, { status: 500 });
  }
}

export const GET = manejar;
export const POST = manejar;
