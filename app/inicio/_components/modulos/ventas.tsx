"use client";

import { useEffect, useState } from "react";
import { Abonos } from "@/components/cobros/abonos";
import { CuentasPorCobrar } from "@/components/cobros/cuentas-por-cobrar";
import { useApi } from "@/components/datos/apis";
import { useIdentidad } from "@/components/identidad/contexto";
import { MantenimientoRecurso } from "@/components/mantenimiento/mantenimiento-recurso";
import { TableroReporte } from "@/components/reportes/tablero-reporte";
import ui from "@/components/ui/controles.module.css";
import { IconoCarrito, IconoImprimir } from "@/components/ui/iconos";
import { useVentanaActual } from "@/components/ventanas/ventana";
import { useVentanas } from "@/components/ventanas/contexto";
import { VentanaFlotante } from "@/components/ventanas/ventana-flotante";
import { PedidosWeb } from "@/components/sitio-web/pedidos-web";
import { DocumentoVista } from "@/components/ventas/documento-vista";
import { abrirCarritoEnMostrador } from "@/components/ventas/mostrador";
import { NotaEditor, saldoFactura } from "@/components/ventas/nota-editor";
import { fechaYHora, moneda } from "@/lib/formato";
import { etiquetaMotivo, NOMBRE_DOCUMENTO, type Documento, type TipoNota } from "@/lib/ventas";
import { useSesion } from "../sesion-contexto";
import { ModuloTablas } from "./tablas";
import styles from "./modulos.module.css";
import { urlImprimir } from "@/lib/impresion";

/** Ventas: documentos emitidos, pedidos del sitio web, clientes, reporte de ventas, puntos de emisión y CAI. */
export function ModuloVentas() {
  const { rol } = useSesion();
  const administra = rol === "dueno" || rol === "admin";
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
              descripcion:
                "Cotizaciones, facturas y notas de crédito o débito. Abrí una factura para imprimirla, repetirla, hacer una devolución o anularla.",
              contenido: () => <ListaDocumentos recurso="documentos" />,
            },
            {
              recurso: "pedidos_web",
              descripcion:
                "Lo que piden los clientes desde tu sitio web. Abrí uno y pasalo al mostrador para cotizar o facturar.",
              contenido: () => <PedidosWeb />,
            },
            {
              recurso: "clientes",
              descripcion:
                "Clientes del taller. Con RTN salen en la factura; sin RTN, como consumidor final. Los exonerados facturan sin ISV; a los de confianza les das crédito.",
            },
          ],
        },
        {
          titulo: "Cobros",
          items: [
            {
              recurso: "cuentas_clientes",
              descripcion:
                "Lo que te deben las facturas al crédito, por cliente y por antigüedad. Abrí un cliente para ver su estado de cuenta y registrar un abono.",
              contenido: () => <CuentasPorCobrar />,
            },
            {
              recurso: "pagos",
              descripcion: "Recibos de abono emitidos. Abrí uno para imprimirlo o anularlo.",
              contenido: () => <Abonos administra={administra} />,
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
              recurso: "puntos_emision",
              descripcion:
                "Sucursales y cajas que emiten. Cada persona factura con la suya (Usuarios) o con la predeterminada.",
            },
            {
              recurso: "cai",
              descripcion:
                "Rangos autorizados por el SAR para facturas (01), notas de crédito (06) y de débito (07), uno por punto de emisión. Al acabarse o vencer uno, registrá el siguiente.",
            },
          ],
        },
      ]}
    />
  );
}

/** Listado de documentos (o solo notas) que abre cada uno en una ventana hija con su detalle. */
export function ListaDocumentos({ recurso }: { recurso: "documentos" | "notas" }) {
  const [abierto, setAbierto] = useState<{ id: string; numero: string } | null>(null);
  const [version, setVersion] = useState(0);
  const madre = useVentanaActual() ?? undefined;
  return (
    <>
      <MantenimientoRecurso
        recurso={recurso}
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
            onAbrir={(id, numero) => setAbierto({ id, numero })}
          />
        </VentanaFlotante>
      )}
    </>
  );
}

