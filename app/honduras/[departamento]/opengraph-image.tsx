import { imagenOg, TAMANO_OG } from "../../_publico/imagen-og";
import { DEPARTAMENTOS, departamentoPorSlug } from "@/lib/sitio";

export const alt = "Wake Parts: inventario y facturación con CAI para repuestos por departamento de Honduras";
export const size = TAMANO_OG;
export const contentType = "image/png";

export function generateStaticParams() {
  return DEPARTAMENTOS.map((d) => ({ departamento: d.slug }));
}

export default async function Imagen({ params }: { params: Promise<{ departamento: string }> }) {
  const d = departamentoPorSlug((await params).departamento);
  return imagenOg({
    sobretitulo: d ? `${d.iso} · ${d.cabecera}` : "Honduras",
    titulo: d ? `Repuestos en ${d.nombre}` : "Repuestos en Honduras",
    pie: d ? d.ciudades.slice(0, 4).join(" · ") : "18 departamentos",
  });
}
