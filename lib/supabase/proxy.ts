import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { contextoDe, registrar } from "@/lib/registro";

// Públicas: portada, manual, páginas por departamento y archivos de metadatos
// (robots, sitemap, manifest, imágenes para redes e íconos generados).
// /dev = sandbox de UI con sesión ficticia, solo en desarrollo.
const RUTAS_PUBLICAS = [
  "/",
  "/auth",
  "/ayuda",
  "/honduras",
  "/cookies",
  "/privacidad",
  "/terminos",
  "/api/registro",
  "/robots.txt",
  "/sitemap.xml",
  "/manifest.webmanifest",
  "/opengraph-image",
  "/twitter-image",
  "/icon",
  "/apple-icon",
  ...(process.env.NODE_ENV === "development" ? ["/dev"] : []),
];

function esPublica(pathname: string) {
  return RUTAS_PUBLICAS.some((ruta) =>
    ruta === "/" ? pathname === "/" : pathname.startsWith(ruta),
  );
}

/**
 * ¿Es una página que alguien abrió? Carga completa (documento) o navegación
 * dentro de la app (RSC). Los prefetch del router y las Server Actions no cuentan.
 */
function esVisita(request: NextRequest) {
  const h = request.headers;
  if (request.method !== "GET") return false;
  if (h.has("next-router-prefetch") || /prefetch/i.test(h.get("purpose") ?? h.get("sec-purpose") ?? "")) return false;
  if (h.get("rsc") === "1") return true;
  const destino = h.get("sec-fetch-dest");
  if (destino) return destino === "document";
  // Bots y clientes sin sec-fetch-*: si pide HTML.
  return (h.get("accept") ?? "").includes("text/html");
}

/** Refresca la sesión de Supabase, registra la visita y hace las redirecciones optimistas. */
export async function updateSession(request: NextRequest, event?: NextFetchEvent) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([key, value]) =>
            response.headers.set(key, value),
          );
        },
      },
    },
  );

  // No meter código entre createServerClient y getClaims: refresca el token.
  const { data } = await supabase.auth.getClaims();
  const autenticado = Boolean(data?.claims);
  const { pathname } = request.nextUrl;

  if (event && esVisita(request)) {
    const claims = data?.claims as { sub?: string; email?: string } | undefined;
    event.waitUntil(
      registrar({
        tipo: "visita",
        evento: "pagina.vista",
        mensaje: pathname,
        id_usuario: claims?.sub ?? null,
        correo: claims?.email ?? null,
        ruta: `${pathname}${request.nextUrl.search}`.slice(0, 500),
        metodo: "GET",
        datos: { navegacion: request.headers.get("rsc") === "1" ? "dentro de la app" : "carga completa" },
        contexto: contextoDe(request.headers),
      }),
    );
  }

  const redirigir = (destino: string) => {
    const url = request.nextUrl.clone();
    url.pathname = destino;
    url.search = "";
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  };

  if (!autenticado && !esPublica(pathname)) return redirigir("/");
  if (autenticado && pathname === "/") return redirigir("/inicio");

  return response;
}
