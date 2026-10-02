"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useApi } from "@/components/datos/apis";
import ui from "@/components/ui/controles.module.css";
import { IconoImprimir } from "@/components/ui/iconos";
import {
  FORMAS_PAGO,
  etiquetaForma,
  repartirAbono,
  type EstadoDeCuenta,
  type FormaPago,
} from "@/lib/cobros";
import { centavos, fechaDia, fechaYHora, moneda } from "@/lib/formato";
import { formatoRtn } from "@/lib/ventas";
import styles from "./cobros.module.css";
import { urlImprimir } from "@/lib/impresion";

const ESTADO: Record<string, string> = {
  vencida: "Vencida",
  por_vencer: "Por vencer",
  al_dia: "Al día",
  pagada: "A favor",
};

/**
 * Estado de cuenta de un cliente: su crédito (medidor usado / límite), las
 * facturas pendientes y el registro de un abono. El reparto que se ve (a las
 * más antiguas primero, o a las marcadas) es exactamente el que se guarda.
 */
export function EstadoCuenta({ idCliente, onCambio }: { idCliente: number; onCambio: () => void }) {
  const api = useApi("cobros");
  const [estado, setEstado] = useState<EstadoDeCuenta | null | undefined>(undefined);
  const [elegidas, setElegidas] = useState<Set<string>>(new Set());
  const [monto, setMonto] = useState("");
  const [forma, setForma] = useState<FormaPago>("efectivo");
  const [referencia, setReferencia] = useState("");
  const [notas, setNotas] = useState("");
  const [confirmar, setConfirmar] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emitido, setEmitido] = useState<{ id: string; numero: string; monto: number } | null>(null);

  async function recargar() {
    setEstado(await api.estadoDeCuenta(idCliente).catch(() => null));
  }

  useEffect(() => {
    let vivo = true;
    api
      .estadoDeCuenta(idCliente)
      .then((e) => vivo && setEstado(e))
      .catch(() => vivo && setEstado(null));
    return () => {
      vivo = false;
    };
  }, [api, idCliente]);

  const pendientes = useMemo(() => (estado?.facturas ?? []).filter((f) => f.pendiente > 0), [estado]);
  const valor = centavos(Number(monto.replace(/,/g, "")) || 0);
  const { reparto, sobrante } = useMemo(() => repartirAbono(pendientes, valor, elegidas), [pendientes, valor, elegidas]);

  if (estado === undefined) return <div className={styles.cargandoVentana} aria-label="Cargando" />;
  if (estado === null) return <p className={styles.vacio}>No se encontró la cuenta del cliente.</p>;

  const c = estado.cliente;
  const vencidas = pendientes.filter((f) => f.estado === "vencida");
  const totalVencido = centavos(vencidas.reduce((s, f) => s + f.pendiente, 0));
  const tope = elegidas.size ? centavos(pendientes.filter((f) => elegidas.has(f.id)).reduce((s, f) => s + f.pendiente, 0)) : c.pendiente;
  const formaActual = FORMAS_PAGO.find((f) => f.valor === forma)!;
  const puedeAbonar = valor > 0 && sobrante <= 0 && !ocupado;

  // Medidor de crédito: lo usado contra el límite (o contra lo pendiente si no hay límite).
  const limite = c.limite_credito;
  const escala = Math.max(limite ?? 0, c.pendiente, 0.01);
  const medidor = {
    "--usado": String(Math.max(Math.min(c.pendiente / escala, 1), 0)),
    "--vencido": String(Math.max(Math.min(c.vencido / escala, 1), 0)),
  } as CSSProperties;

  function alternar(id: string) {
    setElegidas((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
    setConfirmar(false);
  }

  async function registrar() {
    setOcupado(true);
    setError(null);
    const r = await api.registrarAbono({
      id_cliente: c.id,
      monto: valor,
      forma_pago: forma,
      referencia: formaActual.pideReferencia ? referencia : null,
      notas,
      aplicaciones: [...reparto].map(([id_documento, m]) => ({ id_documento, monto: m })),
    });
    setOcupado(false);
    setConfirmar(false);
    if (!r.ok) return setError(r.error);
    setEmitido({ id: r.id, numero: r.numero, monto: valor });
    setMonto("");
    setReferencia("");
    setNotas("");
    setElegidas(new Set());
    await recargar();
    onCambio();
  }

  return (
    <div className={styles.estado}>
      <header className={styles.estadoCabecera}>
        <div className={styles.estadoCliente}>
          <span className={styles.etiqueta}>Estado de cuenta</span>
          <h2>{c.nombre}</h2>
          <p>
            {c.rtn && <span>RTN {formatoRtn(c.rtn)}</span>}
            {c.telefono && <span>Tel. {c.telefono}</span>}
            <span>{c.credito_habilitado ? `Crédito a ${c.dias_credito} días` : "Sin crédito habilitado"}</span>
          </p>
        </div>
        <div className={styles.credito} style={medidor} aria-label="Uso del crédito">
          <span className={styles.etiqueta}>{limite === null ? "Debe (sin límite)" : "Crédito usado"}</span>
          <div className={styles.pista} data-excedido={(limite !== null && c.pendiente > limite) || undefined}>
            <span className={styles.usado} />
            <span className={styles.vencidoPista} />
          </div>
          <p className={styles.lectura}>
            <strong>{moneda(c.pendiente)}</strong>
            {limite !== null && (
              <>
                {" "}
                de {moneda(limite)} · <span data-mal={(c.disponible ?? 0) < 0 || undefined}>disponible {moneda(c.disponible ?? 0)}</span>
              </>
            )}
          </p>
          {c.vencido > 0 && (
            <p className={styles.lecturaMal}>
              Vencido {moneda(c.vencido)} · {c.dias_mora} {c.dias_mora === 1 ? "día" : "días"} de mora
            </p>
          )}
        </div>
      </header>

      <div className={styles.estadoCuerpo}>
        <section className={styles.facturas} aria-label="Facturas pendientes">
          <div className={styles.seccionBarra}>
            <span className={styles.etiqueta}>Facturas al crédito</span>
            {elegidas.size > 0 && (
              <button type="button" className={styles.enlace} onClick={() => setElegidas(new Set())}>
                Quitar selección
              </button>
            )}
          </div>
          {estado.facturas.length === 0 ? (
            <p className={styles.vacio}>Este cliente no debe nada.</p>
          ) : (
            <ul className={styles.listaFacturas}>
              {estado.facturas.map((f) => {
                const abona = reparto.get(f.id) ?? 0;
                const marcable = f.pendiente > 0;
                return (
                  <li key={f.id} data-estado={f.estado} data-abona={abona > 0 || undefined}>
                    <label>
                      <input
                        type="checkbox"
                        className={ui.casilla}
                        checked={elegidas.has(f.id)}
                        disabled={!marcable}
                        onChange={() => alternar(f.id)}
                        aria-label={`Abonar a ${f.numero}`}
                      />
                      <span className={styles.facturaNumero}>{f.numero}</span>
                      <span className={styles.facturaFechas}>
                        {fechaDia(f.fecha)} · vence {fechaDia(f.vence)}
                        {f.dias_vencida > 0 && <b> · {f.dias_vencida} d</b>}
                      </span>
                      <span className={styles.facturaEstado}>
                        <span className={styles.led} aria-hidden="true" /> {ESTADO[f.estado]}
                      </span>
                      <span className={styles.facturaMonto}>
                        <small>de {moneda(f.total + f.debitos - f.creditos)}</small>
                        {moneda(f.pendiente)}
                      </span>
                      {abona > 0 && <span className={styles.abona}>abona {moneda(abona)}</span>}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}

          {estado.recibos.length > 0 && (
            <>
              <div className={styles.seccionBarra}>
                <span className={styles.etiqueta}>Últimos abonos</span>
              </div>
              <ul className={styles.listaRecibos}>
                {estado.recibos.map((r) => (
                  <li key={r.id} data-anulado={r.estado === "anulado" || undefined}>
                    <span className={styles.facturaNumero}>{r.numero}</span>
                    <span className={styles.facturaFechas}>
                      {fechaYHora(r.fecha)} · {etiquetaForma(r.forma_pago)}
                      {r.estado === "anulado" && " · anulado"}
                    </span>
                    <strong>{moneda(r.monto)}</strong>
                    <a href={urlImprimir(api.urlRecibo(r.id))} target="_blank" rel="noopener" aria-label={`Imprimir ${r.numero}`}>
                      <IconoImprimir tamano={13} />
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className={styles.abono} aria-label="Registrar abono">
          <span className={styles.etiqueta}>Registrar abono</span>
          {emitido && (
            <div className={styles.emitido} role="status">
              <p>
                Recibo <strong>{emitido.numero}</strong> por {moneda(emitido.monto)}.
              </p>
              <a className={`${ui.boton} ${ui.primario}`} href={urlImprimir(api.urlRecibo(emitido.id))} target="_blank" rel="noopener">
                <IconoImprimir tamano={14} /> Imprimir recibo
              </a>
            </div>
          )}
          {c.pendiente <= 0 ? (
            <p className={styles.vacio}>{c.pendiente < 0 ? `Tiene ${moneda(-c.pendiente)} a favor.` : "No hay nada por cobrar."}</p>
          ) : (
            <>
              <label className={styles.monto}>
                <span className={styles.montoMoneda}>L</span>
                <input
                  inputMode="decimal"
                  placeholder="0.00"
                  value={monto}
                  aria-label="Monto del abono"
                  onChange={(e) => {
                    setMonto(e.target.value.replace(/[^\d.,]/g, ""));
                    setConfirmar(false);
                    setEmitido(null);
                  }}
                />
              </label>
              <div className={styles.atajos}>
                {totalVencido > 0 && !elegidas.size && (
                  <button type="button" onClick={() => setMonto(totalVencido.toFixed(2))}>
                    Lo vencido · {moneda(totalVencido)}
                  </button>
                )}
                <button type="button" onClick={() => setMonto(tope.toFixed(2))}>
                  {elegidas.size ? "Lo marcado" : "Todo"} · {moneda(tope)}
                </button>
              </div>
              {sobrante > 0 && (
                <p className={styles.aviso}>
                  Sobran {moneda(sobrante)}: {elegidas.size ? "las facturas marcadas" : "el cliente"} solo {elegidas.size ? "deben" : "debe"} {moneda(tope)}.
                </p>
              )}
              <p className={styles.ayuda}>
                {elegidas.size
                  ? "Se reparte entre las facturas marcadas, la más antigua primero."
                  : "Se aplica a las facturas más antiguas primero. Marcá facturas para elegir a cuáles."}
              </p>

              <div className={styles.formas} role="radiogroup" aria-label="Forma de pago">
                {FORMAS_PAGO.map((f) => (
                  <button key={f.valor} type="button" role="radio" aria-checked={forma === f.valor} onClick={() => setForma(f.valor)}>
                    {f.etiqueta}
                  </button>
                ))}
              </div>
              {formaActual.pideReferencia && (
                <input
                  className={`${ui.campo} ${ui.campoMono}`}
                  placeholder={forma === "cheque" ? "N.º de cheque y banco" : "N.º de referencia o autorización"}
                  value={referencia}
                  maxLength={80}
                  onChange={(e) => setReferencia(e.target.value)}
                  aria-label="Referencia"
                />
              )}
              <input
                className={ui.campo}
                placeholder="Nota (opcional)"
                value={notas}
                maxLength={300}
                onChange={(e) => setNotas(e.target.value)}
                aria-label="Nota del abono"
              />

              {error && (
                <p className={styles.error} role="alert">
                  {error}
                </p>
              )}

              {confirmar ? (
                <div className={styles.confirmar} role="alertdialog" aria-label="Confirmar abono">
                  <p>
                    ¿Registrar <strong>{moneda(valor)}</strong> en {etiquetaForma(forma).toLowerCase()} de <strong>{c.nombre}</strong>?
                  </p>
                  <p className={styles.ayuda}>
                    Queda debiendo {moneda(centavos(c.pendiente - valor))}. Se emite un recibo numerado (sin valor fiscal).
                  </p>
                  <div className={styles.botones}>
                    <button type="button" className={`${ui.boton} ${ui.fantasma}`} onClick={() => setConfirmar(false)}>
                      Volver
                    </button>
                    <button type="button" className={`${ui.boton} ${ui.primario}`} disabled={ocupado} autoFocus onClick={registrar}>
                      {ocupado ? "Registrando…" : "Sí, registrar"}
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" className={`${ui.boton} ${ui.primario} ${styles.registrar}`} disabled={!puedeAbonar} onClick={() => setConfirmar(true)}>
                  Registrar abono
                </button>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
