import { notFound } from "next/navigation";
import { DocumentoDemo } from "@/components/demo/documento-demo";

/** Vista de impresión del sandbox: lee el documento demo guardado en el navegador. */
export default function PaginaDocumentoDemo() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <DocumentoDemo />;
}
