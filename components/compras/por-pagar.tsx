"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import cobros from "@/components/cobros/cobros.module.css";
import { Tablero, type TextosTablero } from "@/components/cobros/cuentas-por-cobrar";
import { useApi } from "@/components/datos/apis";
import { MantenimientoRecurso } from "@/components/mantenimiento/mantenimiento-recurso";
import ui from "@/components/ui/controles.module.css";
import { useVentanaActual } from "@/components/ventanas/ventana";
import { VentanaFlotante } from "@/components/ventanas/ventana-flotante";
import { FORMAS_PAGO, etiquetaForma, repartirAbono, resumirCartera, type FormaPago, type ResumenCartera } from "@/lib/cobros";
import type { EstadoProveedor as Estado, PagoProveedor } from "@/lib/compras";
import { centavos, fechaDia, fechaYHora, moneda } from "@/lib/formato";
import { formatoRtn } from "@/lib/ventas";
import styles from "./compras.module.css";

const TEXTOS: TextosTablero = {
  total: "Por pagar",
  vacio: "No le debés a nadie.",
  documento: ["compra", "compras"],
  persona: ["proveedor", "proveedores"],
  semana: "Para pagar esta semana",
};

const ESTADO: Record<string, string> = { vencida: "Vencida", por_vencer: "Por vencer", al_dia: "Al día", pagada: "Pagada" };

/**
 * Compras › Por pagar: el mismo tablero de la cartera de clientes, del otro
 * lado del mostrador. Abrir un proveedor muestra lo que se le debe y el pago.
 */
export function CuentasPorPagar() {
  const api = useApi("compras");
  const madre = useVentanaActual() ?? undefined;
  const [resumen, setResumen] = useState<ResumenCartera | null>(null);
  const [version, setVersion] = useState(0);
  const [abierto, setAbierto] = useState<{ id: number; nombre: string } | null>(null);

  const cargar = useCallback(() => {
    let vivo = true;
    api
      .cartera()
      .then((cs) => vivo && setResumen(resumirCartera(cs.map((c) => ({ ...c, id_cliente: c.id_proveedor })))))
      .catch(() => vivo && setResumen(resumirCartera([])));
    return () => {
      vivo = false;
    };
  }, [api]);

  useEffect(() => cargar(), [cargar, version]);

  return (
    <div className={cobros.cartera}>
      <Tablero resumen={resumen} textos={TEXTOS} />
      <div className={cobros.tabla}>
        <MantenimientoRecurso
          recurso="cuentas_proveedores"
          puedeEditar={false}
          version={version}
          onAbrir={(f) => setAbierto({ id: Number(f.id), nombre: String(f.nombre) })}
        />
      </div>
      {abierto && (
        <VentanaFlotante
          id="estado-proveedor"
          titulo={`Por pagar · ${abierto.nombre}`}
          padre={madre}
          tamano={{ w: 980, h: 740 }}
          foco={abierto.id}
          onCerrar={() => setAbierto(null)}
        >
          <EstadoProveedor key={abierto.id} idProveedor={abierto.id} onCambio={() => setVersion((v) => v + 1)} />
        </VentanaFlotante>
      )}
    </div>
  );
}

