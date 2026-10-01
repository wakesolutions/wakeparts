import type { CSSProperties } from "react";
import { cant, enLetras, fechaDia, fechaYHora, moneda, monto, pct } from "@/lib/formato";
import { FORMATO_POR_DEFECTO, type Identidad } from "@/lib/identidad";
import { formatoRtn, type Documento } from "@/lib/ventas";
import styles from "./documento-vista.module.css";

/**
 * Hoja de un documento emitido (cotización o factura). Sirve para la vista en
 * pantalla y para imprimir. Las leyendas fiscales están marcadas «a verificar»
 * en docs/negocio.md §3.5.
 *
 * `identidad`: logo, color y formato de la empresa (Taller › Factura). El
 * formato solo cambia la presentación y lo opcional (vehículo, vendedor,
 * código, lema, mensaje); los datos fiscales se imprimen siempre.
 */
export function DocumentoVista({
  doc,
  identidad,
}: {
  doc: Documento;
  identidad?: Pick<Identidad, "logo" | "acento" | "formato">;
}) {
  const factura = doc.tipo === "factura";
  const e = doc.emisor ?? {};
  const f = identidad?.formato ?? FORMATO_POR_DEFECTO;
  const logo = f.logo !== "oculto" ? identidad?.logo : null;
  const marca = f.color === "tinta" ? "var(--wp-papel-tinta)" : (identidad?.acento ?? "var(--wp-accent)");
  return (
    <article
      className={styles.hoja}
      data-anulado={doc.estado === "anulado" || undefined}
      data-estilo={f.estilo}
      data-tabla={f.tabla}
      data-color={f.color}
      data-logo={logo ? f.logo : undefined}
      data-logo-tamano={f.logoTamano}
      style={{ "--doc-marca": marca } as CSSProperties}
    >
      {doc.estado === "anulado" && (
        <div className={styles.anulado} aria-label="Documento anulado">
          Anulado
        </div>
      )}

      <header className={styles.cabecera}>
        <div className={styles.emisor}>
          {logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt={e.nombre ?? "Logo"} className={styles.logo} />
          )}
          <p className={styles.nombreComercial}>{e.nombre}</p>
          {f.lema && <p className={styles.lema}>{f.lema}</p>}
          {e.razon_social && <p className={styles.razon}>{e.razon_social}</p>}
          <p className={styles.datos}>
            {e.rtn && <span>RTN {formatoRtn(e.rtn)}</span>}
            {e.telefono && <span>Tel. {e.telefono}</span>}
            {e.correo && <span>{e.correo}</span>}
          </p>
          {e.direccion && <p className={styles.datos}>{e.direccion}</p>}
        </div>
        <div className={styles.titulo}>
          <p className={styles.tipo}>{factura ? "Factura" : "Cotización"}</p>
          <p className={styles.numero}>{doc.numero}</p>
          <p className={styles.fecha}>{fechaYHora(doc.fecha)}</p>
        </div>
      </header>

      {factura && doc.cai && (
        <section className={styles.cai} aria-label="Datos del CAI">
          <div>
            <span>CAI</span>
            <strong>{doc.cai}</strong>
          </div>
          <div>
            <span>Rango autorizado</span>
            <strong>{doc.cai_rango}</strong>
          </div>
          <div>
            <span>Fecha límite de emisión</span>
            <strong>{doc.cai_fecha_limite ? fechaDia(doc.cai_fecha_limite) : "—"}</strong>
          </div>
        </section>
      )}

      <section className={styles.partes}>
        <div>
          <span className={styles.etiqueta}>Cliente</span>
          <p className={styles.cliente}>{doc.cliente_nombre}</p>
          {(doc.cliente_rtn || doc.cliente_telefono || doc.cliente_nombre !== "CONSUMIDOR FINAL") && (
            <p className={styles.datos}>
              {doc.cliente_rtn ? `RTN ${formatoRtn(doc.cliente_rtn)}` : "Sin RTN"}
              {doc.cliente_telefono && <span> · Tel. {doc.cliente_telefono}</span>}
            </p>
          )}
        </div>
        {doc.vehiculo && f.mostrarVehiculo && (
          <div>
            <span className={styles.etiqueta}>Vehículo</span>
            <p className={styles.vehiculo}>{doc.vehiculo}</p>
          </div>
        )}
        {!factura && doc.vence && (
          <div>
            <span className={styles.etiqueta}>Válida hasta</span>
            <p className={styles.vehiculo}>{fechaDia(doc.vence)}</p>
          </div>
        )}
      </section>

      <table className={styles.lineas}>
        <thead>
          <tr>
            <th scope="col">Cant.</th>
            <th scope="col">Descripción</th>
            <th scope="col" data-num="">
              Precio
            </th>
            <th scope="col" data-num="">
              Desc.
            </th>
            <th scope="col" data-num="">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {doc.lineas.map((l) => (
            <tr key={l.id}>
              <td data-num="">{cant(l.cantidad)}</td>
              <td>
                {l.descripcion}
                {l.codigo && f.mostrarCodigo && <span className={styles.codigo}>{l.codigo}</span>}
                {l.exento && <span className={styles.exento}>E</span>}
              </td>
              <td data-num="">{monto(l.precio)}</td>
              <td data-num="">{l.descuento > 0 ? `${monto(l.descuento)} (${pct(l.descuento_pct)})` : "—"}</td>
              <td data-num="">{monto(l.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className={styles.pie}>
        <div className={styles.letras}>
          <span className={styles.etiqueta}>Total en letras</span>
          <p>{enLetras(doc.total)}</p>
          {doc.notas && (
            <>
              <span className={styles.etiqueta}>Notas</span>
              <p className={styles.notas}>{doc.notas}</p>
            </>
          )}
          {doc.vendedor && f.mostrarVendedor && <p className={styles.vendedor}>Atendió: {doc.vendedor}</p>}
        </div>
        <dl className={styles.totales}>
          <div>
            <dt>Subtotal</dt>
            <dd>{monto(doc.subtotal)}</dd>
          </div>
          <div>
            <dt>Descuentos y rebajas</dt>
            <dd>{monto(doc.descuento)}</dd>
          </div>
          <div>
            <dt>Importe exento</dt>
            <dd>{monto(doc.importe_exento)}</dd>
          </div>
          <div>
            <dt>Importe exonerado</dt>
            <dd>{monto(0)}</dd>
          </div>
          <div>
            <dt>Importe gravado 15 %</dt>
            <dd>{monto(doc.importe_gravado)}</dd>
          </div>
          <div>
            <dt>ISV 15 %</dt>
            <dd>{monto(doc.isv)}</dd>
          </div>
          <div className={styles.total}>
            <dt>Total</dt>
            <dd>{moneda(doc.total)}</dd>
          </div>
        </dl>
      </section>

      <footer className={styles.leyendas}>
        {f.mensaje && <p className={styles.mensaje}>{f.mensaje}</p>}
        {factura ? (
          <>
            <p>La factura es beneficio de todos. Exíjala.</p>
            <p>Original: cliente · Copia: emisor</p>
          </>
        ) : (
          <p>Cotización sin valor fiscal. Precios sujetos a existencia.</p>
        )}
        {doc.estado === "anulado" && doc.motivo_anulacion && <p>Motivo de anulación: {doc.motivo_anulacion}</p>}
      </footer>
    </article>
  );
}
