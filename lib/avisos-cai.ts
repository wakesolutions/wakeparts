import "server-only";
import { enviarCorreo } from "@/lib/correo";
import { registrar } from "@/lib/registro";
import { URL_SITIO } from "@/lib/sitio";
import { clienteServicio } from "@/lib/suscripcion-servidor";

/**
 * Avisos de CAI por vencer o por agotarse (0027). Lo llama `/api/cron/alertas`
 * (cada 15 min):
 * 1. `revisar_cai()` crea los avisos por fecha que cruzaron hoy (los de rango
 *    los crea el trigger al facturar) y su tarea en la campanita.
 * 2. Manda UN correo por empresa al dueño y a los administradores con los
 *    avisos sin correo. Si el correo falla, quedan pendientes y el siguiente
 *    cron reintenta. Los avisos de más de 3 días sin correo se descartan (no se
 *    manda un aviso viejo como si fuera nuevo).
 * Nunca lanza: devuelve un resumen para la respuesta del cron.
 */

const MAX_DIAS_PENDIENTE = 3;

type Aviso = { id: number; id_empresa: string; aviso: string; titulo: string; cuerpo: string | null };

export async function procesarAvisosCai(): Promise<{ nuevos: number; correos: number; error?: string }> {
  try {
    const db = clienteServicio();
    const { data: nuevos, error: errorRevisar } = await db.rpc("revisar_cai");
    if (errorRevisar) throw new Error(`revisar_cai: ${errorRevisar.message}`);

    const desde = new Date(Date.now() - MAX_DIAS_PENDIENTE * 86_400_000).toISOString();
    const { data, error } = await db
      .from("cai_avisos")
      .select("id, id_empresa, aviso, titulo, cuerpo")
      .is("correo_enviado_en", null)
      .gte("creado_en", desde)
      .order("creado_en")
      .limit(200);
    if (error) throw new Error(`cai_avisos: ${error.message}`);

    const porEmpresa = new Map<string, Aviso[]>();
    for (const a of (data ?? []) as Aviso[]) porEmpresa.set(a.id_empresa, [...(porEmpresa.get(a.id_empresa) ?? []), a]);

    let correos = 0;
    for (const [idEmpresa, avisos] of porEmpresa) {
      const { data: miembros } = await db
        .from("empresas_usuarios")
        .select("usuarios(correo, nombre), empresas(nombre)")
        .eq("id_empresa", idEmpresa)
        .in("rol", ["dueno", "admin"])
        .eq("activo", true);
      const filas = (miembros ?? []) as unknown as {
        usuarios: { correo: string; nombre: string | null } | null;
        empresas: { nombre: string } | null;
      }[];
      const para = [...new Set(filas.map((f) => f.usuarios?.correo?.trim().toLowerCase()).filter(Boolean))] as string[];
      const empresa = filas[0]?.empresas?.nombre ?? "tu taller";
      if (!para.length) continue;

      const grave = avisos.some((a) => a.aviso === "vencido" || a.aviso === "agotado");
      const asunto = grave
        ? `Urgente: ${empresa} no puede facturar con un CAI · Wake Parts`
        : `Tu CAI está por ${avisos.every((a) => a.aviso.startsWith("rango")) ? "acabarse" : "vencer"} · ${empresa}`;
      const texto = [
        `Hola. Esto es lo que vemos en los CAI de ${empresa}:`,
        "",
        avisos.map((a) => `• ${a.titulo}\n  ${a.cuerpo ?? ""}`).join("\n\n"),
        "",
        "El SAR tarda unos días en autorizar un CAI nuevo: pedilo con tiempo. Cuando lo tengas, registralo en Ventas › CAI y este aviso se resuelve solo.",
        "",
        `Entrá a Wake Parts: ${URL_SITIO}/inicio`,
        "",
        "Si necesitás ayuda, respondé este correo o escribinos por WhatsApp.",
      ].join("\n");

      let enviado = false;
      for (const correo of para) {
        const r = await enviarCorreo({ para: correo, asunto, texto });
        if (r.ok) enviado = true;
      }
      if (!enviado) continue;
      correos++;
      await db
        .from("cai_avisos")
        .update({ correo_enviado_en: new Date().toISOString() })
        .in(
          "id",
          avisos.map((a) => a.id),
        );
      await registrar({
        tipo: "accion",
        evento: "cai.aviso_enviado",
        mensaje: asunto,
        id_empresa: idEmpresa,
        datos: { avisos: avisos.map((a) => a.aviso), destinatarios: para.length },
      });
    }
    return { nuevos: Number(nuevos ?? 0), correos };
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : String(e);
    await registrar({ tipo: "error", nivel: "error", evento: "cai.avisos_error", mensaje: mensaje.slice(0, 500) });
    return { nuevos: 0, correos: 0, error: mensaje };
  }
}
