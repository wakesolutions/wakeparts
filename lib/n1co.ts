import "server-only";

/**
 * Cliente de la API de n1co Business (suscripciones con tarjeta). Solo servidor.
 * Docs: https://docs.n1co.com/docs/integration-api/epay/paymentmethods
 *
 * Reglas de seguridad:
 * - Los datos de la tarjeta solo viajan a n1co para tokenizarlos: nunca se
 *   guardan, se registran ni se devuelven al navegador.
 * - Los errores de n1co se registran por código/estado, nunca con el cuerpo de
 *   la petición; al usuario le llega un mensaje propio.
 * - Toda petición tiene tiempo límite.
 */

export type ModoN1co = "sandbox" | "live";

export type SuscripcionN1co = {
  subscriptionId: number;
  planId?: number;
  name?: string;
  amount?: number;
  currencyCode?: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  subscriptionStatus?: string;
  customer?: { name?: string; email?: string; phone?: string };
};

export type RespuestaCrearSuscripcion = {
  status?: "SUCCEEDED" | "FAILED" | "AUTHENTICATION_REQUIRED" | string;
  message?: string;
  error?: { code?: string; message?: string; title?: string; detail?: string } | null;
  authentication?: { url?: string; id?: string } | null;
  subscription?: SuscripcionN1co | null;
  payment?: { chargeId?: string | null; authorizationCode?: string | null } | null;
};

export type TarjetaN1co = {
  numero: string;
  titular: string;
  mes: string;
  anio: string;
  cvv: string;
};

export type ClienteN1co = { id: string; name: string; email: string; phoneNumber: string };
export type FacturacionN1co = { countryCode: string; stateCode: string; zipCode: string };

/** Error de n1co sin datos sensibles: estado HTTP y código, para el registro. */
export class ErrorN1co extends Error {
  constructor(
    mensaje: string,
    readonly estado: number,
    readonly codigo: string | null,
  ) {
    super(mensaje);
    this.name = "ErrorN1co";
  }
}

const TIEMPO_LIMITE = 20_000;
let tokenEnCache: { valor: string; vence: number } | null = null;

export function modoN1co(): ModoN1co {
  return process.env.N1CO_MODE?.trim().toLowerCase() === "live" ? "live" : "sandbox";
}

function base() {
  return modoN1co() === "live" ? "https://api.n1co.com" : "https://api-sandbox.n1co.shop";
}

