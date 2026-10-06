"use client";

import { useState } from "react";
import { DiarioDia, ListaAsientos } from "@/components/contabilidad/diario";
import { NuevoAsiento } from "@/components/contabilidad/nuevo-asiento";
import { Balanza, CierreMes, LibroMayor } from "@/components/contabilidad/reportes";
import inv from "@/components/inventario/inventario.module.css";
import { useSesion } from "../sesion-contexto";
import { ModuloTablas } from "./tablas";

/**
 * Contabilidad (dueño/admin, 0022): el libro diario (los asientos de ventas,
 * compras, cobros, pagos y caja se hacen solos), asientos manuales, balanza,
 * mayor, catálogo y cierre de mes.
 */
export function ModuloContabilidad() {
  const { rol } = useSesion();
  return (
    <ModuloTablas
      id="contabilidad"
      inicial="dia"
      secciones={[
        {
          titulo: "Diario",
          items: [
            {
              id: "dia",
              titulo: "Libro del día",
              descripcion: "Los asientos de una fecha y si cuadran. Ventas, compras, cobros, pagos y caja se asientan solos.",
              contenido: () => <DiarioDia />,
            },
            {
              id: "nuevo-asiento",
              titulo: "Nuevo asiento",
              descripcion: "Lo que no pasa por el sistema: sueldos, depreciación, aportes, préstamos, ajustes. Solo se guarda si cuadra.",
              contenido: () => <AsientoManual />,
            },
            {
              recurso: "asientos",
              descripcion: "Todos los asientos para buscar y filtrar. Abrí uno para verlo o revertirlo (si es manual).",
              contenido: () => <ListaAsientos />,
            },
          ],
        },
        {
          titulo: "Reportes",
          items: [
            {
              id: "balanza",
              titulo: "Balanza",
              descripcion: "Balanza de comprobación por período, estado de resultados y balance general.",
              contenido: () => <Balanza />,
            },
            {
              id: "mayor",
              titulo: "Libro mayor",
              descripcion: "Los movimientos de una cuenta con su saldo, día por día.",
              contenido: () => <LibroMayor />,
            },
          ],
        },
        {
          titulo: "Configuración",
          nota: "Reglas contables a revisar con tu contador.",
          items: [
            {
              recurso: "cuentas_contables",
              descripcion:
                "El catálogo de cuentas. «La usa el sistema para» dice qué cuenta toman los asientos automáticos; podés pasarla a otra.",
            },
            {
              id: "cierre",
              titulo: "Cierre de mes",
              descripcion: "Cerrá los meses ya revisados para que nadie asiente en ellos. Y el arranque de la contabilidad.",
              contenido: () => <CierreMes esDueno={rol === "dueno"} />,
            },
          ],
        },
      ]}
    />
  );
}

function AsientoManual() {
  const [guardado, setGuardado] = useState<number | null>(null);
  return (
    <>
      {guardado !== null && (
        <p className={inv.aviso} data-tono="ok" role="status" style={{ margin: "0.8rem 1.2rem 0" }}>
          Asiento {guardado} guardado. Lo ves en el Libro del día de su fecha.
        </p>
      )}
      <NuevoAsiento onGuardado={setGuardado} />
    </>
  );
}
