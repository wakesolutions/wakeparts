"use client";

import { useState } from "react";
import { CompraVista, ListaCompras } from "@/components/compras/compra-vista";
import styles from "@/components/compras/compras.module.css";
import { NuevaCompra } from "@/components/compras/nueva-compra";
import { CuentasPorPagar, PagosProveedores } from "@/components/compras/por-pagar";
import ui from "@/components/ui/controles.module.css";
import { useVentanaActual } from "@/components/ventanas/ventana";
import { VentanaFlotante } from "@/components/ventanas/ventana-flotante";
import { ModuloTablas } from "./tablas";

/**
 * Compras (dueño/admin, 0021): registrar facturas de proveedores (productos o
 * gastos), proveedores, lo que se les debe y los pagos.
 */
export function ModuloCompras() {
  return (
    <ModuloTablas
      id="compras"
      inicial="nueva-compra"
      secciones={[
        {
          titulo: "Compras",
          items: [
            {
              id: "nueva-compra",
              titulo: "Nueva compra",
              descripcion:
                "La factura del proveedor tal como llegó: productos (suben existencias y costo) o gastos. De contado o al crédito.",
              contenido: () => <Recepcion />,
            },
            {
              recurso: "compras",
              descripcion: "Todas las compras registradas. Abrí una para ver sus líneas y pagos, o anularla.",
              contenido: () => <ListaCompras />,
            },
            {
              recurso: "proveedores",
              descripcion: "A quién le comprás. Con RTN para el libro de compras; el plazo es el crédito que te dan.",
            },
          ],
        },
        {
          titulo: "Por pagar",
          items: [
            {
              recurso: "cuentas_proveedores",
              descripcion: "Lo que le debés a cada proveedor y qué está vencido. Abrí uno para registrar un pago.",
              contenido: () => <CuentasPorPagar />,
            },
            {
              recurso: "pagos_proveedores",
              descripcion: "Pagos hechos a proveedores. Abrí uno para verlo o anularlo.",
              contenido: () => <PagosProveedores />,
            },
          ],
        },
      ]}
    />
  );
}

/** Nueva compra; al registrarla aparece el sello «Recibido» y se puede abrir. */
function Recepcion() {
  const [recibida, setRecibida] = useState<{ id: string; numero: string } | null>(null);
  const [abierta, setAbierta] = useState<{ id: string; numero: string } | null>(null);
  const [vuelta, setVuelta] = useState(0);
  const madre = useVentanaActual() ?? undefined;

  return (
    <>
      {recibida ? (
        <div className={styles.recibida} role="status">
          <div className={styles.sello}>
            <span>Recibido</span>
            <strong>{recibida.numero}</strong>
          </div>
          <p className={styles.ayuda}>Quedó registrada. Si fue al crédito, la pagás desde la compra o en Por pagar › Cuentas por pagar.</p>
          <div className={styles.botones}>
            <button type="button" className={`${ui.boton} ${ui.fantasma}`} onClick={() => setAbierta(recibida)}>
              Ver la compra · registrar pago
            </button>
            <button
              type="button"
              className={`${ui.boton} ${ui.primario}`}
              autoFocus
              onClick={() => {
                setRecibida(null);
                setVuelta((v) => v + 1);
              }}
            >
              Registrar otra
            </button>
          </div>
        </div>
      ) : (
        <NuevaCompra key={vuelta} onRegistrada={(id, numero) => setRecibida({ id, numero })} />
      )}
      {abierta && (
        <VentanaFlotante
          id="compra"
          titulo={abierta.numero}
          padre={madre}
          tamano={{ w: 880, h: 720 }}
          foco={abierta.id}
          onCerrar={() => setAbierta(null)}
        >
          <CompraVista key={abierta.id} id={abierta.id} />
        </VentanaFlotante>
      )}
    </>
  );
}
