// Solo servidor (proxy, instrumentation, acciones). Sin "server-only" porque el
// proxy no se empaqueta con la condición react-server; la llave secreta se lee
// en tiempo de ejecución y nunca llega al cliente (no es NEXT_PUBLIC_).

/**
 * Registro de actividad (tabla `registros`, migración 0011): visitas, sesiones,
 * errores y acciones. Se escribe con la llave secreta directo a PostgREST, así
 * funciona en el proxy, en instrumentation y sin sesión. NUNCA lanza: si falla
 * (o falta la tabla), solo deja un aviso en la consola del servidor.
 * Los cambios de datos los registra la base sola (trigger `registrar_cambio`).
 */

export type TipoRegistro = "visita" | "sesion" | "error" | "cambio" | "accion";
export type NivelRegistro = "info" | "aviso" | "error";

export type ContextoCliente = {
  ip: string | null;
  agente: string | null;
  dispositivo: string | null;
  pais: string | null;
  ciudad: string | null;
  referente: string | null;
};

export type EventoRegistro = {
  tipo: TipoRegistro;
  evento: string;
  nivel?: NivelRegistro;
  mensaje?: string | null;
  id_usuario?: string | null;
  correo?: string | null;
  id_empresa?: string | null;
  ruta?: string | null;
  metodo?: string | null;
  datos?: Record<string, unknown> | null;
  contexto?: Partial<ContextoCliente>;
};

type FuenteHeaders = Headers | Record<string, string | string[] | undefined>;

