"use client";

import { useState } from "react";
import { useVentanaActual } from "@/components/ventanas/ventana";
import { VentanaFlotante } from "@/components/ventanas/ventana-flotante";
import { CompositorNota } from "@/components/ventas/compositor-nota";
import { ModuloTablas } from "./tablas";
import { DetalleDocumento, ListaDocumentos } from "./ventas";

/**
 * Notas de crédito y débito (dueño/admin): se emiten sobre una factura o sin
 * factura relacionada (0019), y se consultan, imprimen o anulan. Desde Ventas ›
 * Documentos se sigue pudiendo hacer una nota sobre la factura abierta.
 */
export function ModuloNotas() {
  return (
    <ModuloTablas
      id="notas"
      inicial="nueva-nota"
      secciones={[
        {
          titulo: "Notas",
          nota: "Usan el CAI de notas de crédito (06) o de débito (07) de tu punto de emisión.",
          items: [
            {
              id: "nueva-nota",
              titulo: "Nueva nota",
              descripcion:
                "Crédito o débito, sobre una factura o sin factura: gastos, fletes, intereses o rebajas que no salen de una venta.",
              contenido: () => <NuevaNota />,
            },
            {
              recurso: "notas",
              descripcion: "Todas las notas emitidas, con o sin factura. Abrí una para imprimirla o anularla.",
              contenido: () => <ListaDocumentos recurso="notas" />,
            },
          ],
        },
      ]}
    />
  );
}

/** El compositor; la nota recién emitida se abre en una ventana hija para imprimirla. */
function NuevaNota() {
  const [emitida, setEmitida] = useState<{ id: string; numero: string } | null>(null);
  const madre = useVentanaActual() ?? undefined;
  return (
    <>
      <CompositorNota onEmitida={(id, numero) => setEmitida({ id, numero })} />
      {emitida && (
        <VentanaFlotante
          id="documento"
          titulo={emitida.numero}
          padre={madre}
          tamano={{ w: 900, h: 760 }}
          foco={emitida.id}
          onCerrar={() => setEmitida(null)}
        >
          <DetalleDocumento
            key={emitida.id}
            id={emitida.id}
            onCambio={() => {}}
            onAbrir={(id, numero) => setEmitida({ id, numero })}
          />
        </VentanaFlotante>
      )}
    </>
  );
}
