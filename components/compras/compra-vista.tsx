"use client";

import { useEffect, useState } from "react";
import { useApi } from "@/components/datos/apis";
import { MantenimientoRecurso } from "@/components/mantenimiento/mantenimiento-recurso";
import ui from "@/components/ui/controles.module.css";
import { useVentanaActual } from "@/components/ventanas/ventana";
import { VentanaFlotante } from "@/components/ventanas/ventana-flotante";
import { etiquetaForma } from "@/lib/cobros";
import { ETIQUETA_TIPO_COMPRA, type Compra } from "@/lib/compras";
import { cant, fechaDia, fechaYHora, moneda } from "@/lib/formato";
import { formatoRtn } from "@/lib/ventas";
import { EstadoProveedor } from "./por-pagar";
import styles from "./compras.module.css";

/** Compras › Compras: las registradas. Abrir una la muestra con sus líneas y pagos (y se anula). */
export function ListaCompras() {
  const [abierta, setAbierta] = useState<{ id: string; numero: string } | null>(null);
  const [version, setVersion] = useState(0);
  const madre = useVentanaActual() ?? undefined;
  return (
    <>
      <MantenimientoRecurso
        recurso="compras"
        puedeEditar={false}
        version={version}
        onAbrir={(f) => setAbierta({ id: String(f.id), numero: String(f.numero) })}
      />
      {abierta && (
        <VentanaFlotante
          id="compra"
          titulo={abierta.numero}
          padre={madre}
          tamano={{ w: 880, h: 720 }}
          foco={abierta.id}
          onCerrar={() => setAbierta(null)}
        >
          <CompraVista key={abierta.id} id={abierta.id} onCambio={() => setVersion((v) => v + 1)} />
        </VentanaFlotante>
      )}
    </>
  );
}

