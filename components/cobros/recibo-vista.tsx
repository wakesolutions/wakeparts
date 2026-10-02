import type { CSSProperties } from "react";
import doc from "@/components/ventas/documento-vista.module.css";
import { etiquetaForma, type Recibo } from "@/lib/cobros";
import { enLetras, fechaDia, fechaYHora, moneda, monto } from "@/lib/formato";
import type { Identidad } from "@/lib/identidad";
import { formatoRtn } from "@/lib/ventas";
import styles from "./recibo-vista.module.css";

/**
 * Recibo de abono (pantalla e impresión). Mismo papel que las facturas, pero
 * sin valor fiscal: comprueba el pago de facturas al crédito ya emitidas.
 */
export function ReciboVista({ recibo, identidad }: { recibo: Recibo; identidad?: Pick<Identidad, "logo" | "acento"> }) {
  const e = recibo.emisor ?? {};
  return (
    <article
      className={doc.hoja}
      data-anulado={recibo.estado === "anulado" || undefined}
      style={{ "--doc-marca": identidad?.acento ?? "var(--wp-accent)" } as CSSProperties}
    >
      {recibo.estado === "anulado" && (
        <div className={doc.anulado} aria-label="Recibo anulado">
          Anulado
        </div>
      )}

      <header className={doc.cabecera}>
        <div className={doc.emisor}>
          {identidad?.logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={identidad.logo} alt={e.nombre ?? "Logo"} className={doc.logo} />
          )}
          <p className={doc.nombreComercial}>{e.nombre}</p>
          {e.razon_social && <p className={doc.razon}>{e.razon_social}</p>}
          <p className={doc.datos}>
            {e.rtn && <span>RTN {formatoRtn(e.rtn)}</span>}
            {e.telefono && <span>Tel. {e.telefono}</span>}
          </p>
          {e.direccion && <p className={doc.datos}>{e.direccion}</p>}
        </div>
        <div className={doc.titulo}>
          <p className={doc.tipo} data-largo="">
            Recibo de pago
          </p>
          <p className={doc.numero}>{recibo.numero}</p>
          <p className={doc.fecha}>{fechaYHora(recibo.fecha)}</p>
        </div>
      </header>

      <section className={styles.recibimos}>
        <p>
          Recibimos de <strong>{recibo.cliente_nombre}</strong>
          {recibo.cliente_rtn && <> (RTN {formatoRtn(recibo.cliente_rtn)})</>} la cantidad de
        </p>
        <p className={styles.cantidad}>{moneda(recibo.monto)}</p>
        <p className={styles.letras}>{enLetras(recibo.monto)}</p>
        <p className={styles.forma}>
          <span>{etiquetaForma(recibo.forma_pago)}</span>
          {recibo.referencia && <span>Ref. {recibo.referencia}</span>}
        </p>
      </section>

      <table className={doc.lineas}>
        <thead>
          <tr>
            <th scope="col">Factura</th>
            <th scope="col">Fecha</th>
            <th scope="col" data-num="">
              Total
            </th>
            <th scope="col" data-num="">
              Abono
            </th>
          </tr>
        </thead>
        <tbody>
          {recibo.aplicaciones.map((a) => (
            <tr key={a.id_documento}>
              <td>
                <span className={styles.mono}>{a.numero}</span>
              </td>
              <td>{fechaDia(a.fecha_factura)}</td>
              <td data-num="">{monto(a.total)}</td>
              <td data-num="">{monto(a.monto)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className={doc.pie}>
        <div className={doc.letras}>
          {recibo.notas && (
            <>
              <span className={doc.etiqueta}>Notas</span>
              <p className={doc.notas}>{recibo.notas}</p>
            </>
          )}
          {recibo.cobro && <p className={doc.vendedor}>Cobró: {recibo.cobro}</p>}
          <div className={styles.firma}>
            <span />
            <p>Recibí conforme</p>
          </div>
        </div>
        <dl className={doc.totales}>
          <div className={doc.total}>
            <dt>Abono</dt>
            <dd>{moneda(recibo.monto)}</dd>
          </div>
          <div>
            <dt>Saldo pendiente del cliente</dt>
            <dd>{monto(Math.max(recibo.saldo_actual, 0))}</dd>
          </div>
        </dl>
      </section>

      <footer className={doc.leyendas}>
        <p>Recibo sin valor fiscal: comprueba el pago de las facturas indicadas.</p>
        {recibo.estado === "anulado" && recibo.motivo_anulacion && <p>Motivo de anulación: {recibo.motivo_anulacion}</p>}
      </footer>
    </article>
  );
}
