import type { CSSProperties } from "react";
import doc from "@/components/ventas/documento-vista.module.css";
import { DENOMINACIONES, ETIQUETA_MOVIMIENTO, type Turno } from "@/lib/caja";
import { etiquetaForma } from "@/lib/cobros";
import { fechaYHora, moneda, monto } from "@/lib/formato";
import type { Identidad } from "@/lib/identidad";
import styles from "./corte-vista.module.css";

/**
 * Corte de caja (pantalla e impresión): resumen por forma de pago, cuadre del
 * efectivo, arqueo por denominación y entradas/salidas. Mismo papel que las
 * facturas; sin valor fiscal.
 */
export function CorteVista({ turno, identidad }: { turno: Turno; identidad?: Pick<Identidad, "acento"> }) {
  const r = turno.resumen;
  const efectivo = r.formas.find((f) => f.forma === "efectivo");
  const formas = r.formas.filter((f) => f.forma === "efectivo" || f.neto || f.ventas || f.abonos || f.devoluciones || f.pagos);
  const manuales = turno.movimientos.filter((m) => m.tipo === "entrada" || m.tipo === "salida");
  const arqueo = turno.arqueo ? DENOMINACIONES.filter((d) => (turno.arqueo?.[d.clave] ?? 0) > 0) : [];
  const abierta = turno.estado === "abierta";

  return (
    <article className={doc.hoja} style={{ "--doc-marca": identidad?.acento ?? "var(--wp-accent)" } as CSSProperties}>
      <header className={doc.cabecera}>
        <div className={doc.emisor}>
          {turno.empresa && <p className={doc.nombreComercial}>{turno.empresa}</p>}
          <p className={doc.datos}>{turno.punto}</p>
        </div>
        <div className={doc.titulo}>
          <p className={doc.tipo} data-largo="">
            Corte de caja
          </p>
          <p className={doc.numero}>Turno {turno.numero}</p>
          <p className={doc.fecha}>{abierta ? "Abierto: corte parcial" : "Cerrado"}</p>
        </div>
      </header>

      <section className={styles.tiempos}>
        <div>
          <span className={doc.etiqueta}>Apertura</span>
          <p>
            {fechaYHora(turno.abierta_en)}
            {turno.abierta_por ? ` · ${turno.abierta_por}` : ""}
          </p>
        </div>
        <div>
          <span className={doc.etiqueta}>Cierre</span>
          <p>{turno.cerrada_en ? `${fechaYHora(turno.cerrada_en)}${turno.cerrada_por ? ` · ${turno.cerrada_por}` : ""}` : "—"}</p>
        </div>
        <div>
          <span className={doc.etiqueta}>Documentos</span>
          <p>
            {r.facturas} ventas · {r.abonos} abonos · {r.notas} notas
            {r.pagos ? ` · ${r.pagos} pagos a proveedores` : ""}
            {r.anuladas ? ` · ${r.anuladas} anulados` : ""}
          </p>
        </div>
      </section>

      <table className={doc.lineas}>
        <thead>
          <tr>
            <th scope="col">Forma de pago</th>
            <th scope="col" data-num="">
              Ventas
            </th>
            <th scope="col" data-num="">
              Abonos
            </th>
            <th scope="col" data-num="">
              Devoluciones y pagos
            </th>
            <th scope="col" data-num="">
              Neto
            </th>
          </tr>
        </thead>
        <tbody>
          {formas.map((f) => (
            <tr key={f.forma}>
              <td>{etiquetaForma(f.forma)}</td>
              <td data-num="">{monto(f.ventas + f.cargos)}</td>
              <td data-num="">{monto(f.abonos)}</td>
              <td data-num="">{f.devoluciones + f.pagos ? `− ${monto(f.devoluciones + f.pagos)}` : "—"}</td>
              <td data-num="">{monto(f.neto)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className={doc.pie}>
        <div className={doc.letras}>
          {r.credito > 0 && <p className={doc.notas}>Ventas al crédito del turno: {moneda(r.credito)} (no entran a la caja).</p>}
          {manuales.length > 0 && (
            <>
              <span className={doc.etiqueta}>Entradas y salidas</span>
              <ul className={styles.manuales}>
                {manuales.map((m) => (
                  <li key={m.id}>
                    <span>
                      {ETIQUETA_MOVIMIENTO[m.tipo]}: {m.detalle}
                    </span>
                    <span>{m.monto < 0 ? `− ${monto(-m.monto)}` : monto(m.monto)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {arqueo.length > 0 && (
            <>
              <span className={doc.etiqueta}>Arqueo</span>
              <ul className={styles.manuales}>
                {arqueo.map((d) => (
                  <li key={d.clave}>
                    <span>
                      {turno.arqueo![d.clave]} × L {d.clave}
                    </span>
                    <span>{monto(turno.arqueo![d.clave] * d.valor)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {turno.notas && (
            <>
              <span className={doc.etiqueta}>Nota del cierre</span>
              <p className={doc.notas}>{turno.notas}</p>
            </>
          )}
          <div className={styles.firmas}>
            <div>
              <span />
              <p>Entregó</p>
            </div>
            <div>
              <span />
              <p>Recibió</p>
            </div>
          </div>
        </div>
        <dl className={doc.totales}>
          <div>
            <dt>Fondo inicial</dt>
            <dd>{monto(r.fondo)}</dd>
          </div>
          <div>
            <dt>+ Efectivo cobrado</dt>
            <dd>{monto(efectivo?.neto ?? 0)}</dd>
          </div>
          <div>
            <dt>+ Entradas − salidas</dt>
            <dd>
              {r.entradas - r.salidas < 0 ? "− " : ""}
              {monto(Math.abs(r.entradas - r.salidas))}
            </dd>
          </div>
          <div className={doc.total}>
            <dt>Efectivo esperado</dt>
            <dd>{moneda(r.esperado_efectivo)}</dd>
          </div>
          {turno.efectivo_contado !== null && (
            <>
              <div>
                <dt>Efectivo contado</dt>
                <dd>{monto(turno.efectivo_contado)}</dd>
              </div>
              <div>
                <dt>{(turno.diferencia ?? 0) === 0 ? "Cuadra" : (turno.diferencia ?? 0) > 0 ? "Sobrante" : "Faltante"}</dt>
                <dd>{monto(Math.abs(turno.diferencia ?? 0))}</dd>
              </div>
            </>
          )}
          <div>
            <dt>Total cobrado (todas las formas)</dt>
            <dd>{monto(r.total_cobrado)}</dd>
          </div>
        </dl>
      </section>

      <footer className={doc.leyendas}>
        <p>Documento interno sin valor fiscal.</p>
      </footer>
    </article>
  );
}
