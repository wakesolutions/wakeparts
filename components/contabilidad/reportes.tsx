"use client";

import { useEffect, useMemo, useState } from "react";
import { useApi } from "@/components/datos/apis";
import inv from "@/components/inventario/inventario.module.css";
import ui from "@/components/ui/controles.module.css";
import { hoyIso } from "@/lib/compras";
import {
  arbolBalanza,
  balanceGeneral,
  estadoResultados,
  rangoMes,
  type CuentaBreve,
  type FilaBalanza,
  type Mayor,
  type Periodo,
} from "@/lib/contabilidad";
import { fechaDia, moneda } from "@/lib/formato";
import { Nivel } from "./nivel";
import { ElegirCuenta } from "./nuevo-asiento";
import styles from "./contabilidad.module.css";

const NOMBRE_MES = new Intl.DateTimeFormat("es-HN", { month: "long", year: "numeric", timeZone: "UTC" });
const nombreMes = (mes: string) => NOMBRE_MES.format(new Date(`${mes}-15T12:00:00Z`));

/** Selector de período: un mes o un rango libre. */
function Periodo({ desde, hasta, onCambiar }: { desde: string; hasta: string; onCambiar: (d: string, h: string) => void }) {
  const mesActual = hoyIso().slice(0, 7);
  const meses = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(`${mesActual}-15T12:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() - i);
    return d.toISOString().slice(0, 7);
  });
  const mesElegido = meses.find((m) => {
    const r = rangoMes(m);
    return r.desde === desde && (r.hasta === hasta || (m === mesActual && hasta === hoyIso()));
  });
  return (
    <div className={styles.periodo}>
      <label className={styles.campo}>
        <span className={styles.etiqueta}>Mes</span>
        <select
          className={ui.campo}
          value={mesElegido ?? ""}
          onChange={(e) => {
            if (!e.target.value) return;
            const r = rangoMes(e.target.value);
            onCambiar(r.desde, e.target.value === mesActual ? hoyIso() : r.hasta);
          }}
        >
          <option value="">Rango libre</option>
          {meses.map((m) => (
            <option key={m} value={m}>
              {nombreMes(m)}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.campo}>
        <span className={styles.etiqueta}>Desde</span>
        <input type="date" className={`${ui.campo} ${ui.campoMono}`} value={desde} max={hasta} onChange={(e) => e.target.value && onCambiar(e.target.value, hasta)} />
      </label>
      <label className={styles.campo}>
        <span className={styles.etiqueta}>Hasta</span>
        <input type="date" className={`${ui.campo} ${ui.campoMono}`} value={hasta} min={desde} onChange={(e) => e.target.value && onCambiar(desde, e.target.value)} />
      </label>
    </div>
  );
}

const inicioMes = () => `${hoyIso().slice(0, 7)}-01`;

/** Contabilidad › Balanza: comprobación (árbol), estado de resultados y balance general. */
export function Balanza() {
  const api = useApi("contabilidad");
  const [desde, setDesde] = useState(inicioMes);
  const [hasta, setHasta] = useState(hoyIso);
  const [vista, setVista] = useState<"comprobacion" | "resultados" | "balance">("comprobacion");
  const [filas, setFilas] = useState<FilaBalanza[] | null | undefined>(undefined);
  const [conCero, setConCero] = useState(false);

  useEffect(() => {
    let vivo = true;
    api
      .balanza(desde, hasta)
      .then((f) => vivo && setFilas(f))
      .catch(() => vivo && setFilas(null));
    return () => {
      vivo = false;
    };
  }, [api, desde, hasta]);

  const arbol = useMemo(() => (filas ? arbolBalanza(filas) : []), [filas]);
  const visibles = conCero ? arbol : arbol.filter((n) => n.saldo_inicial || n.debe || n.haber || n.saldo_final);
  const detalle = filas?.filter((f) => !filas.some((h) => h.id_padre === f.id)) ?? [];
  const debe = detalle.reduce((s, f) => s + f.debe, 0);
  const haber = detalle.reduce((s, f) => s + f.haber, 0);

  return (
    <div className={styles.reporte}>
      <header className={styles.reporteCabecera}>
        <Periodo
          desde={desde}
          hasta={hasta}
          onCambiar={(d, h) => {
            setDesde(d);
            setHasta(h);
          }}
        />
        <div className={inv.segmento} role="radiogroup" aria-label="Reporte">
          {(
            [
              ["comprobacion", "Comprobación"],
              ["resultados", "Resultados"],
              ["balance", "Balance general"],
            ] as const
          ).map(([v, e]) => (
            <button key={v} type="button" role="radio" aria-checked={vista === v} onClick={() => setVista(v)}>
              {e}
            </button>
          ))}
        </div>
      </header>

      {filas === undefined ? (
        <div className={styles.cargando} aria-label="Cargando" />
      ) : filas === null ? (
        <p className={styles.vacio}>No se pudo leer la contabilidad. ¿Falta ejecutar la migración 0022?</p>
      ) : vista === "comprobacion" ? (
        <>
          <Nivel debe={debe} haber={haber} compacto />
          <label className={styles.conCero}>
            <input type="checkbox" className={ui.casilla} checked={conCero} onChange={(e) => setConCero(e.target.checked)} />
            Mostrar cuentas sin movimiento
          </label>
          <div className={styles.tablaScroll}>
            <table className={styles.tabla}>
              <thead>
                <tr>
                  <th scope="col">Cuenta</th>
                  <th scope="col" data-num="">
                    Saldo inicial
                  </th>
                  <th scope="col" data-num="">
                    Debe
                  </th>
                  <th scope="col" data-num="">
                    Haber
                  </th>
                  <th scope="col" data-num="">
                    Saldo final
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((n) => (
                  <tr key={n.id} data-grupo={n.grupo || undefined} data-nivel={Math.min(n.nivel, 3)}>
                    <th scope="row" style={{ paddingLeft: `${0.5 + n.nivel * 1.1}rem` }}>
                      <b>{n.codigo}</b> {n.nombre}
                    </th>
                    <td data-num="">{n.saldo_inicial ? moneda(n.saldo_inicial) : "—"}</td>
                    <td data-num="">{n.debe ? moneda(n.debe) : "—"}</td>
                    <td data-num="">{n.haber ? moneda(n.haber) : "—"}</td>
                    <td data-num="" data-negativo={n.saldo_final < 0 || undefined}>
                      {n.saldo_final ? moneda(n.saldo_final) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Sumas</th>
                  <td />
                  <td data-num="">{moneda(debe)}</td>
                  <td data-num="">{moneda(haber)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      ) : vista === "resultados" ? (
        <Resultados filas={filas} />
      ) : (
        <BalanceGeneral filas={filas} hasta={hasta} />
      )}
    </div>
  );
}

function Resultados({ filas }: { filas: FilaBalanza[] }) {
  const r = estadoResultados(filas);
  const renglones: [string, number, "suma" | "resta" | "total"][] = [
    ["Ingresos (ventas netas y otros)", r.ingresos, "suma"],
    ["− Costo de ventas", r.costos, "resta"],
    ["Utilidad bruta", r.bruta, "total"],
    ["− Gastos", r.gastos, "resta"],
    [r.neta >= 0 ? "Utilidad del período" : "Pérdida del período", r.neta, "total"],
  ];
  return (
    <section className={styles.estado} aria-label="Estado de resultados">
      <dl>
        {renglones.map(([e, v, t]) => (
          <div key={e} data-tono={t}>
            <dt>{e}</dt>
            <dd data-negativo={v < 0 || undefined}>{moneda(v)}</dd>
          </div>
        ))}
      </dl>
      <p className={styles.ayuda}>
        Margen bruto {r.ingresos > 0 ? `${Math.round((r.bruta / r.ingresos) * 1000) / 10} %` : "—"} · Movimiento del período, sin asientos de cierre.
      </p>
    </section>
  );
}

function BalanceGeneral({ filas, hasta }: { filas: FilaBalanza[]; hasta: string }) {
  const b = balanceGeneral(filas);
  return (
    <section className={styles.estado} aria-label="Balance general">
      <p className={styles.ayuda}>Saldos acumulados al {fechaDia(hasta)}.</p>
      <dl>
        <div data-tono="total">
          <dt>Activo</dt>
          <dd>{moneda(b.activo)}</dd>
        </div>
        <div>
          <dt>Pasivo</dt>
          <dd>{moneda(b.pasivo)}</dd>
        </div>
        <div>
          <dt>Patrimonio</dt>
          <dd>{moneda(b.patrimonio)}</dd>
        </div>
        <div>
          <dt>Resultado acumulado</dt>
          <dd data-negativo={b.resultado < 0 || undefined}>{moneda(b.resultado)}</dd>
        </div>
        <div data-tono="total">
          <dt>Pasivo + patrimonio + resultado</dt>
          <dd>{moneda(b.pasivo + b.patrimonio + b.resultado)}</dd>
        </div>
      </dl>
      <p className={styles.ayuda} data-mal={!b.cuadra || undefined}>
        {b.cuadra ? "La ecuación contable cuadra." : "No cuadra: revisá la balanza de comprobación."}
        {b.activo < 0 && " Hay saldos de activo negativos: falta registrar la apertura (fondo de caja, bancos, inventario)."}
      </p>
    </section>
  );
}

/** Contabilidad › Mayor: los movimientos de una cuenta con su saldo corrido. */
export function LibroMayor() {
  const api = useApi("contabilidad");
  const [cuentas, setCuentas] = useState<CuentaBreve[] | null>(null);
  const [cuenta, setCuenta] = useState<CuentaBreve | null>(null);
  const [desde, setDesde] = useState(inicioMes);
  const [hasta, setHasta] = useState(hoyIso);
  const [mayor, setMayor] = useState<Mayor | null | undefined>(null);

  useEffect(() => {
    let vivo = true;
    api
      .cuentas()
      .then((c) => vivo && setCuentas(c))
      .catch(() => vivo && setCuentas([]));
    return () => {
      vivo = false;
    };
  }, [api]);

  useEffect(() => {
    if (!cuenta) return;
    let vivo = true;
    api
      .mayor(cuenta.id, desde, hasta)
      .then((m) => vivo && setMayor(m))
      .catch(() => vivo && setMayor(null));
    return () => {
      vivo = false;
    };
  }, [api, cuenta, desde, hasta]);

  const final = mayor ? (mayor.movimientos.at(-1)?.saldo ?? mayor.saldo_inicial) : 0;
  return (
    <div className={styles.reporte}>
      <header className={styles.reporteCabecera}>
        <div className={styles.campo} style={{ minWidth: "18rem" }}>
          <span className={styles.etiqueta}>Cuenta</span>
          <ElegirCuenta cuentas={cuentas} cuenta={cuenta} onElegir={setCuenta} />
        </div>
        <Periodo
          desde={desde}
          hasta={hasta}
          onCambiar={(d, h) => {
            setDesde(d);
            setHasta(h);
          }}
        />
      </header>
      {!cuenta ? (
        <p className={styles.vacio}>Elegí una cuenta para ver sus movimientos.</p>
      ) : mayor === undefined ? (
        <div className={styles.cargando} aria-label="Cargando" />
      ) : mayor === null ? (
        <p className={styles.vacio}>No se pudo leer el mayor.</p>
      ) : (
        <div className={styles.tablaScroll}>
          <table className={styles.tabla}>
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">N.º</th>
                <th scope="col">Concepto</th>
                <th scope="col" data-num="">
                  Debe
                </th>
                <th scope="col" data-num="">
                  Haber
                </th>
                <th scope="col" data-num="">
                  Saldo
                </th>
              </tr>
            </thead>
            <tbody>
              <tr data-grupo="">
                <td>{fechaDia(desde)}</td>
                <td />
                <td>Saldo inicial</td>
                <td />
                <td />
                <td data-num="">{moneda(mayor.saldo_inicial)}</td>
              </tr>
              {mayor.movimientos.map((m, i) => (
                <tr key={`${m.id_asiento}-${i}`}>
                  <td>{fechaDia(m.fecha)}</td>
                  <td data-num="">{m.numero}</td>
                  <td>
                    {m.concepto}
                    {m.descripcion && <small className={styles.ayuda}> · {m.descripcion}</small>}
                  </td>
                  <td data-num="">{m.debe ? moneda(m.debe) : ""}</td>
                  <td data-num="">{m.haber ? moneda(m.haber) : ""}</td>
                  <td data-num="" data-negativo={m.saldo < 0 || undefined}>
                    {moneda(m.saldo)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" colSpan={5}>
                  Saldo al {fechaDia(hasta)}
                </th>
                <td data-num="">{moneda(final)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

/** Contabilidad › Cierre de mes: qué meses están cerrados, y herramientas de arranque. */
export function CierreMes({ esDueno }: { esDueno: boolean }) {
  const api = useApi("contabilidad");
  const [periodos, setPeriodos] = useState<Periodo[] | null>(null);
  const [version, setVersion] = useState(0);
  const [aviso, setAviso] = useState<{ tono: "ok" | "error"; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const mesActual = hoyIso().slice(0, 7);

  useEffect(() => {
    let vivo = true;
    api
      .periodos()
      .then((p) => vivo && setPeriodos(p))
      .catch(() => vivo && setPeriodos([]));
    return () => {
      vivo = false;
    };
  }, [api, version]);

  async function hacer(f: () => Promise<{ ok: true } | { ok: false; error: string }>, ok: string) {
    setOcupado(true);
    const r = await f().catch(() => ({ ok: false as const, error: "Sin conexión. Intentá de nuevo." }));
    setOcupado(false);
    setAviso(r.ok ? { tono: "ok", texto: ok } : { tono: "error", texto: r.error });
    setVersion((v) => v + 1);
  }

  return (
    <div className={styles.reporte}>
      {aviso && (
        <p className={inv.aviso} data-tono={aviso.tono} role={aviso.tono === "error" ? "alert" : "status"}>
          {aviso.texto}
        </p>
      )}
      <section aria-label="Meses">
        <span className={styles.etiqueta}>Meses</span>
        {periodos === null ? (
          <div className={styles.cargando} aria-label="Cargando" />
        ) : (
          <ul className={styles.meses}>
            {periodos.map((p) => (
              <li key={p.mes} data-cerrado={p.cerrado || undefined}>
                <span className={styles.candado} aria-hidden="true" />
                <span className={styles.mesNombre}>{nombreMes(p.mes)}</span>
                <span className={styles.ayuda}>
                  {p.asientos} {p.asientos === 1 ? "asiento" : "asientos"} · {moneda(p.debe)}
                </span>
                {p.cerrado ? (
                  esDueno && (
                    <button type="button" className={`${ui.boton} ${ui.fantasma}`} disabled={ocupado} onClick={() => hacer(() => api.reabrirPeriodo(p.mes), `${nombreMes(p.mes)} quedó abierto.`)}>
                      Reabrir
                    </button>
                  )
                ) : p.mes < mesActual ? (
                  <button type="button" className={ui.boton} disabled={ocupado} onClick={() => hacer(() => api.cerrarPeriodo(p.mes), `${nombreMes(p.mes)} quedó cerrado.`)}>
                    Cerrar mes
                  </button>
                ) : (
                  <span className={styles.ayuda}>En curso</span>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className={styles.ayuda}>Un mes cerrado no acepta asientos (tampoco compras o ventas fechadas en él). Solo el dueño lo reabre.</p>
      </section>

      <section className={styles.herramientas} aria-label="Arranque">
        <span className={styles.etiqueta}>Arranque de la contabilidad</span>
        <div>
          <p>
            <strong>Contabilizar lo anterior</strong>: asienta las ventas, notas, abonos, compras, pagos y movimientos de caja
            registrados antes de activar la contabilidad.
          </p>
          <button
            type="button"
            className={ui.boton}
            disabled={ocupado}
            onClick={() =>
              hacer(async () => {
                const r = await api.contabilizarPendientes();
                return r.ok ? { ok: true as const } : r;
              }, "Listo: lo pendiente quedó asentado.")
            }
          >
            Contabilizar lo anterior
          </button>
        </div>
        <div>
          <p>
            <strong>Apertura del inventario</strong>: lo que ya había en existencias (existencia × costo) contra Capital. Una
            sola vez; el fondo de caja, los bancos y las deudas de arranque van en un asiento manual.
          </p>
          <button
            type="button"
            className={ui.boton}
            disabled={ocupado}
            onClick={() =>
              hacer(async () => {
                const r = await api.aperturaInventario(hoyIso());
                return r.ok ? { ok: true as const } : r;
              }, "Apertura del inventario registrada.")
            }
          >
            Registrar apertura
          </button>
        </div>
      </section>
    </div>
  );
}
