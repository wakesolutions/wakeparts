"use server";

import {
  cancelarSuscripcionN1co,
  crearSuscripcionN1co,
  ErrorN1co,
  estadoDesdeN1co,
  fechaN1co,
  modoN1co,
  n1coConfigurado,
  obtenerSuscripcionN1co,
  pideFacturacion,
  tokenizarTarjeta,
} from "@/lib/n1co";
import { normalizarLimites, normalizarModulosPlan } from "@/lib/permisos";
import { registrar } from "@/lib/registro";
import { obtenerSesion } from "@/lib/sesion";
import {
  activarSuscripcion,
  cambiarEstadoSuscripcion,
  clienteServicio,
  duenoDeEmpresa,
  leerPlanCobro,
  leerSuscripcionEmpresa,
  planDesdeN1co,
  registrarEventoSuscripcion,
} from "@/lib/suscripcion-servidor";
import {
  telefonoE164,
  validarPago,
  type DatosSuscripcion,
  type EventoSuscripcion,
  type MiSuscripcion,
  type PeticionPago,
  type PlanPublico,
  type ResultadoPago,
  type UsoEmpresa,
} from "@/lib/suscripcion";
import { enviarCorreo } from "@/lib/correo";
import { createClient } from "@/lib/supabase/server";

/**
 * Suscripción del taller con n1co Business (0024). Solo el dueño paga, cambia
 * o cancela. Los datos de la tarjeta van directo a n1co para tokenizarlos: no
 * se guardan, no se registran y no vuelven al navegador. La empresa solo se
 * activa con la respuesta de n1co (servidor a servidor), nunca con lo que diga
 * el navegador.
 */

type Resultado<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const FALTA_MIGRACION = "Falta ejecutar la migración 0024 (suscripciones).";
const MAX_INTENTOS = 6;
const VENTANA_INTENTOS_MIN = 15;
/** Solo se abre en el iframe un 3D Secure de n1co o de su procesador. */
const HOST_3DS = /(^|\.)(n1co\.com|n1co\.shop|h4b\.dev)$/i;

async function dueno() {
  const sesion = await obtenerSesion();
  if (!sesion?.empresa) return { error: "Tu sesión venció. Volvé a entrar." } as const;
  if (sesion.rol !== "dueno") return { error: "Solo el dueño del taller puede gestionar la suscripción." } as const;
  return { sesion, empresa: sesion.empresa } as const;
}

export async function leerSuscripcion(): Promise<Resultado<{ datos: DatosSuscripcion }>> {
  const sesion = await obtenerSesion();
  if (!sesion?.empresa) return { ok: false, error: "Tu sesión venció. Volvé a entrar." };
  const supabase = await createClient();
  const id = sesion.empresa.id;
  const [sus, uso, planes, eventos] = await Promise.all([
    supabase.rpc("mi_suscripcion", { p_empresa: id }).maybeSingle(),
    supabase.rpc("mi_uso", { p_empresa: id }).maybeSingle(),
    supabase.rpc("planes_publicos"),
    supabase
      .from("suscripciones_eventos")
      .select("id, tipo, plan, ciclo, monto, mensaje, creado_en")
      .eq("id_empresa", id)
      .in("tipo", ["pago", "renovacion", "pago_fallido", "cancelada", "vencida", "cambio_plan", "prueba_fin"])
      .order("creado_en", { ascending: false })
      .limit(12),
  ]);
  const error = sus.error ?? uso.error ?? planes.error;
  if (error) {
    console.error("[leerSuscripcion]", error.code);
    return { ok: false, error: ["PGRST202", "42883", "PGRST205"].includes(error.code ?? "") ? FALTA_MIGRACION : "No se pudo leer la suscripción." };
  }
  return {
    ok: true,
    datos: {
      suscripcion: (sus.data as MiSuscripcion | null) ?? null,
      uso: uso.data ? ({ ...(uso.data as UsoEmpresa), almacenamiento_bytes: Number((uso.data as UsoEmpresa).almacenamiento_bytes) }) : null,
      planes: ((planes.data ?? []) as PlanPublico[]).map((p) => ({
        ...p,
        precio_mensual: p.precio_mensual === null ? null : Number(p.precio_mensual),
        precio_anual: p.precio_anual === null ? null : Number(p.precio_anual),
        modulos: normalizarModulosPlan(p.modulos),
        limites: normalizarLimites((p.limites ?? {}) as Record<string, unknown>),
      })),
      eventos: ((eventos.data ?? []) as EventoSuscripcion[]).map((e) => ({ ...e, monto: e.monto === null ? null : Number(e.monto) })),
      puedeGestionar: sesion.rol === "dueno",
      cobrosActivos: n1coConfigurado(),
      modo: modoN1co(),
    },
  };
}

