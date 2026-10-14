import { NextResponse } from "next/server";
import { procesarAvisosCai } from "@/lib/avisos-cai";
import { enviarCorreo } from "@/lib/correo";
import { rechazoCron } from "@/lib/cron";
import { registrar } from "@/lib/registro";
import { adminsPlataforma } from "@/lib/sesion";
import { URL_SITIO } from "@/lib/sitio";
import { clienteServicio } from "@/lib/suscripcion-servidor";

/**
 * Aviso por correo de errores (cron-job.org, cada 15 minutos). Header
 * obligatorio: `Authorization: Bearer <CRON_SECRET>`.
 *
 * Junta lo nuevo del registro desde el último aviso: todo lo de nivel «error»
 * y los avisos de cobros (`suscripcion.*`). Si hay algo, manda UN correo
 * agrupado a ALERTAS_CORREO (o a ADMINS_PLATAFORMA). La marca del último aviso
 * es el evento `alerta.enviada` del propio registro: sin migración, y si el
 * correo falla, el siguiente cron lo vuelve a intentar con lo mismo.
 *
 * Si la base no responde, este endpoint da 500: con «avisar si falla» en
 * cron-job.org también sirve de alarma de que algo grande se cayó.
 *
 * Antes, los avisos de CAI por vencer o por agotarse a los talleres
 * (`lib/avisos-cai.ts`, 0027). Si fallan, quedan como error en el registro y
 * salen en este mismo correo.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_FILAS = 500;
const MAX_GRUPOS = 25;
/** Primera vez (sin aviso previo): se mira solo la última hora para no mandar el historial. */
const PRIMERA_VEZ_MS = 60 * 60_000;

type Fila = {
  creado_en: string;
  nivel: string;
  evento: string;
  mensaje: string | null;
  ruta: string | null;
  correo: string | null;
  id_empresa: string | null;
};

const hora = (iso: string) =>
  new Intl.DateTimeFormat("es-HN", { dateStyle: "short", timeStyle: "short", timeZone: "America/Tegucigalpa" }).format(new Date(iso));

function destinatarios() {
  const propios = (process.env.ALERTAS_CORREO ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  return propios.length ? propios : [...adminsPlataforma()];
}

async function manejar(request: Request) {
  const rechazo = rechazoCron(request);
  if (rechazo) return rechazo;

  const cai = await procesarAvisosCai();

  const db = clienteServicio();
  const { data: marca, error: errorMarca } = await db
    .from("registros")
    .select("datos")
    .eq("evento", "alerta.enviada")
    .order("creado_en", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (errorMarca) return NextResponse.json({ error: "La base no respondió." }, { status: 500 });

  const hastaPrevio = (marca?.datos as { hasta?: string } | null)?.hasta;
  const desde = hastaPrevio ?? new Date(Date.now() - PRIMERA_VEZ_MS).toISOString();

  const { data, error } = await db
    .from("registros")
    .select("creado_en, nivel, evento, mensaje, ruta, correo, id_empresa")
    .gt("creado_en", desde)
    .or("nivel.eq.error,and(nivel.eq.aviso,evento.like.suscripcion.*)")
    .order("creado_en", { ascending: true })
    .limit(MAX_FILAS);
  if (error) return NextResponse.json({ error: "La base no respondió." }, { status: 500 });

  const filas = (data ?? []) as Fila[];
  if (!filas.length) return NextResponse.json({ ok: true, nuevos: 0, cai });

  // Agrupar por evento + mensaje: cien veces el mismo error es una sola línea.
  const grupos = new Map<string, { fila: Fila; veces: number; ultima: string; empresas: Set<string> }>();
  for (const f of filas) {
    const clave = `${f.evento}|${(f.mensaje ?? "").slice(0, 160)}`;
    const g = grupos.get(clave);
    if (g) {
      g.veces++;
      g.ultima = f.creado_en;
      if (f.id_empresa) g.empresas.add(f.id_empresa);
    } else grupos.set(clave, { fila: f, veces: 1, ultima: f.creado_en, empresas: new Set(f.id_empresa ? [f.id_empresa] : []) });
  }
  // Primero los cobros, después lo más repetido.
  const lista = [...grupos.values()].sort(
    (a, b) =>
      Number(b.fila.evento.startsWith("suscripcion.")) - Number(a.fila.evento.startsWith("suscripcion.")) || b.veces - a.veces,
  );
  const cobros = lista.filter((g) => g.fila.evento.startsWith("suscripcion.")).length;
  const hasta = filas[filas.length - 1].creado_en;

  const lineas = lista.slice(0, MAX_GRUPOS).map((g) => {
    const f = g.fila;
    return [
      `• ${f.evento}${g.veces > 1 ? ` (×${g.veces})` : ""} · ${f.nivel} · última ${hora(g.ultima)}`,
      `  ${(f.mensaje ?? "Sin mensaje").slice(0, 300)}`,
      f.ruta ? `  Ruta: ${f.ruta}` : null,
      f.correo ? `  Usuario: ${f.correo}` : null,
      g.empresas.size ? `  Empresas afectadas: ${g.empresas.size}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  });
  const resto = lista.length - MAX_GRUPOS;

  const asunto = `${cobros ? "⚠ Cobros · " : ""}${filas.length} error${filas.length === 1 ? "" : "es"} nuevo${filas.length === 1 ? "" : "s"} en Wake Parts`;
  const texto = [
    `Desde ${hora(desde)} hasta ${hora(hasta)} se registraron ${filas.length} evento(s) en ${lista.length} grupo(s)${filas.length === MAX_FILAS ? " (tope alcanzado: hay más)" : ""}.`,
    cobros ? `${cobros} grupo(s) son de cobros: revisalos primero (guía: docs/operacion.md › Cobros).` : null,
    "",
    lineas.join("\n\n"),
    resto > 0 ? `\n… y ${resto} grupo(s) más.` : null,
    "",
    `Detalle completo en el módulo Actividad: ${URL_SITIO}/inicio`,
  ]
    .filter((l) => l !== null)
    .join("\n");

  const para = destinatarios();
  let enviados = 0;
  for (const correo of para) {
    const r = await enviarCorreo({ para: correo, asunto, texto });
    if (r.ok) enviados++;
  }
  // Sin ningún correo enviado no se mueve la marca: el próximo cron reintenta.
  if (!enviados) return NextResponse.json({ error: "No se pudo enviar el aviso por correo." }, { status: 500 });

  await registrar({
    tipo: "accion",
    evento: "alerta.enviada",
    mensaje: asunto,
    datos: { desde, hasta, eventos: filas.length, grupos: lista.length, cobros, destinatarios: enviados },
  });
  return NextResponse.json({ ok: true, nuevos: filas.length, grupos: lista.length, enviados, cai });
}

export const GET = manejar;
export const POST = manejar;
