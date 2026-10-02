"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useApi } from "@/components/datos/apis";
import ui from "@/components/ui/controles.module.css";
import { IconoMas, IconoMenos, IconoPapelera } from "@/components/ui/iconos";
import { cant, centavos, fechaYHora, moneda } from "@/lib/formato";
import {
  MOTIVOS_NOTA,
  NOMBRE_DOCUMENTO,
  pendienteDevolver,
  totalesNota,
  type Documento,
  type LineaAcreditable,
  type MotivoNota,
  type TipoNota,
} from "@/lib/ventas";
import { Odometro } from "./odometro";
import styles from "./nota-editor.module.css";

type Monto = { clave: number; descripcion: string; monto: string; exento: boolean };

/** Saldo de una factura: total + notas de débito − notas de crédito vigentes (igual que saldo_factura()). */
export function saldoFactura(doc: Documento) {
  const notas = (doc.notasRelacionadas ?? []).filter((n) => n.estado === "emitido");
  return centavos(
    notas.reduce((s, n) => s + (n.tipo === "nota_debito" ? n.total : -n.total), doc.total),
  );
}

/**
 * Nota de crédito o débito sobre una factura emitida. Devolución: se eligen
 * unidades de las líneas de la factura (y si regresan al inventario); lo demás:
 * montos sin ISV. Calcula igual que emitir_nota() y muestra cómo queda el saldo.
 */
