import type { CSSProperties, ReactNode } from "react";
import { DENOMINACIONES, ETIQUETA_MOVIMIENTO, type Turno } from "@/lib/caja";
import { etiquetaForma, type Recibo } from "@/lib/cobros";
import { cant, enLetras, fechaDia, fechaYHora, monto } from "@/lib/formato";
import { FORMATO_POR_DEFECTO, type FormatoDocumento } from "@/lib/identidad";
import { etiquetaMotivo, formatoRtn, NOMBRE_DOCUMENTO, type Documento } from "@/lib/ventas";
import styles from "./tira.module.css";

/**
 * Impresión en tira de impresora térmica (80 o 58 mm). Siempre en negro, una
 * columna, cifras en mono alineadas a la derecha. Respeta el formato de la
 * empresa (Taller › Factura): lema, mensaje, qué mostrar, logo, ancho y letra.
 * En la factura y las notas los datos fiscales salen siempre, igual que en carta.
 */

type Identidad = { logo?: string | null; formato?: FormatoDocumento };

type Emisor = {
  nombre?: string | null;
  razon_social?: string | null;
  rtn?: string | null;
  telefono?: string | null;
  correo?: string | null;
  direccion?: string | null;
  sucursal?: string | null;
  direccion_sucursal?: string | null;
  telefono_sucursal?: string | null;
};

function Tira({ formato, anulado, children }: { formato: FormatoDocumento; anulado?: boolean; children: ReactNode }) {
  const ancho = Number(formato.ticketAncho);
  return (
    <article
      className={styles.tira}
      data-letra={formato.ticketLetra}
      data-anulado={anulado || undefined}
      style={{ "--ancho": `${ancho}mm` } as CSSProperties}
    >
      {/* El tamaño de la página sigue al rollo: sin márgenes y tan larga como la tira. */}
      <style>{`@page { size: ${ancho}mm auto; margin: 0; }`}</style>
      {anulado && <p className={styles.anulado}>*** ANULADO ***</p>}
      {children}
    </article>
  );
}

function Cabecera({ e, identidad, formato }: { e: Emisor; identidad?: Identidad; formato: FormatoDocumento }) {
  const conDireccionPropia = e.direccion_sucursal && e.direccion_sucursal !== e.direccion;
  return (
    <header className={styles.cabecera}>
      {formato.ticketLogo && formato.logo !== "oculto" && identidad?.logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={identidad.logo} alt="" className={styles.logo} />
      )}
      {e.nombre && <p className={styles.nombre}>{e.nombre}</p>}
      {formato.lema && <p className={styles.lema}>{formato.lema}</p>}
      {e.razon_social && <p>{e.razon_social}</p>}
      {e.rtn && <p>RTN {formatoRtn(e.rtn)}</p>}
      {e.direccion && <p>{e.direccion}</p>}
      {conDireccionPropia && (
        <p>
          Sucursal {e.sucursal}: {e.direccion_sucursal}
        </p>
      )}
      {(e.telefono_sucursal || e.telefono) && <p>Tel. {conDireccionPropia && e.telefono_sucursal ? e.telefono_sucursal : e.telefono}</p>}
      {e.correo && <p>{e.correo}</p>}
    </header>
  );
}

const Linea = () => <hr className={styles.corte} />;

function Par({ a, b, fuerte }: { a: ReactNode; b: ReactNode; fuerte?: boolean }) {
  return (
    <p className={styles.par} data-fuerte={fuerte || undefined}>
      <span>{a}</span>
      <span>{b}</span>
    </p>
  );
}

// ------------------------------------------------------------- documentos --