/** Mensaje para el usuario según el error de n1co (sin detalles internos). */
function mensajeN1co(e: unknown) {
  if (e instanceof ErrorN1co) {
    if (e.estado === 402 || e.estado === 400 || e.estado === 422)
      return "La tarjeta no fue aceptada. Revisá los datos o probá con otra.";
    if (e.estado === 503) return "Los cobros no están configurados todavía. Escribinos.";
  }
  return "No pudimos conectar con el procesador de pagos. Intentá de nuevo en unos minutos.";
}

async function registrarFallo(idEmpresa: string, correo: string, idUsuario: string, contexto: string, e: unknown) {
  const datos = e instanceof ErrorN1co ? { estado: e.estado, codigo: e.codigo } : { tipo: e instanceof Error ? e.name : "desconocido" };
  await registrar({
    tipo: "error",
    evento: `suscripcion.${contexto}`,
    mensaje: e instanceof ErrorN1co ? e.message : "Error al hablar con n1co",
    id_usuario: idUsuario,
    correo,
    id_empresa: idEmpresa,
    datos,
  });
}

export async function pagarSuscripcion(p: PeticionPago): Promise<ResultadoPago> {
  const d = await dueno();
  if ("error" in d) return { ok: false, error: d.error! };
  const { sesion, empresa } = d;

  // 1) Validación local completa antes de tocar n1co.
  const invalido = validarPago(p);
  if (invalido) return { ok: false, error: invalido.error, campo: invalido.campo };
  if (!n1coConfigurado()) return { ok: false, error: "Los cobros no están configurados todavía. Escribinos." };

  const plan = await leerPlanCobro(String(p.plan));
  const visible = plan?.activo && (plan.publico || (plan.solo_admins && sesion.usuario.esAdminPlataforma));
  if (!plan || !visible) return { ok: false, error: "Ese plan no está disponible." };
  const n1coPlan = p.ciclo === "anual" ? plan.n1co_plan_anual : plan.n1co_plan_mensual;
  const precio = p.ciclo === "anual" ? plan.precio_anual : plan.precio_mensual;
  if (!n1coPlan || !precio) return { ok: false, error: `El plan ${plan.nombre} todavía no se puede pagar ${p.ciclo === "anual" ? "al año" : "al mes"}.` };

  const actual = await leerSuscripcionEmpresa(empresa.id);
  if (actual?.estado === "activa" && actual.plan === plan.codigo && actual.ciclo === p.ciclo && actual.n1co_suscripcion_id)
    return { ok: false, error: `Ya tenés el plan ${plan.nombre} ${p.ciclo}.` };

  const db = clienteServicio();
  const telefono = telefonoE164(p.telefono)!;
  const cliente = {
    id: empresa.id,
    name: (p.tarjeta?.titular.trim() || sesion.usuario.nombre).slice(0, 120),
    email: sesion.usuario.correo.trim().toLowerCase(),
    phoneNumber: telefono,
  };
  const pais = p.facturacion.pais.trim().toUpperCase();
  const facturacion = pideFacturacion(pais)
    ? { countryCode: pais, stateCode: p.facturacion.estado.trim().slice(0, 10), zipCode: p.facturacion.codigoPostal.trim().slice(0, 20) }
    : null;

  // 2) Intento: nuevo (con tarjeta) o continuación del 3D Secure (con el método ya tokenizado).
  let intento: { id: string; metodo: string | null };
  let autenticacion: string | null = null;
  if (p.intento) {
    const { data: fila } = await db
      .from("suscripciones_checkout")
      .select("id, plan, ciclo, estado, n1co_metodo_pago, n1co_autenticacion, expira_en")
      .eq("id", p.intento)
      .eq("id_empresa", empresa.id)
      .maybeSingle();
    if (
      !fila ||
      new Date(fila.expira_en) < new Date() ||
      fila.plan !== plan.codigo ||
      fila.ciclo !== p.ciclo ||
      !["autenticacion", "iniciado"].includes(fila.estado) ||
      !fila.n1co_metodo_pago
    )
      return { ok: false, error: "El intento de pago venció. Empezá de nuevo." };
    // El id de la autenticación lo guardó el servidor; si el iframe manda otro, no se acepta.
    if (fila.estado === "autenticacion" && p.autenticacion && p.autenticacion !== fila.n1co_autenticacion)
      return { ok: false, error: "La verificación del banco no coincide. Empezá de nuevo." };
    intento = { id: fila.id, metodo: fila.n1co_metodo_pago };
    autenticacion = fila.estado === "autenticacion" ? fila.n1co_autenticacion : null;
    // Candado: si llegan dos continuaciones (mensaje del iframe + botón), solo una cobra.
    const { data: tomado } = await db
      .from("suscripciones_checkout")
      .update({ estado: "procesando" })
      .eq("id", fila.id)
      .eq("estado", fila.estado)
      .select("id");
    if (!tomado?.length)
      return { ok: true, estado: "procesando", intento: fila.id, mensaje: "Estamos confirmando el pago con tu banco…" };
  } else {
    const desde = new Date(Date.now() - VENTANA_INTENTOS_MIN * 60_000).toISOString();
    const { count } = await db
      .from("suscripciones_checkout")
      .select("id", { count: "exact", head: true })
      .eq("id_empresa", empresa.id)
      .gte("creado_en", desde);
    if ((count ?? 0) >= MAX_INTENTOS)
      return { ok: false, error: `Demasiados intentos de pago. Esperá ${VENTANA_INTENTOS_MIN} minutos y probá de nuevo.` };

    const { data: nuevo, error } = await db
      .from("suscripciones_checkout")
      .insert({
        id_empresa: empresa.id,
        id_usuario: sesion.usuario.id,
        correo: cliente.email,
        plan: plan.codigo,
        ciclo: p.ciclo,
        n1co_plan_id: n1coPlan,
      })
      .select("id")
      .single();
    if (error || !nuevo) {
      console.error("[pagarSuscripcion] intento", error?.code);
      return { ok: false, error: error?.code === "42P01" ? FALTA_MIGRACION : "No se pudo iniciar el pago." };
    }
    intento = { id: nuevo.id as string, metodo: null };

    try {
      const metodo = await tokenizarTarjeta(cliente, {
        numero: p.tarjeta!.numero,
        titular: p.tarjeta!.titular.trim(),
        mes: p.tarjeta!.mes,
        anio: p.tarjeta!.anio,
        cvv: p.tarjeta!.cvv,
      });
      intento.metodo = metodo.id;
      await db.from("suscripciones_checkout").update({ n1co_metodo_pago: metodo.id }).eq("id", intento.id);
      // Tarjeta de EE. UU./Canadá sin dirección de facturación: se pide antes de cobrar.
      if (pideFacturacion(metodo.pais) && !facturacion)
        return {
          ok: true,
          estado: "facturacion",
          intento: intento.id,
          mensaje: "Tu tarjeta pide dirección de facturación: elegí el país y completá estado y código postal.",
        };
    } catch (e) {
      await db.from("suscripciones_checkout").update({ estado: "fallido" }).eq("id", intento.id);
      await registrarFallo(empresa.id, sesion.usuario.correo, sesion.usuario.id, "tarjeta", e);
      return { ok: false, error: mensajeN1co(e) };
    }
  }

  // 3) Crear la suscripción en n1co.
  try {
    const r = await crearSuscripcionN1co({
      planId: n1coPlan,
      cliente,
      metodoPago: intento.metodo!,
      autenticacion,
      facturacion,
    });

    // Rastro de cada respuesta de n1co (sin datos de la tarjeta): sin esto, un cobro
    // que se queda a medias no deja nada que revisar en Actividad.
    await registrar({
      tipo: "accion",
      nivel: r.status === "SUCCEEDED" ? "info" : "aviso",
      evento: "suscripcion.n1co",
      mensaje: `${autenticacion ? "Continuación tras 3DS" : "Creación"}: ${r.status ?? "sin estado"}`,
      id_usuario: sesion.usuario.id,
      correo: sesion.usuario.correo,
      id_empresa: empresa.id,
      datos: {
        intento: intento.id,
        plan: plan.codigo,
        con_autenticacion: Boolean(autenticacion),
        estado: r.status ?? null,
        codigo: r.error?.code ?? null,
        mensaje: (r.error?.message ?? r.error?.detail ?? r.message ?? "").slice(0, 200) || null,
        suscripcion: r.subscription?.subscriptionId ?? null,
      },
    });

    if (r.status === "AUTHENTICATION_REQUIRED") {
      const url = r.authentication?.url ?? "";
      let seguro = false;
      try {
        const u = new URL(url);
        seguro = u.protocol === "https:" && HOST_3DS.test(u.hostname);
      } catch {
        seguro = false;
      }
      if (!seguro || !r.authentication?.id) {
        await registrarFallo(empresa.id, sesion.usuario.correo, sesion.usuario.id, "3ds", new Error("URL de 3DS no permitida"));
        return { ok: false, error: "El banco pidió una verificación que no pudimos abrir. Probá con otra tarjeta." };
      }
      await db
        .from("suscripciones_checkout")
        .update({ estado: "autenticacion", n1co_autenticacion: r.authentication.id })
        .eq("id", intento.id);
      return { ok: true, estado: "autenticacion", intento: intento.id, url, mensaje: "Tu banco pide confirmar el pago." };
    }

    const sub = r.subscription;
    if (r.status === "SUCCEEDED" && sub?.subscriptionId) {
      const n1coId = String(sub.subscriptionId);
      // Doble chequeo: el plan cobrado es el que se pidió.
      const cobrado = await planDesdeN1co(sub.planId ?? n1coPlan);
      if (!cobrado || cobrado.plan.codigo !== plan.codigo) {
        await registrarEventoSuscripcion({
          idEmpresa: empresa.id,
          origen: "checkout",
          tipo: "plan_no_coincide",
          n1coId,
          plan: plan.codigo,
          mensaje: `n1co cobró el plan ${sub.planId ?? "?"}`,
        });
      }
      await activarSuscripcion({
        idEmpresa: empresa.id,
        plan: cobrado?.plan.codigo ?? plan.codigo,
        ciclo: cobrado?.ciclo ?? p.ciclo,
        n1coId,
        periodoFin: fechaN1co(sub.currentPeriodEnd),
      });
      await db.from("suscripciones_checkout").update({ estado: "exitoso" }).eq("id", intento.id);
      await registrarEventoSuscripcion({
        idEmpresa: empresa.id,
        origen: "checkout",
        tipo: actual?.n1co_suscripcion_id ? "cambio_plan" : "pago",
        n1coId,
        plan: plan.codigo,
        ciclo: p.ciclo,
        monto: sub.amount ?? precio,
        mensaje: `${plan.nombre} ${p.ciclo}`,
        clave: `pago:${n1coId}:${sub.currentPeriodEnd ?? "inicio"}`,
        datos: { autorizacion: r.payment?.authorizationCode ?? null },
      });

      // Cambio de plan: la suscripción anterior se cancela en n1co para no cobrar dos veces.
      const anterior = actual?.n1co_suscripcion_id;
      if (anterior && anterior !== n1coId) {
        try {
          await cancelarSuscripcionN1co(anterior, `Cambio al plan ${plan.nombre} desde Wake Parts`);
          await registrarEventoSuscripcion({
            idEmpresa: empresa.id,
            origen: "checkout",
            tipo: "cancelada_por_cambio",
            n1coId: anterior,
            clave: `cambio:${anterior}`,
          });
        } catch (e) {
          await registrarFallo(empresa.id, sesion.usuario.correo, sesion.usuario.id, "cancelar_anterior", e);
          await registrarEventoSuscripcion({
            idEmpresa: empresa.id,
            origen: "checkout",
            tipo: "cancelar_anterior_fallo",
            n1coId: anterior,
            mensaje: "Cancelar a mano en el portal de n1co",
          });
        }
      }

      await registrar({
        tipo: "accion",
        evento: "suscripcion.pago",
        mensaje: `${plan.nombre} ${p.ciclo}`,
        id_usuario: sesion.usuario.id,
        correo: sesion.usuario.correo,
        id_empresa: empresa.id,
        datos: { plan: plan.codigo, ciclo: p.ciclo, n1co: n1coId },
      });
      return { ok: true, estado: "exitoso", mensaje: `¡Listo! Tu taller ya tiene el plan ${plan.nombre}.` };
    }

    await db.from("suscripciones_checkout").update({ estado: "fallido" }).eq("id", intento.id);
    await registrarEventoSuscripcion({
      idEmpresa: empresa.id,
      origen: "checkout",
      tipo: "pago_fallido",
      plan: plan.codigo,
      ciclo: p.ciclo,
      mensaje: (r.error?.message ?? r.message ?? "Rechazado").slice(0, 200),
      datos: { codigo: r.error?.code ?? null },
    });
    const motivo = (r.error?.message ?? r.message ?? "").trim().slice(0, 160);
    return { ok: false, error: motivo ? `El pago no pasó: ${motivo}` : "El pago no pasó. Probá con otra tarjeta." };
  } catch (e) {
    await db.from("suscripciones_checkout").update({ estado: "fallido" }).eq("id", intento.id);
    await registrarFallo(empresa.id, sesion.usuario.correo, sesion.usuario.id, "crear", e);
    return { ok: false, error: mensajeN1co(e) };
  }
}