/** Lo que se le debe a un proveedor y el registro de un pago (a las que vencen primero, o a las marcadas). */
export function EstadoProveedor({ idProveedor, onCambio }: { idProveedor: number; onCambio: () => void }) {
  const api = useApi("compras");
  const [estado, setEstado] = useState<Estado | null | undefined>(undefined);
  const [elegidas, setElegidas] = useState<Set<string>>(new Set());
  const [monto, setMonto] = useState("");
  const [forma, setForma] = useState<FormaPago>("transferencia");
  const [referencia, setReferencia] = useState("");
  const [notas, setNotas] = useState("");
  const [deCaja, setDeCaja] = useState(true);
  const [caja, setCaja] = useState<{ punto: string; turno: number } | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<{ numero: string; monto: number } | null>(null);

  useEffect(() => {
    let vivo = true;
    api
      .estadoProveedor(idProveedor)
      .then((e) => vivo && setEstado(e))
      .catch(() => vivo && setEstado(null));
    api
      .cajaAbierta()
      .then((c) => vivo && setCaja(c))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [api, idProveedor]);

  const pendientes = useMemo(() => (estado?.compras ?? []).filter((c) => c.pendiente > 0), [estado]);
  const valor = centavos(Number(monto.replace(/,/g, "")) || 0);
  const { reparto, sobrante } = useMemo(() => repartirAbono(pendientes, valor, elegidas), [pendientes, valor, elegidas]);

  if (estado === undefined) return <div className={cobros.cargandoVentana} aria-label="Cargando" />;
  if (estado === null) return <p className={cobros.vacio}>No se encontró el proveedor.</p>;

  const p = estado.proveedor;
  const tope = elegidas.size ? centavos(pendientes.filter((c) => elegidas.has(c.id)).reduce((s, c) => s + c.pendiente, 0)) : centavos(p.pendiente);
  const formaActual = FORMAS_PAGO.find((f) => f.valor === forma)!;
  const sacaDeCaja = forma === "efectivo" && deCaja && caja !== null;

  function alternar(id: string) {
    setElegidas((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
    setConfirmar(false);
  }

  async function pagar() {
    setOcupado(true);
    setError(null);
    const r = await api.pagar({
      id_proveedor: p.id,
      monto: valor,
      forma_pago: forma,
      referencia: formaActual.pideReferencia ? referencia : null,
      notas,
      de_caja: sacaDeCaja,
      aplicaciones: [...reparto].map(([id_compra, m]) => ({ id_compra, monto: m })),
    });
    setOcupado(false);
    setConfirmar(false);
    if (!r.ok) return setError(r.error);
    setHecho({ numero: r.numero, monto: valor });
    setMonto("");
    setReferencia("");
    setNotas("");
    setElegidas(new Set());
    setEstado(await api.estadoProveedor(idProveedor).catch(() => null));
    onCambio();
  }

  return (
    <div className={cobros.estado}>
      <header className={cobros.estadoCabecera}>
        <div className={cobros.estadoCliente}>
          <span className={cobros.etiqueta}>Por pagar</span>
          <h2>{p.nombre}</h2>
          <p>
            {p.rtn && <span>RTN {formatoRtn(p.rtn)}</span>}
            {p.telefono && <span>Tel. {p.telefono}</span>}
            <span>{p.dias_credito > 0 ? `Te da ${p.dias_credito} días` : "Le comprás de contado"}</span>
          </p>
        </div>
        <div className={cobros.credito}>
          <span className={cobros.etiqueta}>Le debés</span>
          <p className={cobros.lectura}>
            <strong>{moneda(p.pendiente)}</strong>
          </p>
          {p.vencido > 0 && <p className={cobros.lecturaMal}>Vencido {moneda(p.vencido)}</p>}
        </div>
      </header>

      <div className={cobros.estadoCuerpo}>
        <section className={cobros.facturas} aria-label="Compras pendientes">
          <div className={cobros.seccionBarra}>
            <span className={cobros.etiqueta}>Compras al crédito</span>
            {elegidas.size > 0 && (
              <button type="button" className={cobros.enlace} onClick={() => setElegidas(new Set())}>
                Quitar selección
              </button>
            )}
          </div>
          {estado.compras.length === 0 ? (
            <p className={cobros.vacio}>No le debés nada a este proveedor.</p>
          ) : (
            <ul className={cobros.listaFacturas}>
              {estado.compras.map((c) => {
                const paga = reparto.get(c.id) ?? 0;
                return (
                  <li key={c.id} data-estado={c.estado} data-abona={paga > 0 || undefined}>
                    <label>
                      <input
                        type="checkbox"
                        className={ui.casilla}
                        checked={elegidas.has(c.id)}
                        onChange={() => alternar(c.id)}
                        aria-label={`Pagar ${c.numero}`}
                      />
                      <span className={cobros.facturaNumero}>{c.documento ?? c.numero}</span>
                      <span className={cobros.facturaFechas}>
                        {c.numero} · {fechaDia(c.fecha)} · vence {fechaDia(c.vence)}
                        {c.dias_vencida > 0 && <b> · {c.dias_vencida} d</b>}
                      </span>
                      <span className={cobros.facturaEstado}>
                        <span className={cobros.led} aria-hidden="true" /> {ESTADO[c.estado]}
                      </span>
                      <span className={cobros.facturaMonto}>
                        <small>de {moneda(c.total)}</small>
                        {moneda(c.pendiente)}
                      </span>
                      {paga > 0 && <span className={cobros.abona}>paga {moneda(paga)}</span>}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}

          {estado.pagos.length > 0 && (
            <>
              <div className={cobros.seccionBarra}>
                <span className={cobros.etiqueta}>Últimos pagos</span>
              </div>
              <ul className={cobros.listaRecibos}>
                {estado.pagos.map((x) => (
                  <li key={x.id} data-anulado={x.estado === "anulado" || undefined}>
                    <span className={cobros.facturaNumero}>{x.numero}</span>
                    <span className={cobros.facturaFechas}>
                      {fechaYHora(x.fecha)} · {etiquetaForma(x.forma_pago)}
                      {x.estado === "anulado" && " · anulado"}
                    </span>
                    <strong>{moneda(x.monto)}</strong>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className={cobros.abono} aria-label="Registrar pago">
          <span className={cobros.etiqueta}>Registrar pago</span>
          {hecho && (
            <div className={cobros.emitido} role="status">
              <p>
                Pago <strong>{hecho.numero}</strong> por {moneda(hecho.monto)}.
              </p>
            </div>
          )}
          {p.pendiente <= 0 ? (
            <p className={cobros.vacio}>No hay nada por pagar.</p>
          ) : (
            <>
              <label className={cobros.monto}>
                <span className={cobros.montoMoneda}>L</span>
                <input
                  inputMode="decimal"
                  placeholder="0.00"
                  value={monto}
                  aria-label="Monto del pago"
                  onChange={(e) => {
                    setMonto(e.target.value.replace(/[^\d.,]/g, ""));
                    setConfirmar(false);
                    setHecho(null);
                  }}
                />
              </label>
              <div className={cobros.atajos}>
                {p.vencido > 0 && !elegidas.size && (
                  <button type="button" onClick={() => setMonto(centavos(p.vencido).toFixed(2))}>
                    Lo vencido · {moneda(p.vencido)}
                  </button>
                )}
                <button type="button" onClick={() => setMonto(tope.toFixed(2))}>
                  {elegidas.size ? "Lo marcado" : "Todo"} · {moneda(tope)}
                </button>
              </div>
              {sobrante > 0 && <p className={cobros.aviso}>Sobran {moneda(sobrante)}: solo se deben {moneda(tope)}.</p>}
              <p className={cobros.ayuda}>
                {elegidas.size
                  ? "Se reparte entre las compras marcadas, la que vence primero."
                  : "Se aplica a las compras que vencen primero. Marcá compras para elegir a cuáles."}
              </p>

              <div className={cobros.formas} role="radiogroup" aria-label="Forma de pago">
                {FORMAS_PAGO.map((f) => (
                  <button key={f.valor} type="button" role="radio" aria-checked={forma === f.valor} onClick={() => setForma(f.valor)}>
                    {f.etiqueta}
                  </button>
                ))}
              </div>
              {formaActual.pideReferencia && (
                <input
                  className={`${ui.campo} ${ui.campoMono}`}
                  placeholder={forma === "cheque" ? "N.º de cheque y banco" : "N.º de referencia"}
                  value={referencia}
                  maxLength={80}
                  aria-label="Referencia"
                  onChange={(e) => setReferencia(e.target.value)}
                />
              )}
              {forma === "efectivo" && caja && (
                <label className={styles.deCaja}>
                  <input type="checkbox" className={ui.casilla} checked={deCaja} onChange={(e) => setDeCaja(e.target.checked)} />
                  <span>
                    Sale de la caja abierta
                    <small>
                      {caja.punto} · turno {caja.turno}
                    </small>
                  </span>
                </label>
              )}
              <input
                className={ui.campo}
                placeholder="Nota (opcional)"
                value={notas}
                maxLength={300}
                aria-label="Nota del pago"
                onChange={(e) => setNotas(e.target.value)}
              />

              {error && (
                <p className={cobros.error} role="alert">
                  {error}
                </p>
              )}

              {confirmar ? (
                <div className={cobros.confirmar} role="alertdialog" aria-label="Confirmar pago">
                  <p>
                    ¿Pagar <strong>{moneda(valor)}</strong> en {etiquetaForma(forma).toLowerCase()} a <strong>{p.nombre}</strong>?
                  </p>
                  <p className={cobros.ayuda}>
                    Le quedás debiendo {moneda(centavos(p.pendiente - valor))}.{sacaDeCaja && " El efectivo sale de la caja."}
                  </p>
                  <div className={cobros.botones}>
                    <button type="button" className={`${ui.boton} ${ui.fantasma}`} onClick={() => setConfirmar(false)}>
                      Volver
                    </button>
                    <button type="button" className={`${ui.boton} ${ui.primario}`} disabled={ocupado} autoFocus onClick={pagar}>
                      {ocupado ? "Registrando…" : "Sí, pagar"}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className={`${ui.boton} ${ui.primario} ${cobros.registrar}`}
                  disabled={!(valor > 0) || sobrante > 0 || ocupado}
                  onClick={() => setConfirmar(true)}
                >
                  Registrar pago
                </button>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

/** Compras › Pagos: los pagos a proveedores. Abrir uno lo muestra y se anula (la deuda vuelve). */
export function PagosProveedores() {
  const [abierto, setAbierto] = useState<{ id: string; numero: string } | null>(null);
  const [version, setVersion] = useState(0);
  const madre = useVentanaActual() ?? undefined;
  return (
    <>
      <MantenimientoRecurso
        recurso="pagos_proveedores"
        puedeEditar={false}
        version={version}
        onAbrir={(f) => setAbierto({ id: String(f.id), numero: String(f.numero) })}
      />
      {abierto && (
        <VentanaFlotante
          id="pago-proveedor"
          titulo={abierto.numero}
          padre={madre}
          tamano={{ w: 640, h: 560 }}
          foco={abierto.id}
          onCerrar={() => setAbierto(null)}
        >
          <DetallePago key={abierto.id} id={abierto.id} onCambio={() => setVersion((v) => v + 1)} />
        </VentanaFlotante>
      )}
    </>
  );
}

function DetallePago({ id, onCambio }: { id: string; onCambio: () => void }) {
  const api = useApi("compras");
  const [pago, setPago] = useState<PagoProveedor | null | undefined>(undefined);
  const [anulando, setAnulando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    api
      .pago(id)
      .then((p) => vivo && setPago(p))
      .catch(() => vivo && setPago(null));
    return () => {
      vivo = false;
    };
  }, [api, id]);

  async function anular() {
    const r = await api.anularPago(id, motivo);
    if (!r.ok) return setAviso(r.error);
    setAnulando(false);
    setPago(await api.pago(id));
    onCambio();
  }

  if (pago === undefined) return <div className={styles.cargando} aria-label="Cargando" />;
  if (pago === null) return <p className={styles.error}>No se encontró el pago.</p>;

  return (
    <div className={styles.vista}>
      {pago.estado === "emitido" && !anulando && (
        <div className={styles.vistaBarra}>
          <button type="button" className={`${ui.boton} ${ui.fantasma} ${ui.peligro}`} onClick={() => setAnulando(true)}>
            Anular pago
          </button>
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
            Sí, anular: la deuda vuelve
          </button>
        </form>
      )}
      {aviso && <p className={styles.error}>{aviso}</p>}
      <article className={styles.ficha}>
        <header className={styles.fichaCabeza}>
          <div>
            <span className={styles.etiqueta}>Pago a proveedor</span>
            <h2>{pago.proveedor_nombre}</h2>
            <span className={styles.ayuda}>
              {fechaYHora(pago.fecha)} · {etiquetaForma(pago.forma_pago)}
              {pago.de_caja && " (de la caja)"}
              {pago.referencia && ` · ${pago.referencia}`}
            </span>
          </div>
          <div>
            <div className={styles.numero}>{pago.numero}</div>
            {pago.estado === "anulado" && <span className={styles.anulada}>Anulado</span>}
          </div>
        </header>
        <table className={styles.tabla}>
          <thead>
            <tr>
              <th scope="col">Compra</th>
              <th scope="col">Factura</th>
              <th scope="col" data-num="">
                Total
              </th>
              <th scope="col" data-num="">
                Pagado
              </th>
            </tr>
          </thead>
          <tbody>
            {pago.aplicaciones.map((a) => (
              <tr key={a.id_compra}>
                <td>{a.numero}</td>
                <td>{a.documento ?? "—"}</td>
                <td data-num="">{moneda(a.total)}</td>
                <td data-num="">{moneda(a.monto)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className={styles.sumas}>
          <div>
            <dt>Monto</dt>
            <dd>{moneda(pago.monto)}</dd>
          </div>
        </dl>
        {pago.notas && <p className={styles.ayuda}>Nota: {pago.notas}</p>}
        {pago.estado === "anulado" && pago.motivo_anulacion && <p className={styles.ayuda}>Motivo de anulación: {pago.motivo_anulacion}</p>}
        {pago.pago && <p className={styles.ayuda}>Registró: {pago.pago}</p>}
      </article>
    </div>
  );
}
