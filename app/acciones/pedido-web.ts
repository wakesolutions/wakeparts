"use server";

import { registrar } from "@/lib/registro";
import { createClient } from "@/lib/supabase/server";

type Entrada = {
  slug: string;
  cliente: { nombre: string; telefono: string; correo?: string; mensaje?: string };
  vehiculo: { id_marca?: number; id_modelo?: number; id_modelo_anio?: number; id_especificacion?: number } | null;
  lineas: { id_producto: number; cantidad: number }[];
};

/**
 * Pedido de un visitante del sitio público (sin sesión). Toda la validación,
 * los precios y el límite anti abuso viven en enviar_pedido_web() (0013); la
 * IP llega a la base en el header x-cliente-ip (lib/supabase/server.ts).
 */
export async function enviarPedidoWeb(e: Entrada): Promise<{ ok: true; numero: number } | { ok: false; error: string }> {
  if (!e || typeof e.slug !== "string" || !Array.isArray(e.lineas)) return { ok: false, error: "Datos incompletos." };

  if (e.slug === "demo" && process.env.NODE_ENV === "development") {
    return { ok: true, numero: 1000 + Math.floor(Math.random() * 900) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("enviar_pedido_web", {
    p_slug: e.slug,
    p_cliente: {
      nombre: String(e.cliente?.nombre ?? "").slice(0, 120),
      telefono: String(e.cliente?.telefono ?? "").slice(0, 30),
      correo: String(e.cliente?.correo ?? "").slice(0, 120),
      mensaje: String(e.cliente?.mensaje ?? "").slice(0, 600),
    },
    p_vehiculo: e.vehiculo ?? null,
    p_lineas: e.lineas.slice(0, 40).map((l) => ({ id_producto: Number(l.id_producto), cantidad: Number(l.cantidad) })),
  });

  if (error) {
    // P0001 = mensaje pensado para el visitante (validación o límite).
    if (error.code === "P0001") return { ok: false, error: error.message };
    console.error("[enviarPedidoWeb]", error);
    await registrar({ tipo: "error", evento: "pedido_web.error", nivel: "error", mensaje: error.message, datos: { slug: e.slug } });
    return { ok: false, error: "No pudimos mandar tu pedido. Intentá de nuevo o escribinos por WhatsApp." };
  }

  const r = data as { numero: number; lineas: number };
  await registrar({ tipo: "accion", evento: "pedido_web.recibido", mensaje: `Pedido web #${r.numero}`, datos: { slug: e.slug, lineas: r.lineas } });
  return { ok: true, numero: r.numero };
}