export function TiraDocumento({ doc, identidad }: { doc: Documento; identidad?: Identidad }) {
  const f = identidad?.formato ?? FORMATO_POR_DEFECTO;
  const e = doc.emisor ?? {};
  const factura = doc.tipo === "factura";
  const nota = doc.tipo === "nota_credito" || doc.tipo === "nota_debito";
  const fiscal = factura || nota;
  const exo = doc.exoneracion;

  return (
    <Tira formato={f} anulado={doc.estado === "anulado"}>
      <Cabecera e={e} identidad={identidad} formato={f} />
      <Linea />

      <section className={styles.titulo}>
        <p className={styles.tipo}>{NOMBRE_DOCUMENTO[doc.tipo]}</p>
        <p className={styles.numero}>{doc.numero}</p>
        <p>{fechaYHora(doc.fecha)}</p>
      </section>

      {fiscal && doc.cai && (
        <section className={styles.bloque}>
          <p>CAI: {doc.cai}</p>
          <p>Rango: {doc.cai_rango}</p>
          <p>Fecha límite de emisión: {doc.cai_fecha_limite ? fechaDia(doc.cai_fecha_limite) : "—"}</p>
        </section>
      )}

      {nota && (
        <section className={styles.bloque}>
          <p>Factura que modifica: {doc.factura_numero ?? "sin factura relacionada"}</p>
          {doc.factura_numero && <p>Fecha de la factura: {doc.factura_fecha ? fechaDia(doc.factura_fecha) : "—"}</p>}
          {doc.factura_cai && doc.factura_cai !== doc.cai && <p>CAI de la factura: {doc.factura_cai}</p>}
          <p>
            Motivo: {etiquetaMotivo(doc.motivo_tipo)}
            {doc.motivo ? ` — ${doc.motivo}` : ""}
          </p>
        </section>
      )}

      <Linea />
      <section className={styles.bloque}>
        <p>
          Cliente: <b>{doc.cliente_nombre}</b>
        </p>
        <p>{doc.cliente_rtn ? `RTN ${formatoRtn(doc.cliente_rtn)}` : "Sin RTN"}</p>
        {doc.vehiculo && f.mostrarVehiculo && <p>Vehículo: {doc.vehiculo}</p>}
        {factura && (
          <p>
            Condición:{" "}
            {doc.condicion === "credito"
              ? `Crédito · vence ${doc.vence ? fechaDia(doc.vence) : "—"}`
              : `Contado${doc.forma_pago ? ` · ${etiquetaForma(doc.forma_pago)}` : ""}${doc.referencia_pago ? ` (${doc.referencia_pago})` : ""}`}
          </p>
        )}
        {doc.tipo === "cotizacion" && doc.vence && <p>Válida hasta: {fechaDia(doc.vence)}</p>}
      </section>

      {exo && (
        <section className={styles.bloque}>
          <p>N.º orden de compra exenta: {exo.orden_compra || "—"}</p>
          <p>N.º constancia de registro de exonerado: {exo.constancia || "—"}</p>
          <p>N.º registro de la SAG: {exo.registro_sag || "—"}</p>
        </section>
      )}

      <Linea />
      <ul className={styles.lineas}>
        {doc.lineas.map((l) => (
          <li key={l.id}>
            <p className={styles.descripcion}>
              {l.descripcion}
              {l.exento && " (E)"}
              {l.codigo && f.mostrarCodigo && <span className={styles.codigo}> · {l.codigo}</span>}
            </p>
            <Par a={`${cant(l.cantidad)} × ${monto(l.precio)}`} b={monto(l.total)} />
            {l.descuento > 0 && <Par a="  Descuento" b={`−${monto(l.descuento)}`} />}
          </li>
        ))}
      </ul>
      <Linea />

      <section className={styles.totales}>
        <Par a="Subtotal" b={monto(doc.subtotal)} />
        <Par a="Descuentos y rebajas" b={monto(doc.descuento)} />
        <Par a="Importe exento" b={monto(doc.importe_exento)} />
        <Par a="Importe exonerado" b={monto(doc.importe_exonerado ?? 0)} />
        <Par a="Importe gravado 15 %" b={monto(doc.importe_gravado)} />
        <Par a="ISV 15 %" b={monto(doc.isv)} />
        <Par a="TOTAL L" b={monto(doc.total)} fuerte />
      </section>
      <p className={styles.letras}>{enLetras(doc.total)}</p>

      {doc.notas && <p className={styles.texto}>Notas: {doc.notas}</p>}
      {doc.vendedor && f.mostrarVendedor && <p className={styles.texto}>Atendió: {doc.vendedor}</p>}

      <Linea />
      <footer className={styles.pie}>
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
    </Tira>
  );
}

// ---------------------------------------------------------------- recibos --

export function TiraRecibo({ recibo, identidad }: { recibo: Recibo; identidad?: Identidad }) {
  const f = identidad?.formato ?? FORMATO_POR_DEFECTO;
  return (
    <Tira formato={f} anulado={recibo.estado === "anulado"}>
      <Cabecera e={recibo.emisor ?? {}} identidad={identidad} formato={f} />
      <Linea />
      <section className={styles.titulo}>
        <p className={styles.tipo}>Recibo de pago</p>
        <p className={styles.numero}>{recibo.numero}</p>
        <p>{fechaYHora(recibo.fecha)}</p>
      </section>
      <Linea />
      <section className={styles.bloque}>
        <p>
          Recibimos de <b>{recibo.cliente_nombre}</b>
        </p>
        {recibo.cliente_rtn && <p>RTN {formatoRtn(recibo.cliente_rtn)}</p>}
      </section>
      <p className={styles.grande}>L {monto(recibo.monto)}</p>
      <p className={styles.letras}>{enLetras(recibo.monto)}</p>
      <p className={styles.texto}>
        {etiquetaForma(recibo.forma_pago)}
        {recibo.referencia ? ` · Ref. ${recibo.referencia}` : ""}
      </p>
      <Linea />
      <ul className={styles.lineas}>
        {recibo.aplicaciones.map((a) => (
          <li key={a.id_documento}>
            <p className={styles.descripcion}>Factura {a.numero}</p>
            <Par a={`del ${fechaDia(a.fecha_factura)}`} b={monto(a.monto)} />
          </li>
        ))}
      </ul>
      <Linea />
      <section className={styles.totales}>
        <Par a="ABONO L" b={monto(recibo.monto)} fuerte />
        <Par a="Saldo pendiente" b={monto(Math.max(recibo.saldo_actual, 0))} />
      </section>
      {recibo.notas && <p className={styles.texto}>Notas: {recibo.notas}</p>}
      {recibo.cobro && f.mostrarVendedor && <p className={styles.texto}>Cobró: {recibo.cobro}</p>}
      <div className={styles.firma}>
        <span />
        <p>Recibí conforme</p>
      </div>
      <footer className={styles.pie}>
        {f.mensaje && <p className={styles.mensaje}>{f.mensaje}</p>}
        <p>Recibo sin valor fiscal.</p>
        {recibo.estado === "anulado" && recibo.motivo_anulacion && <p>Motivo de anulación: {recibo.motivo_anulacion}</p>}
      </footer>
    </Tira>
  );
}