function leer(h: FuenteHeaders, nombre: string): string | null {
  if (h instanceof Headers) return h.get(nombre);
  const v = h[nombre] ?? h[nombre.toLowerCase()];
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

/** IP del visitante: primera de x-forwarded-for (Vercel/proxy) o x-real-ip. */
export function ipDe(h: FuenteHeaders): string | null {
  const reenviada = leer(h, "x-forwarded-for")?.split(",")[0]?.trim();
  const ip = reenviada || leer(h, "x-real-ip")?.trim() || null;
  // «::ffff:1.2.3.4» → «1.2.3.4»
  return ip ? ip.replace(/^::ffff:/, "") : null;
}

const BOTS = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|preview|lighthouse|headless|curl|wget|python|axios|node-fetch/i;

/** «Celular · Android 14 · Chrome 140», «Computadora · Windows · Edge 140», «Bot · Googlebot». */
export function describirDispositivo(agente: string | null): string | null {
  if (!agente) return null;
  if (BOTS.test(agente)) {
    const nombre = agente.match(/([\w-]*(?:bot|crawler|spider)[\w-]*)/i)?.[1] ?? agente.split(/[\s/]/)[0];
    return `Bot · ${nombre}`.slice(0, 200);
  }
  const tipo = /iPad|Tablet/i.test(agente) || (/Android/i.test(agente) && !/Mobile/i.test(agente))
    ? "Tablet"
    : /Mobi|iPhone|Android/i.test(agente)
      ? "Celular"
      : "Computadora";

  let so = "Otro";
  const android = agente.match(/Android (\d+)/);
  const ios = agente.match(/(?:iPhone|iPad|CPU) OS (\d+)/);
  if (android) so = `Android ${android[1]}`;
  else if (ios) so = `iOS ${ios[1]}`;
  else if (/Windows/i.test(agente)) so = "Windows";
  else if (/Mac OS X|Macintosh/i.test(agente)) so = "macOS";
  else if (/CrOS/i.test(agente)) so = "ChromeOS";
  else if (/Linux/i.test(agente)) so = "Linux";

  const navegadores: [RegExp, string][] = [
    [/Edg(?:e|A|iOS)?\/(\d+)/, "Edge"],
    [/OPR\/(\d+)/, "Opera"],
    [/SamsungBrowser\/(\d+)/, "Samsung Internet"],
    [/Firefox\/(\d+)|FxiOS\/(\d+)/, "Firefox"],
    [/CriOS\/(\d+)|Chrome\/(\d+)/, "Chrome"],
    [/Version\/(\d+).*Safari/, "Safari"],
  ];
  let navegador = "Otro navegador";
  for (const [re, nombre] of navegadores) {
    const m = agente.match(re);
    if (m) {
      navegador = `${nombre} ${m[1] ?? m[2] ?? ""}`.trim();
      break;
    }
  }
  return `${tipo} · ${so} · ${navegador}`;
}

function decodificar(v: string | null) {
  if (!v) return null;
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

/** IP, dispositivo y ubicación aproximada (Vercel la da por headers) de una solicitud. */
export function contextoDe(h: FuenteHeaders): ContextoCliente {
  const agente = leer(h, "user-agent");
  return {
    ip: ipDe(h),
    agente,
    dispositivo: describirDispositivo(agente),
    pais: leer(h, "x-vercel-ip-country"),
    ciudad: decodificar(leer(h, "x-vercel-ip-city")),
    referente: leer(h, "referer"),
  };
}

/**
 * Usuario de la cookie de sesión de Supabase, sin verificar la firma.
 * SOLO para etiquetar registros (p. ej. en onRequestError); nunca para autorizar.
 */
export function usuarioDeCookies(cookie: string | null | undefined): { id: string; correo: string | null } | null {
  if (!cookie) return null;
  try {
    const partes = cookie
      .split(/;\s*/)
      .map((c) => {
        const i = c.indexOf("=");
        return [c.slice(0, i), c.slice(i + 1)] as const;
      })
      .filter(([n]) => /^sb-.+-auth-token(\.\d+)?$/.test(n))
      .sort(([a], [b]) => a.localeCompare(b, "en", { numeric: true }));
    if (!partes.length) return null;
    let valor = decodeURIComponent(partes.map(([, v]) => v).join(""));
    if (valor.startsWith("base64-")) valor = Buffer.from(valor.slice(7), "base64url").toString("utf8");
    const token = JSON.parse(valor)?.access_token as string | undefined;
    const carga = token ? JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")) : null;
    return carga?.sub ? { id: carga.sub, correo: carga.email ?? null } : null;
  } catch {
    return null;
  }
}

const recortar = (v: string | null | undefined, max: number) => (v ? v.slice(0, max) : null);

/** Guarda un evento. Esperalo (o pasalo a waitUntil/after): no lanza. */
export async function registrar(e: EventoRegistro): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const llave = process.env.SUPABASE_SECRET_KEY;
  if (!url || !llave || process.env.REGISTRO_DESACTIVADO === "1") return;

  const c = e.contexto ?? {};
  const fila = {
    tipo: e.tipo,
    nivel: e.nivel ?? (e.tipo === "error" ? "error" : "info"),
    evento: recortar(e.evento, 120),
    mensaje: recortar(e.mensaje, 2000),
    id_usuario: e.id_usuario ?? null,
    correo: recortar(e.correo, 320),
    id_empresa: e.id_empresa ?? null,
    ip: c.ip ?? null,
    agente: recortar(c.agente, 500),
    dispositivo: recortar(c.dispositivo ?? describirDispositivo(c.agente ?? null), 200),
    pais: recortar(c.pais, 80),
    ciudad: recortar(c.ciudad, 120),
    referente: recortar(c.referente, 500),
    ruta: recortar(e.ruta, 500),
    metodo: recortar(e.metodo, 10),
    entorno: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? null,
    datos: e.datos ?? null,
  };

  try {
    const r = await fetch(`${url}/rest/v1/registros`, {
      method: "POST",
      headers: { apikey: llave, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(fila),
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) console.warn(`[registro] ${r.status} al guardar ${e.evento}: ${(await r.text()).slice(0, 200)}`);
  } catch (err) {
    console.warn(`[registro] no se pudo guardar ${e.evento}:`, err instanceof Error ? err.message : err);
  }
}

/** Mensaje y pila de cualquier valor lanzado. */
export function describirError(err: unknown) {
  if (err instanceof Error) {
    const digest = (err as Error & { digest?: string }).digest;
    return { mensaje: err.message || err.name, pila: err.stack?.slice(0, 4000) ?? null, digest: digest ?? null };
  }
  return { mensaje: String(err).slice(0, 2000), pila: null, digest: null };
}
