"use client";

import { useEffect, useState } from "react";
import { useApi } from "@/components/datos/apis";
import { MantenimientoRecurso } from "@/components/mantenimiento/mantenimiento-recurso";
import { TableroReporte } from "@/components/reportes/tablero-reporte";
import ui from "@/components/ui/controles.module.css";
import { IconoCarrito, IconoImprimir } from "@/components/ui/iconos";
import { useVentanaActual } from "@/components/ventanas/ventana";
import { useVentanas } from "@/components/ventanas/contexto";
import { VentanaFlotante } from "@/components/ventanas/ventana-flotante";
import { DocumentoVista } from "@/components/ventas/documento-vista";
import { abrirCarritoEnMostrador } from "@/components/ventas/mostrador";
import type { Documento } from "@/lib/ventas";
import { useSesion } from "../sesion-contexto";
import { ModuloTablas } from "./tablas";
import styles from "./modulos.module.css";

/** Ventas: documentos emitidos, clientes, reporte de ventas y CAI. */
export function ModuloVentas() {
  return (
    <ModuloTablas
      id="ventas"
      inicial="documentos"
      secciones={[
        {
          titulo: "Ventas",
          items: [
            {
              recurso: "documentos",
              descripcion: "Cotizaciones y facturas emitidas. Abrí una para imprimirla, repetirla o anularla.",
              contenido: () => <Documentos />,
            },
            {
              recurso: "clientes",
              descripcion: "Clientes del taller. Con RTN salen en la factura; sin RTN, como consumidor final.",
            },
          ],
        },
        {
          titulo: "Análisis",
          items: [
            {
              id: "reporte-ventas",
              titulo: "Reporte de ventas",
              descripcion: "Cuánto vendiste, qué se mueve y quién vende, comparado con el período anterior.",
              contenido: () => <TableroReporte reporte="ventas" />,
            },
          ],
        },
        {
          titulo: "Facturación",
          nota: "Datos del SAR: sin un CAI vigente no se puede facturar.",
          items: [
            {
              recurso: "cai",
              descripcion: "Rangos autorizados por el SAR. Al acabarse o vencer uno, registrá el siguiente.",
            },
          ],
        },
      ]}
    />
  );
}

function Documentos() {
  const [abierto, setAbierto] = useState<{ id: string; numero: string } | null>(null);
  const [version, setVersion] = useState(0);
  const madre = useVentanaActual() ?? undefined;
  return (
    <>
      <MantenimientoRecurso
        recurso="documentos"
        puedeEditar={false}
        version={version}
        onAbrir={(f) => setAbierto({ id: String(f.id), numero: String(f.numero) })}
      />
      {abierto && (
        <VentanaFlotante
          id="documento"
          titulo={abierto.numero}
          padre={madre}
          tamano={{ w: 900, h: 760 }}
          foco={abierto.id}
          onCerrar={() => setAbierto(null)}
        >
          <DetalleDocumento
            key={abierto.id}
            id={abierto.id}
            onCambio={() => setVersion((v) => v + 1)}
          />
        </VentanaFlotante>
      )}
    </>
  );
}

function DetalleDocumento({ id, onCambio }: { id: string; onCambio: () => void }) {
  const api = useApi("ventas");
  const { rol } = useSesion();
  const { abrir } = useVentanas();
  const [doc, setDoc] = useState<Documento | null | undefined>(undefined);
  const [anulando, setAnulando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    api
      .documento(id)
      .then((d) => vivo && setDoc(d))
      .catch(() => vivo && setDoc(null));
    return () => {
      vivo = false;
    };
  }, [api, id]);

  async function aCarrito() {
    const r = await api.carritoDesdeDocumento(id);
    if (!r.ok) return setAviso(r.error);
    abrirCarritoEnMostrador(r.id);
    abrir("cotizar");
  }

  async function anular() {
    const r = await api.anular(id, motivo);
    if (!r.ok) return setAviso(r.error);
    setAnulando(false);
    setDoc(await api.documento(id));
    onCambio();
  }

  if (doc === undefined) return <div className={styles.cargando} style={{ margin: "1.2rem" }} aria-label="Cargando" />;
  if (doc === null) return <p className={styles.aviso} style={{ margin: "1.2rem" }}>No se encontró el documento.</p>;

  const puedeAnular = (rol === "dueno" || rol === "admin") && doc.estado === "emitido";

  return (
    <div className={styles.documento}>
      <div className={styles.documentoBarra}>
        <a className={`${ui.boton} ${ui.primario}`} href={`${api.urlImpresion(id)}?imprimir`} target="_blank" rel="noopener">
          <IconoImprimir tamano={14} /> Imprimir
        </a>
        <button type="button" className={ui.boton} onClick={aCarrito}>
          <IconoCarrito tamano={14} /> {doc.tipo === "cotizacion" ? "Pasar a carrito para facturar" : "Repetir en un carrito"}
        </button>
        {puedeAnular && !anulando && (
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
            Sí, anular {doc.tipo === "factura" ? "y devolver existencias" : ""}
          </button>
        </form>
      )}
      {aviso && <p className={styles.aviso}>{aviso}</p>}
      <DocumentoVista doc={doc} />
    </div>
  );
}
