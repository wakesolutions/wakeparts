"use client";

import { useSyncExternalStore } from "react";
import { BarraImpresion } from "@/app/documentos/[id]/barra-impresion";
import { DocumentoVista } from "@/components/ventas/documento-vista";
import type { Documento } from "@/lib/ventas";

function leer(): string | null {
  const id = new URLSearchParams(location.search).get("id");
  if (!id) return null;
  try {
    return localStorage.getItem(`wp:demo:doc:${id}`);
  } catch {
    return null;
  }
}

export function DocumentoDemo() {
  const crudo = useSyncExternalStore(
    () => () => {},
    leer,
    () => null,
  );
  const doc = crudo ? (JSON.parse(crudo) as Documento) : null;
  return (
    <main className="min-h-dvh px-3 py-6 sm:px-8 print:p-0">
      {doc ? (
        <>
          <BarraImpresion titulo={`${doc.tipo === "factura" ? "Factura" : "Cotización"} ${doc.numero}`} />
          <DocumentoVista doc={doc} />
        </>
      ) : (
        <p className="p-10 text-center text-wp-ink-3">Emití un documento en el sandbox para verlo aquí.</p>
      )}
    </main>
  );
}
