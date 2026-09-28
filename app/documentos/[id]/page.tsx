import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { leerDocumento } from "@/app/acciones/ventas";
import { DocumentoVista } from "@/components/ventas/documento-vista";
import { BarraImpresion } from "./barra-impresion";

export const metadata: Metadata = { title: "Documento · Wake Parts" };

/** Vista imprimible de una cotización o factura (RLS: solo miembros de la empresa). */
export default async function PaginaDocumento(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const doc = await leerDocumento(id);
  if (!doc) notFound();
  return (
    <main className="min-h-dvh px-3 py-6 sm:px-8 print:p-0">
      <BarraImpresion titulo={`${doc.tipo === "factura" ? "Factura" : "Cotización"} ${doc.numero}`} />
      <DocumentoVista doc={doc} />
    </main>
  );
}