export function DetalleDocumento({
  id,
  onCambio,
  onAbrir,
}: {
  id: string;
  onCambio: () => void;
  /** Abre otro documento en esta misma ventana (la factura de una nota, o una nota recién emitida). */
  onAbrir: (id: string, numero: string) => void;
}) {
  const api = useApi("ventas");
  const { rol } = useSesion();
  const { identidad } = useIdentidad();
  const { abrir } = useVentanas();
  const madre = useVentanaActual() ?? undefined;
  const [doc, setDoc] = useState<Documento | null | undefined>(undefined);
  const [anulando, setAnulando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [nota, setNota] = useState<TipoNota | null>(null);

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

  const administra = rol === "dueno" || rol === "admin";
  const esFactura = doc.tipo === "factura";
  const esNota = doc.tipo === "nota_credito" || doc.tipo === "nota_debito";
  const vigentes = (doc.notasRelacionadas ?? []).filter((n) => n.estado === "emitido");
  const puedeAnular = administra && doc.estado === "emitido";
  const puedeNotas = administra && esFactura && doc.estado === "emitido";
  const saldo = esFactura ? saldoFactura(doc) : 0;

  const textoAnular =
    doc.tipo === "factura"
      ? "Sí, anular y devolver existencias"
      : doc.tipo === "nota_credito" && doc.reintegra_inventario
        ? "Sí, anular y volver a sacar las piezas"
        : "Sí, anular";

  return (
    <div className={styles.documento}>
      <div className={styles.documentoBarra}>
        <a className={`${ui.boton} ${ui.primario}`} href={urlImprimir(api.urlImpresion(id))} target="_blank" rel="noopener">
          <IconoImprimir tamano={14} /> Imprimir
        </a>
        {!esNota && (
          <button type="button" className={ui.boton} onClick={aCarrito}>
            <IconoCarrito tamano={14} /> {doc.tipo === "cotizacion" ? "Pasar a carrito para facturar" : "Repetir en un carrito"}
          </button>
        )}
        {puedeNotas && (
          <>
            <button type="button" className={ui.boton} onClick={() => setNota("nota_credito")} disabled={saldo <= 0}>
              Nota de crédito
            </button>
            <button type="button" className={ui.boton} onClick={() => setNota("nota_debito")}>
              Nota de débito
            </button>
          </>
        )}
        {esNota && doc.id_factura && (
          <button type="button" className={ui.boton} onClick={() => onAbrir(doc.id_factura!, doc.factura_numero ?? "Factura")}>
            Ver factura {doc.factura_numero}
          </button>
        )}
        {puedeAnular && !anulando && (
          <button
            type="button"
            className={`${ui.boton} ${ui.fantasma} ${ui.peligro}`}
            onClick={() => {
              setAviso(null);
              setAnulando(true);
            }}
          >
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
            {textoAnular}
          </button>
        </form>
      )}
      {aviso && <p className={styles.aviso}>{aviso}</p>}

      {esFactura && (doc.notasRelacionadas?.length ?? 0) > 0 && (
        <section className={styles.notasFactura} aria-label="Notas de esta factura">
          <header>
            <span className={styles.notasEtiqueta}>Notas de esta factura</span>
            <span className={styles.notasSaldo}>
              Saldo <strong>{moneda(saldo)}</strong>
              {vigentes.length > 0 && <small> de {moneda(doc.total)}</small>}
            </span>
          </header>
          <ul>
            {doc.notasRelacionadas!.map((n) => (
              <li key={n.id} data-anulada={n.estado === "anulado" || undefined}>
                <button type="button" onClick={() => onAbrir(n.id, n.numero)}>
                  <span className={styles.notaTipo} data-tipo={n.tipo}>
                    {n.tipo === "nota_credito" ? "NC" : "ND"}
                  </span>
                  <span className={styles.notaNumero}>{n.numero}</span>
                  <span className={styles.notaMotivo}>
                    {etiquetaMotivo(n.motivo_tipo)} · {fechaYHora(n.fecha)}
                    {n.estado === "anulado" && " · anulada"}
                  </span>
                  <span className={styles.notaTotal}>
                    {n.tipo === "nota_credito" ? "−" : "+"} {moneda(n.total)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <DocumentoVista doc={doc} identidad={identidad} />

      {nota && (
        <VentanaFlotante
          id="nota"
          titulo={`${NOMBRE_DOCUMENTO[nota]} · ${doc.numero}`}
          padre={madre}
          tamano={{ w: 760, h: 720 }}
          foco={`${nota}-${doc.id}`}
          onCerrar={() => setNota(null)}
        >
          <NotaEditor
            key={nota}
            factura={doc}
            tipo={nota}
            onCancelar={() => setNota(null)}
            onEmitida={(nuevo, numero) => {
              setNota(null);
              onCambio();
              onAbrir(nuevo, numero);
            }}
          />
        </VentanaFlotante>
      )}
    </div>
  );
}
