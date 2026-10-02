"use client";

import { useState, type CSSProperties } from "react";
import { useApi } from "@/components/datos/apis";
import ui from "@/components/ui/controles.module.css";
import { IconoMas, IconoMenos } from "@/components/ui/iconos";
import { DENOMINACIONES, totalArqueo, type Arqueo as ConteoArqueo, type Turno } from "@/lib/caja";
import { centavos, moneda } from "@/lib/formato";
import styles from "./caja.module.css";

/** Tope del medidor: más allá de ±L 500 la aguja se queda en el tope. */
const ESCALA = 500;

/**
 * Cierre de caja: se cuenta el efectivo por denominación (o se escribe el
 * total) y un amperímetro de centro cero muestra al instante si cuadra, sobra
 * o falta. Con diferencia, la base exige una nota.
 */
export function Arqueo({ turno, onCerrada, onCancelar }: { turno: Turno; onCerrada: (id: string) => void; onCancelar: () => void }) {
  const api = useApi("caja");
  const [conteo, setConteo] = useState<ConteoArqueo>({});
  const [porTotal, setPorTotal] = useState(false);
  const [total, setTotal] = useState("");
  const [notas, setNotas] = useState("");
  const [confirmar, setConfirmar] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const esperado = turno.resumen.esperado_efectivo;
  const contado = porTotal ? centavos(Number(total.replace(/,/g, "")) || 0) : totalArqueo(conteo);
  const diferencia = centavos(contado - esperado);
  const contó = porTotal ? total.trim() !== "" : Object.values(conteo).some((v) => v > 0) || esperado === 0;
  const lectura = !contó ? "sin_contar" : diferencia === 0 ? "cuadra" : diferencia > 0 ? "sobra" : "falta";
  const angulo = Math.max(-1, Math.min(1, diferencia / ESCALA)) * 78;

  const limitar = (n: number) => Math.max(0, Math.min(99999, Math.floor(n) || 0));
  function cambiar(clave: string, n: number) {
    setConteo((c) => ({ ...c, [clave]: limitar(n) }));
    setConfirmar(false);
  }
  // Con la cantidad vigente: dos toques rápidos suman dos.
  function sumar(clave: string, delta: number) {
    setConteo((c) => ({ ...c, [clave]: limitar((c[clave] ?? 0) + delta) }));
    setConfirmar(false);
  }

  async function cerrar() {
    setOcupado(true);
    setError(null);
    const r = await api.cerrar(turno.id, contado, porTotal ? null : conteo, notas);
    setOcupado(false);
    setConfirmar(false);
    if (!r.ok) return setError(r.error);
    onCerrada(turno.id);
  }

  return (
    <div className={styles.arqueo}>
      <section className={styles.conteo} aria-label="Conteo del efectivo">
        <div className={styles.conteoBarra}>
          <span className={styles.etiqueta}>{porTotal ? "Efectivo contado" : "Contá el efectivo de la gaveta"}</span>
          <button type="button" className={styles.enlace} onClick={() => setPorTotal((v) => !v)}>
            {porTotal ? "Contar por billete" : "Escribir solo el total"}
          </button>
        </div>
        {porTotal ? (
          <label className={styles.lcdEntrada} data-grande="">
            <span aria-hidden="true">L</span>
            <input
              inputMode="decimal"
              placeholder="0.00"
              value={total}
              onChange={(e) => setTotal(e.target.value.replace(/[^\d.,]/g, ""))}
              aria-label="Efectivo contado"
              autoFocus
            />
          </label>
        ) : (
          <ul className={styles.billetes}>
            {DENOMINACIONES.map((d, i) => {
              const n = conteo[d.clave] ?? 0;
              return (
                <li key={d.clave} data-tipo={d.tipo} data-lleno={n > 0 || undefined} style={{ "--i": i } as CSSProperties}>
                  <span className={styles.billeteValor}>
                    {d.valor < 1 ? (
                      <>
                        {Math.round(d.valor * 100)}
                        <small>ctv</small>
                      </>
                    ) : (
                      <>
                        <small>L</small>
                        {d.valor}
                      </>
                    )}
                  </span>
                  <div className={styles.billeteContador}>
                    <button type="button" aria-label={`Uno menos de ${d.clave}`} disabled={n <= 0} onClick={() => sumar(d.clave, -1)}>
                      <IconoMenos tamano={11} />
                    </button>
                    <input
                      inputMode="numeric"
                      aria-label={`Cantidad de ${d.tipo === "billete" ? "billetes" : "monedas"} de L ${d.clave}`}
                      value={n || ""}
                      placeholder="0"
                      onChange={(e) => cambiar(d.clave, Number(e.target.value.replace(/\D/g, "")))}
                      onFocus={(e) => e.target.select()}
                    />
                    <button type="button" aria-label={`Uno más de ${d.clave}`} onClick={() => sumar(d.clave, 1)}>
                      <IconoMas tamano={11} />
                    </button>
                  </div>
                  <span className={styles.billeteSubtotal}>{n > 0 ? moneda(centavos(n * d.valor)) : "—"}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className={styles.cuadre} aria-label="Cuadre">
        {/* Amperímetro de centro cero: falta a la izquierda, sobra a la derecha. */}
        <div className={styles.medidor} data-lectura={lectura}>
          <svg viewBox="0 0 240 140" role="img" aria-label={`Diferencia: ${moneda(diferencia)}`}>
            <path className={styles.arcoFalta} d="M 30 100.9 A 92 92 0 0 1 113.6 28.2" />
            <path className={styles.arcoSobra} d="M 126.4 28.2 A 92 92 0 0 1 210 100.9" />
            {Array.from({ length: 11 }, (_, k) => {
              const a = ((k - 5) / 5) * 78 * (Math.PI / 180);
              const largo = k % 5 === 0 ? 14 : 8;
              return (
                <line
                  key={k}
                  className={styles.marca}
                  x1={120 + Math.sin(a) * 92}
                  y1={120 - Math.cos(a) * 92}
                  x2={120 + Math.sin(a) * (92 - largo)}
                  y2={120 - Math.cos(a) * (92 - largo)}
                />
              );
            })}
            <text x="30" y="136" className={styles.medidorTexto}>
              FALTA
            </text>
            <text x="210" y="136" className={styles.medidorTexto} textAnchor="end">
              SOBRA
            </text>
            <text x="120" y="18" className={styles.medidorTexto} textAnchor="middle">
              0
            </text>
            <g className={styles.aguja} style={{ transform: `rotate(${contó ? angulo : 0}deg)` }}>
              <line x1="120" y1="120" x2="120" y2="38" />
            </g>
            <circle cx="120" cy="120" r="8" className={styles.eje} />
          </svg>
          <p className={styles.veredicto}>
            <span className={styles.led} data-estado={lectura} aria-hidden="true" />
            {lectura === "sin_contar"
              ? "Contá el efectivo"
              : lectura === "cuadra"
                ? "Cuadra"
                : lectura === "sobra"
                  ? `Sobran ${moneda(diferencia)}`
                  : `Faltan ${moneda(-diferencia)}`}
          </p>
        </div>

        <dl className={styles.cuenta}>
          <div>
            <dt>Debería haber</dt>
            <dd>{moneda(esperado)}</dd>
          </div>
          <div>
            <dt>Contaste</dt>
            <dd>{moneda(contado)}</dd>
          </div>
          <div data-tono={diferencia < 0 ? "resta" : diferencia > 0 ? "aviso" : undefined}>
            <dt>Diferencia</dt>
            <dd>
              {diferencia > 0 ? "+ " : diferencia < 0 ? "− " : ""}
              {moneda(Math.abs(diferencia))}
            </dd>
          </div>
        </dl>

        <label className={styles.notas}>
          <span className={styles.etiqueta}>Nota{diferencia !== 0 && contó ? " (obligatoria si no cuadra)" : ""}</span>
          <textarea
            className={ui.campo}
            rows={3}
            maxLength={500}
            placeholder={diferencia < 0 ? "Se dio mal un vuelto de L 10…" : "Todo en orden."}
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
          />
        </label>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        {confirmar ? (
          <div className={styles.confirmar} role="alertdialog" aria-label="Confirmar cierre">
            <p>
              ¿Cerrar el turno {turno.numero} con <strong>{moneda(contado)}</strong> en efectivo?
            </p>
            <p className={styles.nota}>Después del cierre ya no entran ventas a este turno. Queda el corte para imprimir.</p>
            <div className={styles.botones}>
              <button type="button" className={`${ui.boton} ${ui.fantasma}`} onClick={() => setConfirmar(false)}>
                Volver
              </button>
              <button type="button" className={`${ui.boton} ${ui.primario}`} disabled={ocupado} autoFocus onClick={cerrar}>
                {ocupado ? "Cerrando…" : "Sí, cerrar caja"}
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.botones}>
            <button type="button" className={`${ui.boton} ${ui.fantasma}`} onClick={onCancelar}>
              Seguir vendiendo
            </button>
            <button
              type="button"
              className={`${ui.boton} ${ui.primario}`}
              disabled={!contó || (diferencia !== 0 && !notas.trim())}
              title={diferencia !== 0 && !notas.trim() ? "Escribí una nota que explique la diferencia" : undefined}
              onClick={() => setConfirmar(true)}
            >
              Cerrar caja
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