// ------------------------------------------------------------------ cortes --

export function TiraCorte({ turno, identidad }: { turno: Turno; identidad?: Identidad }) {
  const f = identidad?.formato ?? FORMATO_POR_DEFECTO;
  const r = turno.resumen;
  const formas = r.formas.filter((x) => x.forma === "efectivo" || x.neto || x.ventas || x.abonos || x.devoluciones || x.pagos);
  const manuales = turno.movimientos.filter((m) => m.tipo === "entrada" || m.tipo === "salida");
  const arqueo = turno.arqueo ? DENOMINACIONES.filter((d) => (turno.arqueo?.[d.clave] ?? 0) > 0) : [];
  const dif = turno.diferencia ?? 0;

  return (
    <Tira formato={f}>
      <Cabecera e={{ nombre: turno.empresa }} identidad={identidad} formato={f} />
      <Linea />
      <section className={styles.titulo}>
        <p className={styles.tipo}>Corte de caja</p>
        <p className={styles.numero}>Turno {turno.numero}</p>
        <p>{turno.punto}</p>
        {turno.estado === "abierta" && <p>(corte parcial: caja abierta)</p>}
      </section>
      <section className={styles.bloque}>
        <p>
          Apertura: {fechaYHora(turno.abierta_en)}
          {turno.abierta_por ? ` · ${turno.abierta_por}` : ""}
        </p>
        {turno.cerrada_en && (
          <p>
            Cierre: {fechaYHora(turno.cerrada_en)}
            {turno.cerrada_por ? ` · ${turno.cerrada_por}` : ""}
          </p>
        )}
        <p>
          {r.facturas} ventas · {r.abonos} abonos · {r.notas} notas
          {r.pagos ? ` · ${r.pagos} pagos a proveedores` : ""}
        </p>
      </section>
      <Linea />
      <section className={styles.totales}>
        {formas.map((x) => (
          <Par key={x.forma} a={etiquetaForma(x.forma)} b={monto(x.neto)} />
        ))}
        <Par a="Total cobrado" b={monto(r.total_cobrado)} fuerte />
        {r.credito > 0 && <Par a="Al crédito (no es caja)" b={monto(r.credito)} />}
      </section>
      <Linea />
      <section className={styles.totales}>
        <Par a="Fondo inicial" b={monto(r.fondo)} />
        <Par a="+ Efectivo cobrado" b={monto(formas.find((x) => x.forma === "efectivo")?.neto ?? 0)} />
        <Par a="+ Entradas" b={monto(r.entradas)} />
        <Par a="− Salidas" b={monto(r.salidas)} />
        <Par a="EFECTIVO ESPERADO" b={monto(r.esperado_efectivo)} fuerte />
        {turno.efectivo_contado !== null && (
          <>
            <Par a="Efectivo contado" b={monto(turno.efectivo_contado)} />
            <Par a={dif === 0 ? "Cuadra" : dif > 0 ? "Sobrante" : "Faltante"} b={monto(Math.abs(dif))} fuerte />
          </>
        )}
      </section>
      {manuales.length > 0 && (
        <>
          <Linea />
          <ul className={styles.lineas}>
            {manuales.map((m) => (
              <li key={m.id}>
                <Par a={`${ETIQUETA_MOVIMIENTO[m.tipo]}: ${m.detalle ?? ""}`} b={`${m.monto < 0 ? "−" : ""}${monto(Math.abs(m.monto))}`} />
              </li>
            ))}
          </ul>
        </>
      )}
      {arqueo.length > 0 && (
        <>
          <Linea />
          <ul className={styles.lineas}>
            {arqueo.map((d) => (
              <li key={d.clave}>
                <Par a={`${turno.arqueo![d.clave]} × L ${d.clave}`} b={monto(turno.arqueo![d.clave] * d.valor)} />
              </li>
            ))}
          </ul>
        </>
      )}
      {turno.notas && <p className={styles.texto}>Nota: {turno.notas}</p>}
      <div className={styles.firma}>
        <span />
        <p>Entregó</p>
      </div>
      <div className={styles.firma}>
        <span />
        <p>Recibió</p>
      </div>
      <footer className={styles.pie}>
        <p>Documento interno sin valor fiscal.</p>
      </footer>
    </Tira>
  );
}
