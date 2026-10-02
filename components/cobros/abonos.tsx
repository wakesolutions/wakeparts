"use client";

import { useEffect, useState } from "react";
import { useApi } from "@/components/datos/apis";
import { useIdentidad } from "@/components/identidad/contexto";
import { MantenimientoRecurso } from "@/components/mantenimiento/mantenimiento-recurso";
import ui from "@/components/ui/controles.module.css";
import { IconoImprimir } from "@/components/ui/iconos";
import { useVentanaActual } from "@/components/ventanas/ventana";
import { VentanaFlotante } from "@/components/ventanas/ventana-flotante";
import type { Recibo } from "@/lib/cobros";
import { ReciboVista } from "./recibo-vista";
import styles from "./cobros.module.css";

const conImprimir = (url: string) => `${url}${url.includes("?") ? "&" : "?"}imprimir`;

/** Ventas › Abonos: los recibos emitidos. Abrir uno lo muestra para imprimir o anular (dueño/admin). */
export function Abonos({ administra }: { administra: boolean }) {
  const [abierto, setAbierto] = useState<{ id: string; numero: string } | null>(null);
  const [version, setVersion] = useState(0);
  const madre = useVentanaActual() ?? undefined;
  return (
    <>
      <MantenimientoRecurso
        recurso="pagos"
        puedeEditar={false}
        version={version}
        onAbrir={(f) => setAbierto({ id: String(f.id), numero: String(f.numero) })}
      />
      {abierto && (
        <VentanaFlotante
          id="recibo"
          titulo={abierto.numero}
          padre={madre}
          tamano={{ w: 860, h: 720 }}
          foco={abierto.id}
          onCerrar={() => setAbierto(null)}
        >
          <DetalleRecibo key={abierto.id} id={abierto.id} administra={administra} onCambio={() => setVersion((v) => v + 1)} />
        </VentanaFlotante>
      )}
    </>
  );
}

function DetalleRecibo({ id, administra, onCambio }: { id: string; administra: boolean; onCambio: () => void }) {
  const api = useApi("cobros");
  const { identidad } = useIdentidad();
  const [recibo, setRecibo] = useState<Recibo | null | undefined>(undefined);
  const [anulando, setAnulando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    api
      .recibo(id)
      .then((r) => vivo && setRecibo(r))
      .catch(() => vivo && setRecibo(null));
    return () => {
      vivo = false;
    };
  }, [api, id]);

  async function anular() {
    const r = await api.anularAbono(id, motivo);
    if (!r.ok) return setAviso(r.error);
    setAnulando(false);
    setRecibo(await api.recibo(id));
    onCambio();
  }

  if (recibo === undefined) return <div className={styles.cargandoVentana} aria-label="Cargando" />;
  if (recibo === null) return <p className={styles.vacio}>No se encontró el recibo.</p>;

  return (
    <div className={styles.recibo}>
      <div className={styles.reciboBarra}>
        <a className={`${ui.boton} ${ui.primario}`} href={conImprimir(api.urlRecibo(id))} target="_blank" rel="noopener">
          <IconoImprimir tamano={14} /> Imprimir
        </a>
        {administra && recibo.estado === "emitido" && !anulando && (
          <button type="button" className={`${ui.boton} ${ui.fantasma} ${ui.peligro}`} onClick={() => setAnulando(true)}>
            Anular
          </button>
        )}
      </div>
      {anulando && (
        <form
          className={styles.anular}
          onSubmit={(e) => {
            e.preventDefault();
            void anular();
          }}
        >
          <input
            className={ui.campo}
            placeholder="Motivo de la anulación"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            autoFocus
            aria-label="Motivo de la anulación"
          />
          <button type="button" className={`${ui.boton} ${ui.fantasma}`} onClick={() => setAnulando(false)}>
            Cancelar
          </button>
          <button type="submit" className={`${ui.boton} ${ui.peligro}`} disabled={!motivo.trim()}>
            Sí, anular: la deuda vuelve
          </button>
        </form>
      )}
      {aviso && <p className={styles.error}>{aviso}</p>}
      <ReciboVista recibo={recibo} identidad={identidad} />
    </div>
  );
}