/**
 * Estado de un intento mientras otra petición lo cobra (el navegador pregunta
 * cada pocos segundos). Solo lee lo que dejó el servidor; nunca cobra.
 */
export async function estadoPago(intentoId: string): Promise<ResultadoPago> {
  const d = await dueno();
  if ("error" in d) return { ok: false, error: d.error! };
  const { data: fila } = await clienteServicio()
    .from("suscripciones_checkout")
    .select("id, plan, estado")
    .eq("id", String(intentoId ?? ""))
    .eq("id_empresa", d.empresa.id)
    .maybeSingle();
  if (!fila) return { ok: false, error: "No encontramos ese intento de pago. Empezá de nuevo." };
  if (fila.estado === "procesando")
    return { ok: true, estado: "procesando", intento: fila.id, mensaje: "Estamos confirmando el pago con tu banco…" };
  if (fila.estado === "exitoso") {
    const plan = await leerPlanCobro(String(fila.plan));
    return { ok: true, estado: "exitoso", mensaje: `¡Listo! Tu taller ya tiene el plan ${plan?.nombre ?? fila.plan}.` };
  }
  if (fila.estado === "autenticacion")
    return { ok: false, error: "Tu banco pidió verificar otra vez. Volvé a ingresar la tarjeta para intentarlo de nuevo." };
  return { ok: false, error: "El pago no pasó. Revisá los datos o probá con otra tarjeta." };
}