export function CompraVista({ id, onCambio }: { id: string; onCambio?: () => void }) {
  const api = useApi("compras");
  const [compra, setCompra] = useState<Compra | null | undefined>(undefined);
  const [anulando, setAnulando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [pagando, setPagando] = useState(false);
  const [version, setVersion] = useState(0);
  const madre = useVentanaActual() ?? undefined;

  useEffect(() => {
    let vivo = true;
    api
      .compra(id)
      .then((c) => vivo && setCompra(c))
      .catch(() => vivo && setCompra(null));
    return () => {
      vivo = false;
    };
  }, [api, id, version]);

  async function anular() {
    const r = await api.anular(id, motivo);
    if (!r.ok) return setAviso(r.error);
    setAnulando(false);
    setCompra(await api.compra(id));
    onCambio?.();
  }

  if (compra === undefined) return <div className={styles.cargando} aria-label="Cargando" />;
  if (compra === null) return <p className={styles.error}>No se encontró la compra.</p>;

  const vigentes = compra.pagos.filter((p) => p.estado === "emitido");
  const porPagar = compra.estado === "emitido" && compra.condicion === "credito" && (compra.pendiente ?? 0) > 0;
  return (
    <div className={styles.vista}>
      {compra.estado === "emitido" && (
        <div className={styles.vistaBarra}>
          {porPagar && (
            <button type="button" className={`${ui.boton} ${ui.primario}`} onClick={() => setPagando(true)}>
              Registrar pago · {moneda(compra.pendiente ?? 0)}
            </button>
          )}
          {!anulando && (
            <button
              type="button"
              className={`${ui.boton} ${ui.fantasma} ${ui.peligro}`}
              onClick={() => {
                setAviso(null);
                setAnulando(true);
              }}
            >
              Anular compra
            </button>
          )}
        </div>
      )}
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
            autoFocus
            aria-label="Motivo de la anulación"
            onChange={(e) => setMotivo(e.target.value)}
          />
          <button type="button" className={`${ui.boton} ${ui.fantasma}`} onClick={() => setAnulando(false)}>
            Cancelar
          </button>
          <button type="submit" className={`${ui.boton} ${ui.peligro}`} disabled={!motivo.trim()}>
            {compra.tipo === "inventario" ? "Sí, anular y sacar las piezas" : "Sí, anular"}
          </button>
        </form>
      )}
      {aviso && <p className={styles.error}>{aviso}</p>}
      {vigentes.length > 0 && anulando && (
        <p className={styles.ayuda}>Tiene pagos vigentes: anulalos primero en Compras › Pagos.</p>
      )}

      <article className={styles.ficha}>
        <header className={styles.fichaCabeza}>
          <div>
            <span className={styles.etiqueta}>Compra · {ETIQUETA_TIPO_COMPRA[compra.tipo]}</span>
            <h2>{compra.proveedor_nombre}</h2>
            <span className={styles.ayuda}>{compra.proveedor_rtn ? `RTN ${formatoRtn(compra.proveedor_rtn)}` : "Proveedor sin RTN"}</span>
          </div>
          <div>
            <div className={styles.numero}>{compra.numero}</div>
            {compra.estado === "anulado" && <span className={styles.anulada}>Anulada</span>}
          </div>
        </header>

        <dl className={styles.datos}>
          <div>
            <dt className={styles.etiqueta}>Factura del proveedor</dt>
            <dd>{compra.documento ?? "—"}</dd>
          </div>
          <div>
            <dt className={styles.etiqueta}>Fecha</dt>
            <dd>{fechaDia(compra.fecha)}</dd>
          </div>
          {compra.cai_proveedor && (
            <div>
              <dt className={styles.etiqueta}>CAI</dt>
              <dd>{compra.cai_proveedor}</dd>
            </div>
          )}
          <div>
            <dt className={styles.etiqueta}>Condición</dt>
            <dd>
              {compra.condicion === "credito"
                ? `Crédito · vence ${compra.vence ? fechaDia(compra.vence) : "—"}`
                : `Contado · ${compra.forma_pago ? etiquetaForma(compra.forma_pago) : ""}${compra.de_caja ? " (de la caja)" : ""}`}
            </dd>
          </div>
          {compra.condicion === "credito" && compra.pendiente !== null && (
            <div>
              <dt className={styles.etiqueta}>Por pagar</dt>
              <dd>{moneda(compra.pendiente)}</dd>
            </div>
          )}
          {compra.registro && (
            <div>
              <dt className={styles.etiqueta}>Registró</dt>
              <dd>{compra.registro}</dd>
            </div>
          )}
        </dl>

        <table className={styles.tabla}>
          <thead>
            <tr>
              <th scope="col">Descripción</th>
              <th scope="col" data-num="">
                Cant.
              </th>
              <th scope="col" data-num="">
                Costo
              </th>
              <th scope="col" data-num="">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {compra.lineas.map((l) => (
              <tr key={l.id}>
                <td>
                  {l.descripcion}
                  {l.codigo && <span className={styles.ayuda}> · {l.codigo}</span>}
                  {l.exento && <span className={styles.ayuda}> · exento</span>}
                </td>
                <td data-num="">{cant(l.cantidad)}</td>
                <td data-num="">{moneda(l.costo)}</td>
                <td data-num="">{moneda(l.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className={styles.sumas}>
          {compra.importe_exento > 0 && (
            <div>
              <dt>Exento</dt>
              <dd>{moneda(compra.importe_exento)}</dd>
            </div>
          )}
          <div>
            <dt>Gravado</dt>
            <dd>{moneda(compra.importe_gravado)}</dd>
          </div>
          <div>
            <dt>ISV</dt>
            <dd>{moneda(compra.isv)}</dd>
          </div>
          <div>
            <dt>Total</dt>
            <dd>{moneda(compra.total)}</dd>
          </div>
        </dl>

        {compra.notas && <p className={styles.ayuda}>Nota: {compra.notas}</p>}
        {compra.estado === "anulado" && compra.motivo_anulacion && (
          <p className={styles.ayuda}>Motivo de anulación: {compra.motivo_anulacion}</p>
        )}

        {compra.pagos.length > 0 && (
          <section>
            <span className={styles.etiqueta}>Pagos aplicados</span>
            <ul className={styles.pagosLista}>
              {compra.pagos.map((p) => (
                <li key={p.id} data-anulado={p.estado === "anulado" || undefined}>
                  <span>
                    {p.numero} · {fechaYHora(p.fecha)}
                  </span>
                  <strong>{moneda(p.monto)}</strong>
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>

      {pagando && (
        <VentanaFlotante
          id="estado-proveedor"
          titulo={`Por pagar · ${compra.proveedor_nombre}`}
          padre={madre}
          tamano={{ w: 980, h: 740 }}
          foco={`${compra.id_proveedor}-${compra.id}`}
          onCerrar={() => setPagando(false)}
        >
          <EstadoProveedor
            idProveedor={compra.id_proveedor}
            compra={compra.id}
            onCambio={() => {
              setVersion((v) => v + 1);
              onCambio?.();
            }}
          />
        </VentanaFlotante>
      )}
    </div>
  );
}
