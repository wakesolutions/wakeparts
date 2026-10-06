"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useApi } from "@/components/datos/apis";
import ui from "@/components/ui/controles.module.css";
import { IconoMas, IconoMenos, IconoPapelera } from "@/components/ui/iconos";
import { FORMAS_PAGO, type FormaPago } from "@/lib/cobros";
import { cant, centavos, fechaYHora, moneda } from "@/lib/formato";
import {
  formatoRtn,
  motivosNota,
  NOMBRE_DOCUMENTO,
  pendienteDevolver,
  totalesNota,
  type Cliente,
  type Documento,
  type LineaAcreditable,
  type MotivoNota,
  type TipoNota,
} from "@/lib/ventas";
import { Odometro } from "./odometro";
import styles from "./nota-editor.module.css";

type Monto = { clave: number; descripcion: string; monto: string; exento: boolean };

/** A nombre de quién va una nota sin factura: un cliente registrado o nombre y RTN libres. */
type ClienteNota = { id: number | null; nombre: string; rtn: string };

/** Saldo de una factura: total + notas de débito − notas de crédito vigentes (igual que saldo_factura()). */
export function saldoFactura(doc: Documento) {
  const notas = (doc.notasRelacionadas ?? []).filter((n) => n.estado === "emitido");
  return centavos(
    notas.reduce((s, n) => s + (n.tipo === "nota_debito" ? n.total : -n.total), doc.total),
  );
}

const numero = (texto: string) => Number(texto.replace(",", ".")) || 0;

/**
 * Nota de crédito o débito. Sobre una factura emitida: devolución (unidades de
 * sus líneas, y si regresan al inventario) o montos sin ISV; calcula igual que
 * emitir_nota() y muestra cómo queda el saldo. Sin factura (`factura` null,
 * 0019): montos sin ISV a nombre de un cliente y cómo se liquida, igual que
 * emitir_nota_libre().
 */
