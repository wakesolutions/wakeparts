import type { CSSProperties } from "react";
import { etiquetaForma } from "@/lib/cobros";
import { cant, enLetras, fechaDia, fechaYHora, moneda, monto, pct } from "@/lib/formato";
import { FORMATO_POR_DEFECTO, type Identidad } from "@/lib/identidad";
import { etiquetaMotivo, formatoRtn, NOMBRE_DOCUMENTO, type Documento } from "@/lib/ventas";
import styles from "./documento-vista.module.css";

/**
 * Hoja de un documento emitido (cotización, factura o nota de crédito/débito).
 * Sirve para la vista en pantalla y para imprimir. Las leyendas fiscales están marcadas «a verificar»
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
  const nota = doc.tipo === "nota_credito" || doc.tipo === "nota_debito";
  const fiscal = factura || nota;
  const exo = doc.exoneracion;
  const e = doc.emisor ?? {};
  // La sucursal solo se imprime aparte si no es la dirección del taller.
  const sucursalPropia = Boolean(e.direccion_sucursal && e.direccion_sucursal !== e.direccion);
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
          {sucursalPropia && (
            <p className={styles.datos}>
              <span>
                Sucursal {e.sucursal}: {e.direccion_sucursal}
              </span>
              {e.telefono_sucursal && <span>Tel. {e.telefono_sucursal}</span>}
            </p>
          )}
        </div>
        <div className={styles.titulo}>
          <p className={styles.tipo} data-largo={nota || undefined}>
            {NOMBRE_DOCUMENTO[doc.tipo]}
          </p>
          <p className={styles.numero}>{doc.numero}</p>
          <p className={styles.fecha}>{fechaYHora(doc.fecha)}</p>
        </div>
      </header>

      {fiscal && doc.cai && (
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

      {nota && (
        <section className={styles.referencia} aria-label="Documento que modifica">
          <div>
            <span>Factura que modifica</span>
            <strong>{doc.factura_numero}</strong>
          </div>
          <div>
            <span>Fecha de la factura</span>
            <strong>{doc.factura_fecha ? fechaDia(doc.factura_fecha) : "—"}</strong>
          </div>
          {doc.factura_cai && doc.factura_cai !== doc.cai && (
            <div>
              <span>CAI de la factura</span>
              <strong>{doc.factura_cai}</strong>
            </div>
          )}
          <div className={styles.referenciaMotivo}>
            <span>Motivo</span>
            <strong>
              {etiquetaMotivo(doc.motivo_tipo)}
              {doc.motivo ? `: ${doc.motivo}` : ""}
            </strong>
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
        {factura && (
          <div>
            <span className={styles.etiqueta}>Condición</span>
            <p className={styles.vehiculo}>
              {doc.condicion === "credito"
                ? `Crédito · vence ${doc.vence ? fechaDia(doc.vence) : "—"}`
                : `Contado${doc.forma_pago ? ` · ${etiquetaForma(doc.forma_pago)}` : ""}${doc.referencia_pago ? ` (${doc.referencia_pago})` : ""}`}
            </p>
          </div>
        )}
        {doc.tipo === "cotizacion" && doc.vence && (
          <div>
            <span className={styles.etiqueta}>Válida hasta</span>
            <p className={styles.vehiculo}>{fechaDia(doc.vence)}</p>
          </div>
        )}
      </section>

      {exo && (
        <section className={styles.exoneracion} aria-label="Datos de la exoneración">
          <div>
            <span>N.º correlativo de orden de compra exenta</span>
            <strong>{exo.orden_compra || "—"}</strong>
          </div>
          <div>
            <span>N.º correlativo de constancia de registro de exonerado</span>
            <strong>{exo.constancia || "—"}</strong>
          </div>
          <div>
            <span>N.º identificativo del registro de la SAG</span>
            <strong>{exo.registro_sag || "—"}</strong>
          </div>
        </section>
      )}

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
            <dd>{monto(doc.importe_exonerado ?? 0)}</dd>
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
        {fiscal ? (
          <>
            {factura && <p>La factura es beneficio de todos. Exíjala.</p>}
            <p>Original: cliente · Copia: emisor</p>
            {e.punto && <p>Punto de emisión: {e.punto}</p>}
          </>
        ) : (
          <p>Cotización sin valor fiscal. Precios sujetos a existencia.</p>
        )}
        {doc.estado === "anulado" && doc.motivo_anulacion && <p>Motivo de anulación: {doc.motivo_anulacion}</p>}
      </footer>
    </article>
  );
}