/** Lo que avisa la ventana del 3D Secure (tipo y estado, nada de la tarjeta), para Actividad. */
export async function avisarTresDs(
  intentoId: string,
  m: { origen: string; tipo: string; estado: string; conId: boolean; error?: string },
): Promise<void> {
  const d = await dueno();
  if ("error" in d) return;
  const corto = (v: unknown, n = 80) => String(v ?? "").slice(0, n);
  await registrar({
    tipo: "accion",
    evento: "suscripcion.3ds_mensaje",
    mensaje: `${corto(m.tipo, 40) || "sin tipo"} · ${corto(m.estado, 20) || "sin estado"}`,
    id_usuario: d.sesion.usuario.id,
    correo: d.sesion.usuario.correo,
    id_empresa: d.empresa.id,
    datos: { intento: corto(intentoId, 40), origen: corto(m.origen), con_id: Boolean(m.conId), error: corto(m.error, 160) || null },
  });
}

export async function cancelarSuscripcion(motivo: string): Promise<Resultado<{ mensaje: string }>> {
  const d = await dueno();
  if ("error" in d) return { ok: false, error: d.error! };
  const { sesion, empresa } = d;
  const fila = await leerSuscripcionEmpresa(empresa.id);
  if (!fila?.n1co_suscripcion_id || !["activa", "vencida"].includes(fila.estado))
    return { ok: false, error: "No hay una suscripción con tarjeta para cancelar." };

  const razon = motivo.trim().slice(0, 280) || `Cancelada por ${sesion.usuario.correo} desde Wake Parts`;
  try {
    await cancelarSuscripcionN1co(fila.n1co_suscripcion_id, razon);
  } catch (e) {
    await registrarFallo(empresa.id, sesion.usuario.correo, sesion.usuario.id, "cancelar", e);
    return { ok: false, error: "No se pudo cancelar en el procesador de pagos. Intentá de nuevo o escribinos." };
  }
  await cambiarEstadoSuscripcion(empresa.id, "cancelada");
  await registrarEventoSuscripcion({
    idEmpresa: empresa.id,
    origen: "cancelacion",
    tipo: "cancelada",
    n1coId: fila.n1co_suscripcion_id,
    plan: fila.plan,
    mensaje: razon,
    clave: `cancelada:${fila.n1co_suscripcion_id}`,
  });
  await registrar({
    tipo: "accion",
    evento: "suscripcion.cancelar",
    mensaje: fila.plan,
    id_usuario: sesion.usuario.id,
    correo: sesion.usuario.correo,
    id_empresa: empresa.id,
  });

  const hasta = fila.periodo_fin
    ? new Intl.DateTimeFormat("es-HN", { day: "numeric", month: "long", year: "numeric" }).format(new Date(fila.periodo_fin))
    : null;
  const contacto = await duenoDeEmpresa(empresa.id);
  if (contacto)
    await enviarCorreo({
      para: contacto.correo,
      asunto: `Cancelaste tu suscripción de Wake Parts · ${contacto.empresa}`,
      texto: `Hola${contacto.nombre ? ` ${contacto.nombre.split(" ")[0]}` : ""}:\n\nTu suscripción quedó cancelada y no se harán más cobros.${hasta ? ` Seguís con todo tu plan hasta el ${hasta}; después el taller pasa al plan Gratis, sin perder tus datos.` : ""}\n\nSi fue un error, podés suscribirte de nuevo en el módulo Suscripción.`,
    });
  return {
    ok: true,
    mensaje: hasta
      ? `Suscripción cancelada. No habrá más cobros y seguís con tu plan hasta el ${hasta}.`
      : "Suscripción cancelada. No habrá más cobros.",
  };
}

