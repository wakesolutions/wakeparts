import type { Metadata } from "next";
import { DocumentoDemo } from "@/components/demo/documento-demo";

export const metadata: Metadata = { title: "Documento de la demo", robots: { index: false, follow: false } };

/** Impresión de un documento emitido en la demo: lo lee del navegador del visitante. */
export default function PaginaDocumentoDemo() {
  return <DocumentoDemo />;
}