export function NotaEditor({
  factura,
  tipo,
  onEmitida,
  onCancelar,
}: {
  factura: Documento | null;
  tipo: TipoNota;
  onEmitida: (id: string, numero: string) => void;
  onCancelar: () => void;
}) {
  const api = useApi("ventas");
  const credito = tipo === "nota_credito";
  const libre = factura === null;
  const motivos = motivosNota(tipo, !libre);
  const [motivoTipo, setMotivoTipo] = useState<MotivoNota>(motivos[0].valor);
  const [motivo, setMotivo] = useState("");
  const [lineas, setLineas] = useState<LineaAcreditable[] | null>(null);
  const [cantidades, setCantidades] = useState<Record<number, number>>({});
  const [montos, setMontos] = useState<Monto[]>([{ clave: 1, descripcion: "", monto: "", exento: false }]);
  const [reintegrar, setReintegrar] = useState(true);
  const [cliente, setCliente] = useState<ClienteNota>({ id: null, nombre: "", rtn: "" });
  // undefined = todavía no eligió; null = la nota no mueve dinero.
  const [liquidacion, setLiquidacion] = useState<FormaPago | null | undefined>(undefined);
  const [referencia, setReferencia] = useState("");
  const [confirmar, setConfirmar] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const devolucion = motivoTipo === "devolucion";
  const exonerada = factura?.exoneracion != null;
  const saldo = factura ? saldoFactura(factura) : 0;
  const idFactura = factura?.id ?? null;
  const nombreCliente = factura ? factura.cliente_nombre : cliente.nombre.trim() || "Consumidor final";

  useEffect(() => {
    if (!credito || !idFactura) return;
    let vivo = true;
    api
      .lineasAcreditables(idFactura)
      .then((l) => vivo && setLineas(l))
      .catch(() => vivo && setLineas([]));
    return () => {
      vivo = false;
    };
  }, [api, credito, idFactura]);

  const totales = useMemo(
    () =>
      devolucion
        ? totalesNota(
            (lineas ?? []).map((linea) => ({ linea, cantidad: cantidades[linea.id] ?? 0 })),
            exonerada,
          )
        : totalesNota(
            montos.map((m) => ({ monto: numero(m.monto), exento: m.exento })),
            exonerada,
          ),
    [devolucion, lineas, cantidades, montos, exonerada],
  );

  const despues = centavos(credito ? saldo - totales.total : saldo + totales.total);
  const excede = !libre && credito && totales.total > saldo + 0.02;
  const hayAlgo = totales.total > 0;
  const rtnLibre = cliente.id ? "" : cliente.rtn.replace(/\D/g, "");
  const rtnMal = rtnLibre.length > 0 && rtnLibre.length !== 14;
  const faltaLiquidar = libre && liquidacion === undefined;
  const puedeEmitir = hayAlgo && motivo.trim().length > 0 && !excede && !rtnMal && !faltaLiquidar && !ocupado;
  const hayInventario = devolucion && (lineas ?? []).some((l) => l.controla_inventario && (cantidades[l.id] ?? 0) > 0);
  const motivoActual = motivos.find((m) => m.valor === motivoTipo)!;
  const formaActual = FORMAS_PAGO.find((f) => f.valor === liquidacion);

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

  const montosValidos = () =>
    montos
      .filter((m) => numero(m.monto) > 0)
      .map((m) => ({
        descripcion: m.descripcion.trim() || motivoActual.etiqueta,
        monto: numero(m.monto),
        exento: m.exento,
      }));

  async function emitir() {
    setOcupado(true);
    setError(null);
    const r = factura
      ? await api.emitirNota(factura.id, {
          tipo,
          motivo_tipo: motivoTipo,
          motivo: motivo.trim(),
          reintegrar: devolucion && reintegrar,
          lineas: devolucion
            ? (lineas ?? [])
                .filter((l) => (cantidades[l.id] ?? 0) > 0)
                .map((l) => ({ id_linea: l.id, cantidad: cantidades[l.id] }))
            : montosValidos(),
        })
      : await api.emitirNotaLibre({
          tipo,
          motivo_tipo: motivoTipo,
          motivo: motivo.trim(),
          id_cliente: cliente.id,
          cliente_nombre: cliente.id ? null : cliente.nombre.trim() || null,
          cliente_rtn: cliente.id ? null : rtnLibre || null,
          lineas: montosValidos(),
          forma_pago: liquidacion ?? null,
          referencia_pago: formaActual?.pideReferencia ? referencia.trim() || null : null,
        });
    setOcupado(false);
    if (!r.ok) {
      setConfirmar(false);
      return setError(r.error);
    }
    onEmitida(r.id, r.numero);
  }

  // Medidor de saldo: cuánto de la factura queda después de la nota.
  const escala = Math.max(factura?.total ?? 0, saldo, despues, 0.01);
  const medidor = {
    "--antes": String(Math.max(saldo, 0) / escala),
    "--despues": String(Math.max(despues, 0) / escala),
  } as CSSProperties;

  return (
    <div className={styles.editor} data-tipo={tipo}>
      {factura ? (
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
              {moneda(saldo)} <span className={styles.flecha}>→</span>{" "}
              <strong data-mal={excede || undefined}>{moneda(despues)}</strong>
            </span>
          </div>
        </header>
      ) : (
        <header className={styles.cabecera}>
          <ElegirCliente
            cliente={cliente}
            rtnMal={rtnMal}
            onCambiar={(c) => {
              setCliente(c);
              setConfirmar(false);
            }}
          />
          <div className={styles.sinFactura}>
            <span className={styles.etiqueta}>Sin factura relacionada</span>
            <p>No cambia el saldo de ninguna factura ni las cuentas por cobrar.</p>
          </div>
        </header>
      )}

      <section className={styles.seccion} aria-label="Motivo">
        <div className={styles.teclas} role="radiogroup" aria-label="Motivo de la nota" data-n={motivos.length}>
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
                            onBlur={(e) => cambiarCantidad(l, numero(e.target.value))}
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

        {libre && (
          <fieldset className={styles.liquidar}>
            <legend className={styles.etiqueta}>{credito ? "¿Cómo se le devuelve?" : "¿Cómo lo paga?"}</legend>
            <div className={styles.teclas} role="radiogroup" aria-label="Cómo se liquida la nota" data-n={FORMAS_PAGO.length + 1}>
              {FORMAS_PAGO.map((f) => (
                <button
                  key={f.valor}
                  type="button"
                  role="radio"
                  aria-checked={liquidacion === f.valor}
                  onClick={() => {
                    setLiquidacion(f.valor);
                    setConfirmar(false);
                  }}
                >
                  {f.etiqueta}
                </button>
              ))}
              <button
                type="button"
                role="radio"
                aria-checked={liquidacion === null}
                onClick={() => {
                  setLiquidacion(null);
                  setConfirmar(false);
                }}
              >
                Sin dinero
              </button>
            </div>
            <p className={styles.ayuda}>
              {liquidacion === undefined
                ? "Elegí cómo se liquida: con una forma de pago, la nota cae en tu caja abierta."
                : liquidacion === null
                  ? "Solo el documento: no entra ni sale dinero de la caja."
                  : `${credito ? "Sale de" : "Entra a"} la caja en ${formaActual!.etiqueta.toLowerCase()}.`}
            </p>
            {formaActual?.pideReferencia && (
              <input
                className={`${ui.campo} ${ui.campoMono}`}
                placeholder="Referencia (opcional)"
                value={referencia}
                maxLength={80}
                aria-label="Referencia del pago"
                onChange={(e) => setReferencia(e.target.value)}
              />
            )}
          </fieldset>
        )}
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
              <strong>{nombreCliente}</strong>?
            </p>
            <p className={styles.nota}>
              Usa el siguiente número del CAI de {credito ? "notas de crédito (06)" : "notas de débito (07)"} de tu punto de emisión.
              {devolucion && hayInventario && reintegrar && " Las piezas vuelven al inventario."}
              {libre && " Sin factura relacionada."}
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
              title={
                hayAlgo && !motivo.trim()
                  ? "Escribí el detalle del motivo"
                  : hayAlgo && faltaLiquidar
                    ? "Elegí cómo se liquida"
                    : undefined
              }
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

/**
 * Cliente de una nota sin factura: buscador de clientes registrados, o nombre y
 * RTN escritos a mano (vacío = consumidor final).
 */
function ElegirCliente({
  cliente,
  rtnMal,
  onCambiar,
}: {
  cliente: ClienteNota;
  rtnMal: boolean;
  onCambiar: (c: ClienteNota) => void;
}) {
  const api = useApi("ventas");
  const [abierto, setAbierto] = useState(false);
  const [sugerencias, setSugerencias] = useState<Cliente[]>([]);
  const termino = cliente.id ? "" : cliente.nombre || cliente.rtn;

  useEffect(() => {
    if (!abierto) return;
    let vivo = true;
    const t = setTimeout(() => {
      api
        .clientes(termino)
        .then((s) => vivo && setSugerencias(s))
        .catch(() => {});
    }, 160);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [api, abierto, termino]);

  if (cliente.id) {
    return (
      <div className={styles.origen}>
        <span className={styles.etiqueta}>Cliente</span>
        <strong className={styles.clienteNombre}>{cliente.nombre}</strong>
        <span className={styles.meta}>
          {cliente.rtn ? `RTN ${formatoRtn(cliente.rtn)}` : "Sin RTN"}
          <button type="button" className={styles.cambiar} onClick={() => onCambiar({ id: null, nombre: "", rtn: "" })}>
            Cambiar
          </button>
        </span>
      </div>
    );
  }

  return (
    <div className={styles.origen}>
      <span className={styles.etiqueta}>Cliente</span>
      <div className={styles.clienteCampos}>
        <input
          className={ui.campo}
          placeholder="Consumidor final · buscá o escribí"
          value={cliente.nombre}
          maxLength={160}
          aria-label="Nombre del cliente"
          onFocus={() => setAbierto(true)}
          onBlur={() => setAbierto(false)}
          onChange={(e) => onCambiar({ id: null, nombre: e.target.value, rtn: cliente.rtn })}
        />
        <input
          className={`${ui.campo} ${ui.campoMono}`}
          placeholder="RTN (opcional)"
          inputMode="numeric"
          value={cliente.rtn}
          maxLength={16}
          aria-label="RTN del cliente"
          aria-invalid={rtnMal || undefined}
          onChange={(e) => onCambiar({ id: null, nombre: cliente.nombre, rtn: e.target.value })}
        />
      </div>
      {rtnMal && <span className={styles.rtnMal}>El RTN son 14 dígitos.</span>}
      {abierto && sugerencias.length > 0 && (
        <ul className={styles.sugerencias} aria-label="Clientes registrados">
          {sugerencias.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                // Antes del blur del campo, para que la lista no se cierre primero.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onCambiar({ id: c.id, nombre: c.nombre, rtn: c.rtn ?? "" });
                  setAbierto(false);
                }}
              >
                <span>{c.nombre}</span>
                <small>{c.rtn ? formatoRtn(c.rtn) : (c.telefono ?? "")}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
