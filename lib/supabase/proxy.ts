import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Públicas: portada, manual, páginas por departamento y archivos de metadatos
// (robots, sitemap, manifest, imágenes para redes e íconos generados).
// /dev = sandbox de UI con sesión ficticia, solo en desarrollo.
const RUTAS_PUBLICAS = [
  "/",
  "/auth",
  "/ayuda",
  "/honduras",
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

/** Refresca la sesión de Supabase y hace las redirecciones optimistas. */
export async function updateSession(request: NextRequest) {
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
