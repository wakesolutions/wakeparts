import type { MetadataRoute } from "next";
import { DESCRIPCION_SITIO, NOMBRE_SITIO } from "@/lib/sitio";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${NOMBRE_SITIO} · Repuestos y yonkers`,
    short_name: NOMBRE_SITIO,
    description: DESCRIPCION_SITIO,
    lang: "es-HN",
    dir: "ltr",
    id: "/inicio",
    start_url: "/inicio",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#121010",
    theme_color: "#121010",
    categories: ["business", "productivity", "finance"],
    // Acceso directo al mantener presionado el ícono en el teléfono.
    shortcuts: [
      {
        name: "Toma rápida de productos",
        short_name: "Toma rápida",
        description: "Foto y datos mínimos de una pieza, una tras otra.",
        url: "/inicio?abrir=toma",
        icons: [{ src: "/icono-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
    icons: [
      { src: "/icono-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icono-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icono-mascara-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
