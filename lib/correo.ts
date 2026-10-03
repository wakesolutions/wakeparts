import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * Envío de correos por SMTP (Zoho Mail, variables SMTP_* de .env.local).
 * Solo servidor: la contraseña nunca llega al navegador. Un único transporte
 * reutilizado (pool) para no abrir una conexión por correo.
 */

let transporte: Transporter | null = null;

export function correoConfigurado() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);
}

function obtenerTransporte() {
  if (transporte) return transporte;
  const puerto = Number(process.env.SMTP_PORT ?? 587);
  const seguro = process.env.SMTP_SECURE === "true";
  transporte = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: puerto,
    // 465 = TLS directo; 587 = STARTTLS obligatorio (nunca en texto plano).
    secure: seguro,
    requireTLS: !seguro,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    pool: true,
    maxConnections: 2,
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return transporte;
}

const escapar = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Texto plano → HTML sobrio (párrafos y saltos), con el pie de Wake Parts. */
function comoHtml(texto: string) {
  const parrafos = texto
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px">${escapar(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  return `<!doctype html><html lang="es"><body style="margin:0;padding:24px;background:#efebe4">
<div style="max-width:560px;margin:0 auto;padding:28px 28px 20px;background:#faf8f4;border-radius:12px;border:1px solid #ddd5c8;font:15px/1.6 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1d1a18">
${parrafos}
<p style="margin:22px 0 0;padding-top:14px;border-top:1px solid #e4ddd2;font-size:12px;color:#7a716a">Wake Parts · Inventario y facturación para repuestos y yonkers en Honduras</p>
</div></body></html>`;
}

export type ResultadoCorreo = { ok: true; id: string } | { ok: false; error: string };

export async function enviarCorreo(c: { para: string; asunto: string; texto: string; responderA?: string }): Promise<ResultadoCorreo> {
  if (!correoConfigurado()) return { ok: false, error: "El correo no está configurado en el servidor (SMTP_*)." };
  const remitente = process.env.SMTP_FROM ?? process.env.SMTP_USER!;
  try {
    const info = await obtenerTransporte().sendMail({
      from: { name: process.env.SMTP_FROM_NAME ?? "Wake Parts", address: remitente },
      to: c.para,
      replyTo: c.responderA,
      subject: c.asunto,
      text: c.texto,
      html: comoHtml(c.texto),
    });
    return { ok: true, id: String(info.messageId ?? "") };
  } catch (e) {
    console.error("[enviarCorreo]", e);
    const codigo = (e as { code?: string }).code;
    if (codigo === "EAUTH") return { ok: false, error: "El servidor de correo rechazó el usuario o la contraseña." };
    if (codigo === "ECONNECTION" || codigo === "ETIMEDOUT" || codigo === "ESOCKET") {
      return { ok: false, error: "No se pudo conectar con el servidor de correo. Intentá de nuevo." };
    }
    return { ok: false, error: "No se pudo enviar el correo." };
  }
}

/** Prueba la conexión y el usuario sin enviar nada. */
export async function verificarCorreo(): Promise<boolean> {
  if (!correoConfigurado()) return false;
  try {
    return await obtenerTransporte().verify();
  } catch (e) {
    console.error("[verificarCorreo]", e);
    return false;
  }
}
