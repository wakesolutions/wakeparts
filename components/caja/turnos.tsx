"use client";

import { useEffect, useState } from "react";
import { useApi } from "@/components/datos/apis";
import { useIdentidad } from "@/components/identidad/contexto";
import { MantenimientoRecurso } from "@/components/mantenimiento/mantenimiento-recurso";
import ui from "@/components/ui/controles.module.css";
import { IconoImprimir } from "@/components/ui/iconos";
import { useVentanaActual } from "@/components/ventanas/ventana";
import { VentanaFlotante } from "@/components/ventanas/ventana-flotante";
import type { Turno } from "@/lib/caja";
import { CorteVista } from "./corte-vista";
import styles from "./caja.module.css";

const conImprimir = (url: string) => `${url}${url.includes("?") ? "&" : "?"}imprimir`;

/** Caja › Turnos: todos los turnos (abiertos y cerrados). Abrir uno muestra su corte. */
export function Turnos() {
  const madre = useVentanaActual() ?? undefined;
  const [abierto, setAbierto] = useState<{ id: string; numero: string } | null>(null);
  return (
    <>
      <MantenimientoRecurso recurso="cajas_turnos" puedeEditar={false} onAbrir={(f) => setAbierto({ id: String(f.id), numero: String(f.numero) })} />
      {abierto && (
        <VentanaFlotante
          id="corte"
          titulo={`Turno ${abierto.numero}`}
          padre={madre}
          tamano={{ w: 880, h: 760 }}
          foco={abierto.id}
          onCerrar={() => setAbierto(null)}
        >
          <CorteTurno key={abierto.id} id={abierto.id} />
        </VentanaFlotante>
      )}
    </>
  );
}

/** Corte de un turno en pantalla, con botón para imprimirlo. */
export function CorteTurno({ id }: { id: string }) {
  const api = useApi("caja");
  const { identidad } = useIdentidad();
  const [turno, setTurno] = useState<Turno | null | undefined>(undefined);

  useEffect(() => {
    let vivo = true;
    api
      .turno(id)
      .then((t) => vivo && setTurno(t))
      .catch(() => vivo && setTurno(null));
    return () => {
      vivo = false;
    };
  }, [api, id]);

  if (turno === undefined) return <div className={styles.cargando} style={{ margin: "1.2rem" }} aria-label="Cargando" />;
  if (turno === null) return <p className={styles.vacio}>No se encontró el turno.</p>;
  return (
    <div className={styles.corteVentana}>
      <div className={styles.botones} style={{ justifyContent: "flex-start" }}>
        <a className={`${ui.boton} ${ui.primario}`} href={conImprimir(api.urlCorte(id))} target="_blank" rel="noopener">
          <IconoImprimir tamano={14} /> Imprimir corte
        </a>
      </div>
      <CorteVista turno={turno} identidad={identidad} />
    </div>
  );
}
