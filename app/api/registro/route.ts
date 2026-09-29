import type { NextRequest } from "next/server";
import { contextoDe, registrar } from "@/lib/registro";
import { createClient } from "@/lib/supabase/server";

/**
 * Recibe errores del navegador (lib/registro-cliente.ts) y los guarda en
 * `registros`. Es pública (también fallan páginas sin sesión), así que acepta
 * solo errores, recorta todo y limita cuántos recibe por IP.
 */

const VENTANA_MS = 60_000;
const TOPE_POR_IP = 30;
const porIp = new Map<string, { desde: number; cuenta: number }>();

function excedido(ip: string) {
  const ahora = Date.now();
  const r = porIp.get(ip);
  if (!r || r.desde < ahora - VENTANA_MS) {
    porIp.set(ip, { desde: ahora, cuenta: 1 });
    if (porIp.size > 5000) porIp.clear();
    return false;
  }
  r.cuenta++;
  return r.cuenta > TOPE_POR_IP;
}

const texto = (v: unknown, max: number) => (typeof v === "string" && v ? v.slice(0, max) : null);

export async function POST(request: NextRequest) {
  const contexto = contextoDe(request.headers);
  if (excedido(contexto.ip ?? "desconocida")) return new Response(null, { status: 429 });

  let cuerpo: Record<string, unknown>;
  try {
    const crudo = await request.text();
    if (crudo.length > 16_000) return new Response(null, { status: 413 });
    cuerpo = JSON.parse(crudo);
    if (!cuerpo || typeof cuerpo !== "object") throw new Error();
  } catch {
    return new Response(null, { status: 400 });
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims as { sub?: string; email?: string } | undefined;

  await registrar({
    tipo: "error",
    evento: "error.navegador",
    mensaje: texto(cuerpo.mensaje, 2000) ?? "Error sin mensaje",
    id_usuario: claims?.sub ?? null,
    correo: claims?.email ?? null,
    ruta: texto(cuerpo.ruta, 500),
    datos: {
      pila: texto(cuerpo.pila, 4000),
      digest: texto(cuerpo.digest, 100),
      origen: texto(cuerpo.origen, 60),
      archivo: texto(cuerpo.archivo, 500),
    },
    contexto,
  });

  return new Response(null, { status: 204 });
}