/** Consulta a n1co el estado real (p. ej. si el 3D Secure terminó pero la ventana se cerró). */
export async function sincronizarSuscripcion(): Promise<Resultado<{ mensaje: string }>> {
  const d = await dueno();
  if ("error" in d) return { ok: false, error: d.error! };
  const { sesion, empresa } = d;
  const fila = await leerSuscripcionEmpresa(empresa.id);
  if (!fila?.n1co_suscripcion_id) return { ok: false, error: "No hay una suscripción con tarjeta todavía." };
  try {
    const sub = await obtenerSuscripcionN1co(fila.n1co_suscripcion_id);
    const estado = estadoDesdeN1co(sub.subscriptionStatus);
    const cobrado = await planDesdeN1co(sub.planId);
    if (estado === "activa" && cobrado)
      await activarSuscripcion({
        idEmpresa: empresa.id,
        plan: cobrado.plan.codigo,
        ciclo: cobrado.ciclo,
        n1coId: String(sub.subscriptionId),
        periodoFin: fechaN1co(sub.currentPeriodEnd),
      });
    else if (estado !== "activa" && fila.estado !== estado)
      await cambiarEstadoSuscripcion(empresa.id, estado, { periodoFin: fechaN1co(sub.currentPeriodEnd) });
    await registrarEventoSuscripcion({
      idEmpresa: empresa.id,
      origen: "sincronizacion",
      tipo: "sincronizada",
      n1coId: fila.n1co_suscripcion_id,
      mensaje: sub.subscriptionStatus ?? null,
    });
    return { ok: true, mensaje: estado === "activa" ? "Tu suscripción está al día." : "Actualizamos el estado de tu suscripción." };
  } catch (e) {
    await registrarFallo(empresa.id, sesion.usuario.correo, sesion.usuario.id, "sincronizar", e);
    return { ok: false, error: mensajeN1co(e) };
  }
}
