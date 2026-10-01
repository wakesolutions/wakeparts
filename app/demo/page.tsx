import type { Metadata } from "next";
import { URL_SITIO } from "@/lib/sitio";
import { DemoPublica } from "./demo-publica";

export const metadata: Metadata = {
  title: "Demo sin cuenta",
  description:
    "Probá Wake Parts sin registrarte: cotizá, facturá con CAI, mirá el inventario por vehículo y el catálogo web de un yonker de ejemplo.",
  alternates: { canonical: `${URL_SITIO}/demo` },
};

function saludo() {
  const hora = Number(
    new Intl.DateTimeFormat("es-HN", { hour: "numeric", hour12: false, timeZone: "America/Tegucigalpa" }).format(new Date()),
  );
  if (hora < 12) return "Buenos días";
  if (hora < 19) return "Buenas tardes";
  return "Buenas noches";
}

/**
 * Demo pública: el escritorio completo con un yonker de ejemplo, sin cuenta.
 * Todo vive en el navegador del visitante (components/demo/datos-demo.ts):
 * nada se guarda ni toca la base.
 */
export default function PaginaDemo() {
  return <DemoPublica saludo={saludo()} />;
}
