import type { MetadataRoute } from "next";
import { DEPARTAMENTOS, URL_SITIO } from "@/lib/sitio";
import { sitiosPublicados } from "@/lib/sitio-datos";
import { LEGAL_ACTUALIZADO, PAGINAS_LEGALES } from "./_publico/legal";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const hoy = new Date();
  // Sitios publicados de los talleres (0013). Sin la migración, la lista queda vacía.
  const talleres = await sitiosPublicados().catch(() => []);
  return [
    { url: `${URL_SITIO}/`, lastModified: hoy, changeFrequency: "weekly", priority: 1 },
    { url: `${URL_SITIO}/honduras`, lastModified: hoy, changeFrequency: "monthly", priority: 0.8 },
    ...DEPARTAMENTOS.map((d) => ({
      url: `${URL_SITIO}/honduras/${d.slug}`,
      lastModified: hoy,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    { url: `${URL_SITIO}/ayuda`, lastModified: hoy, changeFrequency: "monthly", priority: 0.6 },
    ...talleres.flatMap((t) =>
      ["", "/catalogo", "/nosotros"].map((sub) => ({
        url: `${URL_SITIO}/t/${t.slug}${sub}`,
        lastModified: hoy,
        changeFrequency: "weekly" as const,
        priority: sub ? 0.5 : 0.6,
      })),
    ),
    ...PAGINAS_LEGALES.map((p) => ({
      url: `${URL_SITIO}${p.ruta}`,
      lastModified: new Date(LEGAL_ACTUALIZADO),
      changeFrequency: "yearly" as const,
      priority: 0.2,
    })),
  ];
}
