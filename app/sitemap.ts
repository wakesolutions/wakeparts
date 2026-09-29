import type { MetadataRoute } from "next";
import { DEPARTAMENTOS, URL_SITIO } from "@/lib/sitio";

export default function sitemap(): MetadataRoute.Sitemap {
  const hoy = new Date();
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
  ];
}
