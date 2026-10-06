"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useApi } from "@/components/datos/apis";
import ui from "@/components/ui/controles.module.css";
import { IconoRecargar } from "@/components/ui/iconos";
import { useVentanaActual } from "@/components/ventanas/ventana";
import { VentanaFlotante } from "@/components/ventanas/ventana-flotante";
import { Odometro } from "@/components/ventas/odometro";
import { ETIQUETA_MOVIMIENTO, type EstadoCaja, type MovimientoCaja } from "@/lib/caja";
import { etiquetaForma } from "@/lib/cobros";
import { centavos, moneda } from "@/lib/formato";
import { Arqueo } from "./arqueo";
import { CorteTurno } from "./turnos";
import styles from "./caja.module.css";

const hora = new Intl.DateTimeFormat("es-HN", { timeZone: "America/Tegucigalpa", hour: "numeric", minute: "2-digit" });

/**
 * La caja de quien está en el mostrador: cerrada → abrir con fondo; abierta →
 * el efectivo que debería haber, lo cobrado por forma de pago, el movimiento
 * del turno, entradas/salidas y el cierre con arqueo.
 */
export function CajaActual({ administra }: { administra: boolean }) {
  const api = useApi("caja");
  const madre = useVentanaActual() ?? undefined;
  const [estado, setEstado] = useState<EstadoCaja | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cerrando, setCerrando] = useState(false);
  const [corte, setCorte] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setEstado(await api.estado());
    } catch {
      setError("No se pudo leer la caja. Revisá la conexión.");
    }
  }, [api]);

  useEffect(() => {
    let vivo = true;
    api
      .estado()
      .then((e) => vivo && setEstado(e))
      .catch(() => vivo && setError("No se pudo leer la caja. Revisá la conexión."));
    // Mientras está a la vista, se pone al día cada 30 s (ventas de otras computadoras).
    const t = setInterval(() => {
      if (document.visibilityState === "visible") api.estado().then((e) => vivo && setEstado(e)).catch(() => {});
    }, 30_000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [api]);

  if (!estado) {
    return error ? <p className={styles.vacio}>{error}</p> : <div className={styles.cargando} aria-label="Cargando caja" />;
  }

  return (
    <div className={styles.caja}>
      {estado.turno ? (
        <TurnoAbierto estado={estado} onCambio={cargar} onCerrar={() => setCerrando(true)} />
      ) : (
        <CajaCerrada estado={estado} administra={administra} onAbierta={cargar} />
      )}

      {cerrando && estado.turno && (
        <VentanaFlotante
          id="arqueo"
          titulo={`Cerrar caja · turno ${estado.turno.numero}`}
          padre={madre}
          tamano={{ w: 980, h: 760 }}
          foco={estado.turno.id}
          onCerrar={() => setCerrando(false)}
        >
          <Arqueo
            turno={estado.turno}
            onCancelar={() => setCerrando(false)}
            onCerrada={(id) => {
              setCerrando(false);
              setCorte(id);
              void cargar();
            }}
          />
        </VentanaFlotante>
      )}
      {corte && (
        <VentanaFlotante id="corte" titulo="Corte de caja" padre={madre} tamano={{ w: 880, h: 760 }} foco={corte} onCerrar={() => setCorte(null)}>
          <CorteTurno id={corte} />
        </VentanaFlotante>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ cerrada --

function CajaCerrada({ estado, administra, onAbierta }: { estado: EstadoCaja; administra: boolean; onAbierta: () => void }) {
  const api = useApi("caja");
  const [fondo, setFondo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [obligatoria, setObligatoria] = useState(estado.obligatoria);

  async function abrir(e: FormEvent) {
    e.preventDefault();
    setOcupado(true);
    setError(null);
    const r = await api.abrir(Number(fondo.replace(/,/g, "")) || 0);
    setOcupado(false);
    if (!r.ok) return setError(r.error);
    onAbierta();
  }

  async function exigir(valor: boolean) {
    setObligatoria(valor);
    const r = await api.obligatoria(valor);
    if (!r.ok) {
      setObligatoria(!valor);
      setError(r.error);
    }
  }

  if (!estado.punto) {
    return (
      <section className={styles.cerrada}>
        <h2 className={styles.titulo}>Sin punto de emisión</h2>
        <p className={styles.bajada}>Registrá tu caja en Ventas › Puntos de emisión para poder abrir un turno.</p>
      </section>
    );
  }

  return (
    <form className={styles.cerrada} onSubmit={abrir}>
      <span className={styles.etiqueta}>
        {estado.punto.nombre} · {estado.punto.codigo}
      </span>
      <h2 className={styles.titulo}>
        <span className={styles.led} data-estado="cerrada" aria-hidden="true" /> La caja está cerrada
      </h2>
      <p className={styles.bajada}>
        Contá el fondo con el que arrancás (el cambio) y abrí el turno. Lo que se cobre desde ahora en esta caja cae en él.
      </p>
      <label className={styles.lcdCampo}>
        <span className={styles.etiqueta}>Fondo inicial</span>
        <span className={styles.lcdEntrada}>
          <span aria-hidden="true">L</span>
          <input inputMode="decimal" placeholder="0.00" value={fondo} onChange={(e) => setFondo(e.target.value.replace(/[^\d.,]/g, ""))} autoFocus />
        </span>
      </label>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <button type="submit" className={`${ui.boton} ${ui.primario} ${styles.abrir}`} disabled={ocupado}>
        {ocupado ? "Abriendo…" : "Abrir caja"}
      </button>
      {administra && (
        <label className={styles.exigir}>
          <input type="checkbox" className={ui.casilla} checked={obligatoria} onChange={(e) => void exigir(e.target.checked)} />
          <span>
            Exigir la caja abierta para facturar de contado y cobrar abonos
            <small>Así nada se cobra fuera de un turno.</small>
          </span>
        </label>
      )}
    </form>
  );
}

// ------------------------------------------------------------------ abierta --

function TurnoAbierto({ estado, onCambio, onCerrar }: { estado: EstadoCaja; onCambio: () => void; onCerrar: () => void }) {
  const t = estado.turno!;
  const r = t.resumen;
  const efectivo = r.formas.find((f) => f.forma === "efectivo")!;
  const conMovimiento = r.formas.filter((f) => f.forma === "efectivo" || f.ventas || f.abonos || f.devoluciones || f.cargos || f.pagos);

  return (
    <>
      <header className={styles.turnoBarra}>
        <div>
          <span className={styles.etiqueta}>Turno {t.numero}</span>
          <h2 className={styles.turnoTitulo}>
            <span className={styles.led} data-estado="abierta" aria-hidden="true" /> {t.punto}
          </h2>
          <p className={styles.turnoMeta}>
            Abierta a las {hora.format(new Date(t.abierta_en))}
            {t.abierta_por ? ` por ${t.abierta_por}` : ""} · fondo {moneda(t.fondo_inicial)}
          </p>
        </div>
        <div className={styles.turnoAcciones}>
          <button type="button" className={`${ui.boton} ${ui.fantasma}`} onClick={onCambio} aria-label="Actualizar">
            <IconoRecargar tamano={14} />
          </button>
          <button type="button" className={`${ui.boton} ${ui.primario}`} onClick={onCerrar}>
            Cerrar caja
          </button>
        </div>
      </header>

      <div className={styles.tablero}>
        <section className={styles.efectivo} aria-label="Efectivo en caja">
          <span className={styles.etiqueta}>Efectivo que debería haber</span>
          <Odometro valor={r.esperado_efectivo} etiqueta="Efectivo esperado" />
          <dl className={styles.cuenta}>
            <div>
              <dt>Fondo</dt>
              <dd>{moneda(r.fondo)}</dd>
            </div>
            <div>
              <dt>+ Ventas de contado</dt>
              <dd>{moneda(efectivo.ventas)}</dd>
            </div>
            <div>
              <dt>+ Abonos</dt>
              <dd>{moneda(efectivo.abonos)}</dd>
            </div>
            {efectivo.cargos > 0 && (
              <div>
                <dt>+ Notas de débito</dt>
                <dd>{moneda(efectivo.cargos)}</dd>
              </div>
            )}
            <div data-tono="resta">
              <dt>− Devoluciones</dt>
              <dd>{moneda(efectivo.devoluciones)}</dd>
            </div>
            {efectivo.pagos > 0 && (
              <div data-tono="resta">
                <dt>− Compras y pagos a proveedores</dt>
                <dd>{moneda(efectivo.pagos)}</dd>
              </div>
            )}
            <div>
              <dt>+ Entradas</dt>
              <dd>{moneda(r.entradas)}</dd>
            </div>
            <div data-tono="resta">
              <dt>− Salidas</dt>
              <dd>{moneda(r.salidas)}</dd>
            </div>
          </dl>
          <Movimiento turno={t.id} onHecho={onCambio} />
        </section>

        <section className={styles.formas} aria-label="Cobrado por forma de pago">
          <span className={styles.etiqueta}>Cobrado en el turno</span>
          <table className={styles.tablaFormas}>
            <thead>
              <tr>
                <th scope="col">Forma</th>
                <th scope="col" data-num="">
                  Ventas
                </th>
                <th scope="col" data-num="">
                  Abonos
                </th>
                <th scope="col" data-num="">
                  Salidas
                </th>
                <th scope="col" data-num="">
                  Neto
                </th>
              </tr>
            </thead>
            <tbody>
              {conMovimiento.map((f) => (
                <tr key={f.forma}>
                  <th scope="row">{etiquetaForma(f.forma)}</th>
                  <td data-num="">{moneda(f.ventas + f.cargos)}</td>
                  <td data-num="">{moneda(f.abonos)}</td>
                  <td
                    data-num=""
                    data-tono={f.devoluciones + f.pagos ? "resta" : undefined}
                    title={f.pagos ? `Devoluciones ${moneda(f.devoluciones)} · compras y pagos ${moneda(f.pagos)}` : undefined}
                  >
                    {f.devoluciones + f.pagos ? `− ${moneda(f.devoluciones + f.pagos)}` : "—"}
                  </td>
                  <td data-num="">
                    <strong>{moneda(f.neto)}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" colSpan={4}>
                  Total cobrado
                </th>
                <td data-num="">
                  <strong>{moneda(r.total_cobrado)}</strong>
                </td>
              </tr>
            </tfoot>
          </table>
          <p className={styles.nota}>
            {r.facturas} {r.facturas === 1 ? "venta" : "ventas"} de contado · {r.abonos} {r.abonos === 1 ? "abono" : "abonos"}
            {r.pagos > 0 && <> · {r.pagos} {r.pagos === 1 ? "pago" : "pagos"} a proveedores</>}
            {r.credito > 0 && <> · al crédito {moneda(r.credito)} (no entra a la caja)</>}
          </p>
        </section>
      </div>

      <Movimientos movimientos={t.movimientos} />
    </>
  );
}

/** Entrada o salida de efectivo: gasto menor, retiro al banco, más cambio. */
function Movimiento({ turno, onHecho }: { turno: string; onHecho: () => void }) {
  const api = useApi("caja");
  const [tipo, setTipo] = useState<"entrada" | "salida" | null>(null);
  const [monto, setMonto] = useState("");
  const [concepto, setConcepto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!tipo) return;
    setOcupado(true);
    const r = await api.movimiento(turno, tipo, Number(monto.replace(/,/g, "")), concepto);
    setOcupado(false);
    if (!r.ok) return setError(r.error);
    setTipo(null);
    setMonto("");
    setConcepto("");
    setError(null);
    onHecho();
  }

  if (!tipo) {
    return (
      <div className={styles.movBotones}>
        <button type="button" className={ui.boton} onClick={() => setTipo("entrada")}>
          + Entrada de efectivo
        </button>
        <button type="button" className={ui.boton} onClick={() => setTipo("salida")}>
          − Salida de efectivo
        </button>
      </div>
    );
  }
  return (
    <form className={styles.movForm} onSubmit={guardar}>
      <span className={styles.etiqueta}>{tipo === "entrada" ? "Entrada de efectivo" : "Salida de efectivo"}</span>
      <div className={styles.movCampos}>
        <input
          className={`${ui.campo} ${ui.campoMono}`}
          inputMode="decimal"
          placeholder="0.00"
          value={monto}
          onChange={(e) => setMonto(e.target.value.replace(/[^\d.,]/g, ""))}
          aria-label="Monto"
          autoFocus
        />
        <input
          className={ui.campo}
          placeholder={tipo === "entrada" ? "Más cambio del banco" : "Compra de agua, depósito al banco…"}
          value={concepto}
          maxLength={160}
          onChange={(e) => setConcepto(e.target.value)}
          aria-label="Concepto"
        />
      </div>
      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.botones}>
        <button type="button" className={`${ui.boton} ${ui.fantasma}`} onClick={() => setTipo(null)}>
          Cancelar
        </button>
        <button type="submit" className={`${ui.boton} ${ui.primario}`} disabled={ocupado || !(Number(monto.replace(/,/g, "")) > 0) || !concepto.trim()}>
          Registrar
        </button>
      </div>
    </form>
  );
}

/** Todo lo que pasó en el turno, lo último arriba. */
export function Movimientos({ movimientos }: { movimientos: MovimientoCaja[] }) {
  return (
    <section className={styles.movimientos} aria-label="Movimientos del turno">
      <span className={styles.etiqueta}>Movimientos del turno</span>
      {movimientos.length === 0 ? (
        <p className={styles.vacio}>Todavía no hay movimientos. Las ventas de contado, abonos y devoluciones aparecen aquí.</p>
      ) : (
        <ol className={styles.lista}>
          {movimientos.map((m) => (
            <li key={`${m.tipo}-${m.id}`} data-tipo={m.tipo} data-anulado={m.estado === "anulado" || undefined} data-fuera={!m.en_caja || undefined}>
              <time>{hora.format(new Date(m.fecha))}</time>
              <span className={styles.movTipo}>{ETIQUETA_MOVIMIENTO[m.tipo]}</span>
              <span className={styles.movDetalle}>
                {m.referencia && <b>{m.referencia}</b>}
                {m.detalle}
                {m.estado === "anulado" && " · anulado"}
              </span>
              <span className={styles.movForma}>{m.forma_pago ? etiquetaForma(m.forma_pago) : "—"}</span>
              <strong className={styles.movMonto} data-signo={m.monto < 0 ? "-" : "+"}>
                {m.monto < 0 ? "− " : ""}
                {moneda(Math.abs(centavos(m.monto)))}
              </strong>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
