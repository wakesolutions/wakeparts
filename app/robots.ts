import type { MetadataRoute } from "next";
import { URL_SITIO } from "@/lib/sitio";

/** Público: portada, manual y páginas por departamento. Lo demás requiere sesión y no se indexa. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/ayuda", "/honduras", "/cookies", "/privacidad", "/terminos"],
        disallow: ["/inicio", "/bienvenida", "/documentos/", "/auth/", "/dev/", "/api/"],
      },
    ],
    sitemap: `${URL_SITIO}/sitemap.xml`,
    host: URL_SITIO,
  };
}
