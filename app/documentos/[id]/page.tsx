import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { leerDocumento } from "@/app/acciones/ventas";
import { DocumentoVista } from "@/components/ventas/documento-vista";
import { NOMBRE_DOCUMENTO } from "@/lib/ventas";
import { identidadDeFila } from "@/lib/identidad";
import { createClient } from "@/lib/supabase/server";
import { BarraImpresion } from "./barra-impresion";

export const metadata: Metadata = { title: "Documento", robots: { index: false, follow: false } };

/** Vista imprimible de una cotización, factura o nota (RLS: solo miembros de la empresa). */
export default async function PaginaDocumento(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const doc = await leerDocumento(id);
  if (!doc) notFound();

  // Logo, color y formato de la empresa que emitió el documento (0012).
  const supabase = await createClient();
  const { data } = await supabase.from("documentos").select("empresas(*)").eq("id", id).maybeSingle();
  const identidad = identidadDeFila((data as { empresas?: Record<string, unknown> | null } | null)?.empresas);

  return (
    <main className="min-h-dvh px-3 py-6 sm:px-8 print:p-0">
      <BarraImpresion titulo={`${NOMBRE_DOCUMENTO[doc.tipo]} ${doc.numero}`} />
      <DocumentoVista doc={doc} identidad={identidad} />
    </main>
  );
}
