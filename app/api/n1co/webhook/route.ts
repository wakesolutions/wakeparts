import { NextResponse } from "next/server";
import { enviarCorreo } from "@/lib/correo";
import { estadoDesdeN1co, fechaN1co, n1coConfigurado, obtenerSuscripcionN1co } from "@/lib/n1co";
import { registrar } from "@/lib/registro";
import {
  activarSuscripcion,
  cambiarEstadoSuscripcion,
  clienteServicio,
  duenoDeEmpresa,
  empresaPorSuscripcion,
  mismoSecreto,
  planDesdeN1co,
  registrarEventoSuscripcion,
} from "@/lib/suscripcion-servidor";

/**
 * Webhook de n1co (pagos, renovaciones, cancelaciones).
 *
 * El cuerpo NO se toma como verdad: cualquiera puede mandar un POST aquí. Solo
 * se usa para saber qué suscripción mirar; el estado, el plan y el periodo se
 * leen de la API de n1co con nuestras credenciales. Además:
 * - Si existe N1CO_WEBHOOK_SECRET, la URL configurada en n1co debe llevar
 *   `?clave=<secreto>` (comparación en tiempo constante).
 * - Idempotente: cada evento tiene una clave única en `suscripciones_eventos`.
 * - Una suscripción desconocida solo se asocia a una empresa si hay un intento
 *   de pago reciente con el mismo correo y el mismo plan de n1co.
 */

export const dynamic = "force-dynamic";

type CargaWebhook = {
  subscriptionId?: string | number;
  type?: string;
  metadata?: { SubscriptionId?: string; BuyerEmail?: string; OrderReference?: string };
};

const MAX_CUERPO = 64 * 1024;

export async function POST(request: Request) {
  if (!n1coConfigurado()) return NextResponse.json({ error: "No configurado." }, { status: 503 });

  const secreto = process.env.N1CO_WEBHOOK_SECRET?.trim();
  if (secreto && !mismoSecreto(new URL(request.url).searchParams.get("clave"), secreto))
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const texto = await request.text().catch(() => "");
  if (!texto || texto.length > MAX_CUERPO) return NextResponse.json({ error: "Evento inválido." }, { status: 400 });
  let carga: CargaWebhook;
  try {
    carga = JSON.parse(texto) as CargaWebhook;
  } catch {
    return NextResponse.json({ error: "Evento inválido." }, { status: 400 });
  }

  const tipo = String(carga.type ?? "").slice(0, 60);
  const n1coId = String(carga.subscriptionId ?? carga.metadata?.SubscriptionId ?? "").trim();
  if (!tipo || !/^\d{1,18}$/.test(n1coId)) return NextResponse.json({ ok: true, ignorado: true });

  // La verdad sale de n1co.
  let sub;
  try {
    sub = await obtenerSuscripcionN1co(n1coId);
  } catch {
    // 5xx: n1co reintenta más tarde.
    return NextResponse.json({ error: "No se pudo verificar con n1co." }, { status: 502 });
  }
  if (!sub?.subscriptionId || String(sub.subscriptionId) !== n1coId)
    return NextResponse.json({ ok: true, ignorado: true });

  const cobrado = await planDesdeN1co(sub.planId);
  let idEmpresa = await empresaPorSuscripcion(n1coId);
  if (!idEmpresa && cobrado) {
    const correo = (sub.customer?.email ?? carga.metadata?.BuyerEmail ?? "").trim().toLowerCase();
    if (correo) {
      const { data } = await clienteServicio()
        .from("suscripciones_checkout")
        .select("id_empresa")
        .eq("correo", correo)
        .eq("n1co_plan_id", sub.planId!)
        .gt("expira_en", new Date().toISOString())
        .order("creado_en", { ascending: false })
        .limit(1)
        .maybeSingle();
      idEmpresa = (data?.id_empresa as string | undefined) ?? null;
    }
  }

  const clave = `webhook:${tipo}:${n1coId}:${carga.metadata?.OrderReference ?? sub.currentPeriodEnd ?? ""}`;
  const nuevo = await registrarEventoSuscripcion({
    idEmpresa,
    origen: "webhook",
    tipo: tipo === "SubscriptionPayment" ? "renovacion" : tipo === "SubscriptionCancelled" ? "cancelada" : tipo,
    n1coId,
    plan: cobrado?.plan.codigo ?? null,
    ciclo: cobrado?.ciclo ?? null,
    monto: sub.amount ?? null,
    mensaje: sub.subscriptionStatus ?? null,
    clave,
  });
  if (!nuevo) return NextResponse.json({ ok: true, repetido: true });
  if (!idEmpresa) {
    await registrar({ tipo: "error", nivel: "aviso", evento: "suscripcion.webhook_sin_empresa", mensaje: tipo, datos: { n1coId } });
    return NextResponse.json({ ok: true, sinEmpresa: true });
  }

  try {
    const estado = estadoDesdeN1co(sub.subscriptionStatus);
    const periodoFin = fechaN1co(sub.currentPeriodEnd);
    if (estado === "activa" && cobrado) {
      await activarSuscripcion({ idEmpresa, plan: cobrado.plan.codigo, ciclo: cobrado.ciclo, n1coId, periodoFin });
      // Un cobro que quedó «por confirmar» (respuesta perdida o incierta) queda resuelto.
      await clienteServicio()
        .from("suscripciones_checkout")
        .update({ estado: "exitoso" })
        .eq("id_empresa", idEmpresa)
        .eq("plan", cobrado.plan.codigo)
        .in("estado", ["procesando", "autenticacion"]);
    } else if (estado === "vencida") {
      await cambiarEstadoSuscripcion(idEmpresa, "vencida", { periodoFin });
      const dueno = await duenoDeEmpresa(idEmpresa);
      if (dueno)
        await enviarCorreo({
          para: dueno.correo,
          asunto: `No pudimos cobrar tu suscripción de Wake Parts · ${dueno.empresa}`,
          texto: `Hola${dueno.nombre ? ` ${dueno.nombre.split(" ")[0]}` : ""}:\n\nEl cobro de tu plan no pasó. Tenés 3 días para actualizar tu tarjeta en el módulo Suscripción antes de que el taller pase al plan Gratis (tus datos no se borran).`,
        });
    } else if (estado === "cancelada") {
      await cambiarEstadoSuscripcion(idEmpresa, "cancelada", { periodoFin });
    }
  } catch {
    // Se suelta la clave para que el reintento de n1co lo procese.
    await clienteServicio().from("suscripciones_eventos").delete().eq("clave", clave);
    return NextResponse.json({ error: "Error procesando el evento." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
