"use client";

import { useSyncExternalStore } from "react";
import { BarraImpresion } from "@/app/documentos/[id]/barra-impresion";
import { ReciboVista } from "@/components/cobros/recibo-vista";
import { DocumentoVista } from "@/components/ventas/documento-vista";
import type { Recibo } from "@/lib/cobros";
import { NOMBRE_DOCUMENTO, type Documento } from "@/lib/ventas";

function leer(): string | null {
  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  const recibo = params.get("recibo");
  try {
    if (recibo) return localStorage.getItem(`wp:demo:rec:${recibo}`);
    return id ? localStorage.getItem(`wp:demo:doc:${id}`) : null;
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
  const dato = crudo ? (JSON.parse(crudo) as Documento | Recibo) : null;
  const recibo = dato && "forma_pago" in dato ? dato : null;
  const doc = dato && !recibo ? (dato as Documento) : null;
  return (
    <main className="min-h-dvh px-3 py-6 sm:px-8 print:p-0">
      {recibo ? (
        <>
          <BarraImpresion titulo={`Recibo ${recibo.numero}`} />
          <ReciboVista recibo={recibo} />
        </>
      ) : doc ? (
        <>
          <BarraImpresion titulo={`${NOMBRE_DOCUMENTO[doc.tipo]} ${doc.numero}`} />
          <DocumentoVista doc={doc} />
        </>
      ) : (
        <p className="p-10 text-center text-wp-ink-3">Emití un documento en el sandbox para verlo aquí.</p>
      )}
    </main>
  );
}