export function NotaEditor({
  factura,
  tipo,
  onEmitida,
  onCancelar,
}: {
  factura: Documento;
  tipo: TipoNota;
  onEmitida: (id: string, numero: string) => void;
  onCancelar: () => void;
}) {
  const api = useApi("ventas");
  const credito = tipo === "nota_credito";
  const motivos = MOTIVOS_NOTA[tipo];
  const [motivoTipo, setMotivoTipo] = useState<MotivoNota>(motivos[0].valor);
  const [motivo, setMotivo] = useState("");
  const [lineas, setLineas] = useState<LineaAcreditable[] | null>(null);
  const [cantidades, setCantidades] = useState<Record<number, number>>({});
  const [montos, setMontos] = useState<Monto[]>([{ clave: 1, descripcion: "", monto: "", exento: false }]);
  const [reintegrar, setReintegrar] = useState(true);
  const [confirmar, setConfirmar] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const devolucion = motivoTipo === "devolucion";
  const exonerada = factura.exoneracion != null;
  const saldo = saldoFactura(factura);

  useEffect(() => {
    if (!credito) return;
    let vivo = true;
    api
      .lineasAcreditables(factura.id)
      .then((l) => vivo && setLineas(l))
      .catch(() => vivo && setLineas([]));
    return () => {
      vivo = false;
    };
  }, [api, credito, factura.id]);

  const totales = useMemo(
    () =>
      devolucion
        ? totalesNota(
            (lineas ?? []).map((linea) => ({ linea, cantidad: cantidades[linea.id] ?? 0 })),
            exonerada,
          )
        : totalesNota(
            montos.map((m) => ({ monto: Number(m.monto.replace(",", ".")) || 0, exento: m.exento })),
            exonerada,
          ),
    [devolucion, lineas, cantidades, montos, exonerada],
  );

  const despues = centavos(credito ? saldo - totales.total : saldo + totales.total);
  const excede = credito && totales.total > saldo + 0.02;
  const hayAlgo = totales.total > 0;
  const puedeEmitir = hayAlgo && motivo.trim().length > 0 && !excede && !ocupado;
  const hayInventario = devolucion && (lineas ?? []).some((l) => l.controla_inventario && (cantidades[l.id] ?? 0) > 0);
  const motivoActual = motivos.find((m) => m.valor === motivoTipo)!;

  function cambiarCantidad(l: LineaAcreditable, valor: number) {
    const tope = pendienteDevolver(l);
    const n = Math.min(Math.max(centavos(valor), 0), tope);
    setCantidades((c) => ({ ...c, [l.id]: n }));
    setConfirmar(false);
  }

  function devolverTodo() {
    setCantidades(Object.fromEntries((lineas ?? []).map((l) => [l.id, pendienteDevolver(l)])));
    setConfirmar(false);
  }

  async function emitir() {
    setOcupado(true);
    setError(null);
    const r = await api.emitirNota(factura.id, {
      tipo,
      motivo_tipo: motivoTipo,
      motivo: motivo.trim(),
      reintegrar: devolucion && reintegrar,
      lineas: devolucion
        ? (lineas ?? [])
            .filter((l) => (cantidades[l.id] ?? 0) > 0)
            .map((l) => ({ id_linea: l.id, cantidad: cantidades[l.id] }))
        : montos
            .filter((m) => Number(m.monto.replace(",", ".")) > 0)
            .map((m) => ({
              descripcion: m.descripcion.trim() || motivoActual.etiqueta,
              monto: Number(m.monto.replace(",", ".")),
              exento: m.exento,
            })),
    });
    setOcupado(false);
    if (!r.ok) {
      setConfirmar(false);
      return setError(r.error);
    }
    onEmitida(r.id, r.numero);
  }

  // Medidor de saldo: cuánto de la factura queda después de la nota.
  const escala = Math.max(factura.total, saldo, despues, 0.01);
  const medidor = {
    "--antes": String(Math.max(saldo, 0) / escala),
    "--despues": String(Math.max(despues, 0) / escala),
  } as CSSProperties;

  return (
    <div className={styles.editor} data-tipo={tipo}>
      <header className={styles.cabecera}>
        <div className={styles.origen}>
          <span className={styles.etiqueta}>{NOMBRE_DOCUMENTO[tipo]} sobre la factura</span>
          <strong className={styles.numero}>{factura.numero}</strong>
          <span className={styles.meta}>
            {factura.cliente_nombre} · {fechaYHora(factura.fecha)}
            {exonerada && <span className={styles.sello}>Exonerada</span>}
          </span>
        </div>
        <div className={styles.medidor} style={medidor} data-sube={!credito || undefined} aria-hidden="true">
          <span className={styles.etiqueta}>Saldo de la factura</span>
          <div className={styles.pista}>
            <span className={styles.relleno} />
            <span className={styles.cambio} />
          </div>
          <span className={styles.lectura}>
            {moneda(saldo)} <span className={styles.flecha}>→</span> <strong data-mal={excede || undefined}>{moneda(despues)}</strong>
          </span>
        </div>
      </header>

      <section className={styles.seccion} aria-label="Motivo">
        <div className={styles.teclas} role="radiogroup" aria-label="Motivo de la nota">
          {motivos.map((m) => (
            <button
              key={m.valor}
              type="button"
              role="radio"
              aria-checked={motivoTipo === m.valor}
              onClick={() => {
                setMotivoTipo(m.valor);
                setConfirmar(false);
                setError(null);
              }}
            >
              {m.etiqueta}
            </button>
          ))}
        </div>
        <p className={styles.ayuda}>{motivoActual.ayuda}</p>
      </section>

      <section className={styles.cuerpo}>
        {devolucion ? (
          lineas === null ? (
            <div className={styles.cargando} aria-label="Cargando líneas" />
          ) : (
            <>
              <div className={styles.cuerpoBarra}>
                <span className={styles.etiqueta}>¿Qué devuelve?</span>
                <button type="button" className={`${ui.boton} ${ui.fantasma}`} onClick={devolverTodo}>
                  Devolver todo
                </button>
              </div>
              <ul className={styles.lineas}>
                {lineas.map((l, i) => {
                  const queda = pendienteDevolver(l);
                  const n = cantidades[l.id] ?? 0;
                  return (
                    <li key={l.id} className={styles.linea} data-activa={n > 0 || undefined} data-agotada={queda <= 0 || undefined}>
                      <div className={styles.lineaInfo}>
                        <p className={styles.lineaNombre}>{l.descripcion}</p>
                        <p className={styles.lineaMeta}>
                          {l.codigo && <span>{l.codigo}</span>}
                          <span>Vendidas {cant(l.cantidad)}</span>
                          {l.devuelto > 0 && <span data-tono="devuelto">Devueltas {cant(l.devuelto)}</span>}
                          {l.exento && <span>Exento</span>}
                        </p>
                      </div>
                      {queda > 0 ? (
                        <div className={styles.cantidad}>
                          <button type="button" aria-label="Una menos" disabled={n <= 0} onClick={() => cambiarCantidad(l, n - 1)}>
                            <IconoMenos tamano={12} />
                          </button>
                          <input
                            aria-label={`Unidades a devolver de ${l.descripcion}`}
                            inputMode="decimal"
                            key={n}
                            defaultValue={n ? cant(n) : ""}
                            placeholder="0"
                            onBlur={(e) => cambiarCantidad(l, Number(e.target.value.replace(",", ".")) || 0)}
                            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                          />
                          <button type="button" aria-label="Una más" disabled={n >= queda} onClick={() => cambiarCantidad(l, n + 1)}>
                            <IconoMas tamano={12} />
                          </button>
                        </div>
                      ) : (
                        <span className={styles.agotada}>Ya devuelta</span>
                      )}
                      <strong className={styles.lineaTotal}>{n > 0 ? moneda(totales.netos[i]) : "—"}</strong>
                    </li>
                  );
                })}
              </ul>
              {hayInventario && (
                <label className={styles.reintegrar}>
                  <input type="checkbox" className={ui.casilla} checked={reintegrar} onChange={(e) => setReintegrar(e.target.checked)} />
                  <span>
                    Regresar las piezas al inventario
                    <small>Desmarcalo si vienen dañadas: la nota se emite igual.</small>
                  </span>
                </label>
              )}
            </>
          )
        ) : (
          <>
            <div className={styles.cuerpoBarra}>
              <span className={styles.etiqueta}>Montos sin ISV</span>
            </div>
            <ul className={styles.montos}>
              {montos.map((m, i) => (
                <li key={m.clave}>
                  <input
                    className={ui.campo}
                    placeholder={motivoActual.etiqueta}
                    value={m.descripcion}
                    maxLength={240}
                    aria-label="Descripción"
                    onChange={(e) => setMontos((ms) => ms.map((x) => (x.clave === m.clave ? { ...x, descripcion: e.target.value } : x)))}
                  />
                  <input
                    className={`${ui.campo} ${ui.campoMono}`}
                    placeholder="0.00"
                    inputMode="decimal"
                    value={m.monto}
                    aria-label="Monto sin ISV"
                    onChange={(e) => {
                      setConfirmar(false);
                      setMontos((ms) => ms.map((x) => (x.clave === m.clave ? { ...x, monto: e.target.value } : x)));
                    }}
                  />
                  <label className={styles.exento}>
                    <input
                      type="checkbox"
                      className={ui.casilla}
                      checked={m.exento}
                      onChange={(e) => setMontos((ms) => ms.map((x) => (x.clave === m.clave ? { ...x, exento: e.target.checked } : x)))}
                    />
                    Exento
                  </label>
                  <button
                    type="button"
                    className={`${ui.boton} ${ui.fantasma} ${ui.icono}`}
                    aria-label="Quitar línea"
                    disabled={montos.length === 1}
                    onClick={() => setMontos((ms) => ms.filter((x) => x.clave !== m.clave))}
                  >
                    <IconoPapelera tamano={13} />
                  </button>
                  {i === montos.length - 1 && montos.length < 20 && (
                    <button
                      type="button"
                      className={styles.otraLinea}
                      onClick={() => setMontos((ms) => [...ms, { clave: Math.max(...ms.map((x) => x.clave)) + 1, descripcion: "", monto: "", exento: false }])}
                    >
                      <IconoMas tamano={11} /> Otra línea
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}

        <label className={styles.motivo}>
          <span className={styles.etiqueta}>Detalle del motivo</span>
          <input
            className={ui.campo}
            value={motivo}
            maxLength={300}
            placeholder={devolucion ? "El filtro no le quedó al carro" : credito ? "Rebaja acordada con el cliente" : "Envío por encomienda a Choluteca"}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </label>
      </section>

      <footer className={styles.pie}>
        <dl className={styles.totales}>
          {totales.exento > 0 && (
            <div>
              <dt>Exento</dt>
              <dd>{moneda(totales.exento)}</dd>
            </div>
          )}
          {exonerada ? (
            <div>
              <dt>Exonerado</dt>
              <dd>{moneda(totales.exonerado)}</dd>
            </div>
          ) : (
            <>
              <div>
                <dt>Gravado 15 %</dt>
                <dd>{moneda(totales.gravado)}</dd>
              </div>
              <div>
                <dt>ISV 15 %</dt>
                <dd>{moneda(totales.isv)}</dd>
              </div>
            </>
          )}
        </dl>
        <Odometro valor={totales.total} etiqueta={`Total de la ${NOMBRE_DOCUMENTO[tipo].toLowerCase()}`} />

        {excede && (
          <p className={styles.error} role="alert">
            La nota supera lo que queda de la factura ({moneda(saldo)}).
          </p>
        )}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        {confirmar ? (
          <div className={styles.confirmar} role="alertdialog" aria-label="Confirmar emisión">
            <p>
              ¿Emitir la {NOMBRE_DOCUMENTO[tipo].toLowerCase()} por <strong>{moneda(totales.total)}</strong> a{" "}
              <strong>{factura.cliente_nombre}</strong>?
            </p>
            <p className={styles.nota}>
              Usa el siguiente número del CAI de {credito ? "notas de crédito (06)" : "notas de débito (07)"} de tu punto de emisión.
              {devolucion && hayInventario && reintegrar && " Las piezas vuelven al inventario."}
            </p>
            <div className={styles.botones}>
              <button type="button" className={`${ui.boton} ${ui.fantasma}`} onClick={() => setConfirmar(false)}>
                Volver
              </button>
              <button type="button" className={`${ui.boton} ${ui.primario}`} disabled={ocupado} autoFocus onClick={emitir}>
                {ocupado ? "Emitiendo…" : "Sí, emitir"}
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.botones}>
            <button type="button" className={`${ui.boton} ${ui.fantasma}`} onClick={onCancelar}>
              Cancelar
            </button>
            <button
              type="button"
              className={`${ui.boton} ${ui.primario}`}
              disabled={!puedeEmitir}
              title={!motivo.trim() && hayAlgo ? "Escribí el detalle del motivo" : undefined}
              onClick={() => setConfirmar(true)}
            >
              Emitir {NOMBRE_DOCUMENTO[tipo].toLowerCase()}
            </button>
          </div>
        )}
      </footer>
    </div>
  );
}