function credenciales() {
  const clientId = process.env.N1CO_CLIENT_ID?.trim();
  const clientSecret = process.env.N1CO_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function codigoUbicacion() {
  return process.env.N1CO_LOCATION_CODE?.trim() ?? "";
}

export function n1coConfigurado() {
  return credenciales() !== null && Boolean(codigoUbicacion());
}

/** Lee el código de error de un cuerpo JSON de n1co sin guardar el resto. */
async function codigoDeError(r: Response): Promise<string | null> {
  try {
    const cuerpo = (await r.json()) as { code?: string; error?: { code?: string }; title?: string };
    return cuerpo?.error?.code ?? cuerpo?.code ?? cuerpo?.title ?? null;
  } catch {
    return null;
  }
}

async function token() {
  const c = credenciales();
  if (!c) throw new ErrorN1co("n1co no está configurado.", 503, "SIN_CONFIGURAR");
  if (tokenEnCache && tokenEnCache.vence > Date.now() + 60_000) return tokenEnCache.valor;

  const r = await fetch(`${base()}/api/v3/Token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(c),
    cache: "no-store",
    signal: AbortSignal.timeout(TIEMPO_LIMITE),
  });
  if (!r.ok) throw new ErrorN1co("No se pudo autenticar con n1co.", r.status, await codigoDeError(r));
  const carga = (await r.json()) as { accessToken?: string; expiresIn?: number };
  if (!carga.accessToken) throw new ErrorN1co("n1co no devolvió el token.", 502, "SIN_TOKEN");
  tokenEnCache = { valor: carga.accessToken, vence: Date.now() + (carga.expiresIn ?? 3500) * 1000 };
  return carga.accessToken;
}

async function pedir<T>(ruta: string, init?: RequestInit, reintentar = true): Promise<T> {
  const r = await fetch(`${base()}${ruta}`, {
    ...init,
    headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
    signal: AbortSignal.timeout(TIEMPO_LIMITE),
  });
  // Token revocado o vencido antes de tiempo: uno nuevo y un solo reintento.
  if (r.status === 401 && reintentar) {
    tokenEnCache = null;
    return pedir<T>(ruta, init, false);
  }
  if (!r.ok) throw new ErrorN1co(`n1co respondió ${r.status}.`, r.status, await codigoDeError(r));
  if (r.status === 204) return null as T;
  return (await r.json()) as T;
}

export function obtenerSuscripcionN1co(id: string | number) {
  return pedir<SuscripcionN1co>(`/api/v3/Subscriptions/${encodeURIComponent(String(id))}`);
}

export function cancelarSuscripcionN1co(id: string | number, motivo: string) {
  return pedir<unknown>(`/api/v3/Subscriptions/${encodeURIComponent(String(id))}/cancel`, {
    method: "POST",
    body: JSON.stringify({ reason: motivo.slice(0, 280) }),
  });
}

/** Tokeniza la tarjeta en n1co. Devuelve solo el id del método y el país del BIN. */
export async function tokenizarTarjeta(cliente: ClienteN1co, t: TarjetaN1co) {
  const r = await pedir<{ id?: string; success?: boolean; message?: string; bin?: { countryCode?: string } }>(
    "/api/v3/PaymentMethods",
    {
      method: "POST",
      body: JSON.stringify({
        customer: cliente,
        card: {
          number: t.numero.replace(/\D/g, ""),
          cardHolder: t.titular,
          expirationMonth: t.mes.padStart(2, "0"),
          expirationYear: t.anio,
          cvv: t.cvv,
          singleUse: false,
        },
      }),
    },
  );
  if (!r?.success || !r.id) throw new ErrorN1co("La tarjeta no fue aceptada.", 402, "TARJETA_RECHAZADA");
  return { id: r.id, pais: r.bin?.countryCode ?? null };
}

export function crearSuscripcionN1co(e: {
  planId: number;
  cliente: ClienteN1co;
  metodoPago: string;
  autenticacion?: string | null;
  facturacion?: FacturacionN1co | null;
}) {
  return pedir<RespuestaCrearSuscripcion>("/api/v3/Subscriptions", {
    method: "POST",
    body: JSON.stringify({
      planId: e.planId,
      customer: e.cliente,
      paymentMethod: { id: e.metodoPago },
      authenticationId: e.autenticacion ?? null,
      locationCode: codigoUbicacion(),
      ...(e.facturacion ? { billingInfo: e.facturacion } : {}),
    }),
  });
}

/**
 * Estado de n1co → estado de `empresas_planes`. Estados documentados (ciclo de
 * vida de suscripciones): Inicio, Activa, Pendiente, Bloqueada, Inactiva, Error.
 * - Activa → activa · Pendiente (cobro recurrente fallido, reintentando) y
 *   Bloqueada (por el comercio) → vencida · Inactiva (cancelada, sin pago tras
 *   3 intentos o enlace inválido) → cancelada.
 * - Inicio, Error o cualquier otro → null: **no se toca nada** (un estado que no
 *   conocemos nunca debe cancelar el plan de un taller que pagó).
 */
export function estadoDesdeN1co(estado?: string): "activa" | "vencida" | "cancelada" | null {
  const s = (estado ?? "").trim().toLowerCase();
  if (s === "activa" || s === "active") return "activa";
  if (s === "pendiente" || s === "pending" || s === "bloqueada" || s === "blocked") return "vencida";
  if (["inactiva", "inactive", "cancelada", "cancelled", "canceled"].includes(s)) return "cancelada";
  return null;
}

export function fechaN1co(valor?: string | null) {
  if (!valor) return null;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Tarjetas de EE. UU. y Canadá piden dirección de facturación. */
export function pideFacturacion(pais?: string | null) {
  return ["US", "USA", "CA", "CAN"].includes((pais ?? "").trim().toUpperCase());
}
