import type { MetadataRoute } from "next";
import { URL_SITIO } from "@/lib/sitio";

/** Público: portada, manual, páginas por departamento y sitios de los talleres. Lo demás requiere sesión y no se indexa. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/ayuda", "/honduras", "/t/", "/demo", "/cookies", "/privacidad", "/terminos"],
        disallow: ["/inicio", "/bienvenida", "/documentos/", "/recibos/", "/cortes/", "/auth/", "/dev/", "/api/", "/t/*/carrito"],
      },
    ],
    sitemap: `${URL_SITIO}/sitemap.xml`,
    host: URL_SITIO,
  };
}
