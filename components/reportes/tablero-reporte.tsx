"use client";

import { useEffect, useMemo, useState } from "react";
import { useApi } from "@/components/datos/apis";
import ui from "@/components/ui/controles.module.css";
import { Odometro } from "@/components/ventas/odometro";
import { obtenerReporte } from "@/lib/reportes";
import {
  PERIODOS,
  compacto,
  diaCorto,
  diasEntre,
  formatear,
  mesDe,
  rangoDe,
  sumarDias,
  textoRango,
} from "@/lib/reportes/periodos";
import type { DatosReporte, DefIndicador, DefRanking, DefReporte, DefSerie, PeriodoId } from "@/lib/reportes/tipos";
import type { Row } from "write-excel-file/browser";
import styles from "./tablero-reporte.module.css";

type Rango = { desde: string; hasta: string };

/**
 * Tablero de un reporte registrado en lib/reportes: período, indicadores con
 * variación contra el período anterior, serie por día y rankings. Todo sale de
 * la DefReporte; un reporte nuevo no necesita tocar este componente.
 *
 *   <TableroReporte reporte="ventas" />
 */
export function TableroReporte({ reporte }: { reporte: string }) {
  const def = obtenerReporte(reporte);
  const api = useApi("reportes");
  const [periodo, setPeriodo] = useState<PeriodoId | null>(def.periodo ?? "30d");
  const [rango, setRango] = useState<Rango>(() => rangoDe(def.periodo ?? "30d"));
  const [datos, setDatos] = useState<DatosReporte | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let vivo = true;
    // Diferido: no se cambia estado de forma síncrona dentro del efecto.
    const t = setTimeout(() => vivo && setCargando(true), 0);
    api
      .leer(def.id, rango.desde, rango.hasta)
      .then((r) => {
        if (!vivo) return;
        if (r.ok) {
          setDatos(r.datos);
          setError(null);
        } else setError(r.error);
      })
      .catch(() => vivo && setError("Sin conexión. Intentá de nuevo."))
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [api, def.id, rango.desde, rango.hasta, version]);

  function elegir(p: PeriodoId) {
    setPeriodo(p);
    setRango(rangoDe(p));
  }

  function cambiarFecha(campo: keyof Rango, valor: string) {
    if (!valor) return;
    setPeriodo(null);
    setRango((r) => {
      const n = { ...r, [campo]: valor };
      // Si quedan al revés, se corrige el otro extremo.
      if (n.desde > n.hasta) return campo === "desde" ? { desde: valor, hasta: valor } : { desde: valor, hasta: valor };
      if (diasEntre(n.desde, n.hasta) > 400) return campo === "desde" ? { desde: valor, hasta: sumarDias(valor, 399) } : { desde: sumarDias(valor, -399), hasta: valor };
      return n;
    });
  }

  const dias = diasEntre(rango.desde, rango.hasta);
  const previo = { desde: sumarDias(rango.desde, -dias), hasta: sumarDias(rango.desde, -1) };
  const indicadores = def.indicadores.filter((i) => datos?.indicadores[i.clave] != null);
  const destacado = indicadores.find((i) => i.destacado);
  const resto = indicadores.filter((i) => i !== destacado);
  const vacio = datos && def.serie ? datos.serie.every((p) => !Number(p[def.serie!.clave])) : false;

  return (
    <div className={styles.tablero} data-cargando={cargando || undefined}>
      <header className={styles.barra}>
        <div className={styles.periodos} role="radiogroup" aria-label="Período">
          {PERIODOS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={periodo === p.id}
              className={styles.periodo}
              onClick={() => elegir(p.id)}
            >
              {p.etiqueta}
            </button>
          ))}
        </div>
        <div className={styles.rango}>
          <label>
            <span className="sr-only">Desde</span>
            <input
              type="date"
              className={`${ui.campo} ${ui.campoMono}`}
              value={rango.desde}
              max={rango.hasta}
              onChange={(e) => cambiarFecha("desde", e.target.value)}
            />
          </label>
          <span aria-hidden="true">→</span>
          <label>
            <span className="sr-only">Hasta</span>
            <input
              type="date"
              className={`${ui.campo} ${ui.campoMono}`}
              value={rango.hasta}
              min={rango.desde}
              onChange={(e) => cambiarFecha("hasta", e.target.value)}
            />
          </label>
        </div>
        <button
          type="button"
          className={`${ui.boton} ${styles.exportar}`}
          disabled={!datos || cargando}
          onClick={() => datos && void exportarExcel(def, datos)}
        >
          Exportar a Excel
        </button>
        <span className={styles.barrido} aria-hidden="true" />
      </header>

      {error && (
        <p className={styles.error} role="alert">
          {error}{" "}
          <button type="button" className={styles.reintentar} onClick={() => setVersion((v) => v + 1)}>
            Reintentar
          </button>
        </p>
      )}

      {!datos ? (
        !error && <Esqueleto />
      ) : (
        <div className={styles.cuerpo} key={`${rango.desde}:${rango.hasta}`}>
          <section className={styles.indicadores} aria-label="Indicadores">
            {destacado && (
              <Indicador def={destacado} valor={datos.indicadores[destacado.clave]} previo={previo} grande />
            )}
            <div className={styles.instrumentos}>
              {resto.map((i, n) => (
                <Indicador key={i.clave} def={i} valor={datos.indicadores[i.clave]} previo={previo} indice={n} />
              ))}
            </div>
          </section>

          {def.serie && (
            <section className={styles.panel} aria-label={def.serie.etiqueta}>
              <header className={styles.panelCabecera}>
                <h3 className={styles.panelTitulo}>{def.serie.etiqueta}</h3>
                <span className={styles.panelNota}>{textoRango(rango.desde, rango.hasta)}</span>
              </header>
              {vacio ? (
                <p className={styles.vacio}>{def.vacio ?? "No hay datos en este período."}</p>
              ) : (
                <Ecualizador def={def.serie} serie={datos.serie} />
              )}
            </section>
          )}

          <div className={styles.rankings}>
            {def.rankings.map((r) => (
              <Ranking key={r.clave} def={r} filas={datos.rankings[r.clave] ?? []} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------ indicadores ---

function variacion(valor: number | null, anterior: number | null) {
  if (valor === null || anterior === null) return null;
  if (anterior === 0) return valor === 0 ? 0 : null;
  return ((valor - anterior) / Math.abs(anterior)) * 100;
}

function Indicador({
  def,
  valor,
  previo,
  grande,
  indice = 0,
}: {
  def: DefIndicador;
  valor: DatosReporte["indicadores"][string];
  previo: Rango;
  grande?: boolean;
  indice?: number;
}) {
  const v = valor?.valor === null || valor?.valor === undefined ? null : Number(valor.valor);
  const a = valor?.anterior === null || valor?.anterior === undefined ? null : Number(valor.anterior);
  const cambio = variacion(v, a);
  const sube = cambio !== null && cambio > 0.05;
  const baja = cambio !== null && cambio < -0.05;
  const bueno = def.inverso ? baja : sube;
  const malo = def.inverso ? sube : baja;
  const tono = bueno ? "bien" : malo ? "mal" : "igual";
  const comparacion = `vs. ${formatear(a, def.formato)} del ${textoRango(previo.desde, previo.hasta)}`;

  return (
    <article
      className={styles.indicador}
      data-grande={grande || undefined}
      style={{ animationDelay: `${80 + indice * 45}ms` }}
      title={def.ayuda}
    >
      <p className={styles.indicadorEtiqueta}>{def.etiqueta}</p>
      {grande && def.formato === "moneda" && v !== null ? (
        <Odometro valor={v} etiqueta={def.etiqueta} />
      ) : (
        <p className={styles.indicadorValor}>{formatear(v, def.formato)}</p>
      )}
      <p className={styles.indicadorCambio} data-tono={tono} title={comparacion}>
        {cambio === null ? (
          a === 0 && v ? (
            <span>Nuevo en este período</span>
          ) : (
            <span>Sin comparación</span>
          )
        ) : (
          <>
            <Flecha direccion={sube ? "arriba" : baja ? "abajo" : "igual"} />
            <span>{Math.abs(cambio) < 0.05 ? "Igual" : `${Math.abs(cambio).toFixed(1)} %`}</span>
            <span className={styles.indicadorPrevio}>{grande ? comparacion : "vs. anterior"}</span>
          </>
        )}
      </p>
    </article>
  );
}

function Flecha({ direccion }: { direccion: "arriba" | "abajo" | "igual" }) {
  return (
    <svg viewBox="0 0 10 10" className={styles.flecha} aria-hidden="true">
      {direccion === "igual" ? (
        <path d="M2 5h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      ) : (
        <path d={direccion === "arriba" ? "M5 1.5 9 7.5H1z" : "M5 8.5 1 2.5h8z"} fill="currentColor" />
      )}
    </svg>
  );
}

// -------------------------------------------------------------- serie ------

type Punto = { etiqueta: string; detalle: string; valor: number; secundario: number | null };

/** Agrupa por semana o mes cuando el rango es largo, para que las barras se lean. */
function agrupar(def: DefSerie, serie: DatosReporte["serie"]): Punto[] {
  const n = serie.length;
  const modo = n > 180 ? "mes" : n > 62 ? "semana" : "dia";
  const grupos = new Map<string, Punto>();
  for (const p of serie) {
    const fecha = String(p.fecha);
    let clave = fecha;
    if (modo === "mes") clave = fecha.slice(0, 7);
    else if (modo === "semana") {
      const d = new Date(`${fecha}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
      clave = d.toISOString().slice(0, 10);
    }
    const g = grupos.get(clave) ?? {
      etiqueta: modo === "mes" ? mesDe(`${clave}-01`) : diaCorto(clave),
      detalle: modo === "mes" ? mesDe(`${clave}-01`) : modo === "semana" ? `Semana del ${diaCorto(clave)}` : diaCorto(clave),
      valor: 0,
      secundario: def.secundaria ? 0 : null,
    };
    g.valor += Number(p[def.clave] ?? 0);
    if (def.secundaria) g.secundario = (g.secundario ?? 0) + Number(p[def.secundaria.clave] ?? 0);
    grupos.set(clave, g);
  }
  return [...grupos.values()];
}

/** Barras de LED segmentados, como un ecualizador de tablero. */
function Ecualizador({ def, serie }: { def: DefSerie; serie: DatosReporte["serie"] }) {
  const puntos = useMemo(() => agrupar(def, serie), [def, serie]);
  const [activo, setActivo] = useState<number | null>(null);
  const maximo = Math.max(...puntos.map((p) => p.valor), 1);
  // Escala «redonda» para las guías.
  const paso = 10 ** Math.floor(Math.log10(maximo));
  const tope = Math.ceil(maximo / paso) * paso;
  const cada = Math.max(1, Math.ceil(puntos.length / 8));
  const mejor = puntos.reduce((m, p, i) => (p.valor > puntos[m].valor ? i : m), 0);
  const actual = activo ?? mejor;
  const p = puntos[actual];

  return (
    <div className={styles.grafico}>
      <div className={styles.lectura} aria-live="polite">
        <span className={styles.lecturaFecha}>{activo === null ? `Mejor: ${p.detalle}` : p.detalle}</span>
        <span className={styles.lecturaValor}>{formatear(p.valor, def.formato)}</span>
        {def.secundaria && p.secundario !== null && (
          <span className={styles.lecturaSecundaria}>
            {formatear(p.secundario, def.secundaria.formato)} {def.secundaria.etiqueta.toLowerCase()}
          </span>
        )}
      </div>
      <div className={styles.area}>
        <div className={styles.guias} aria-hidden="true">
          {[1, 0.5, 0].map((f) => (
            <span key={f} style={{ bottom: `${f * 100}%` }}>
              {compacto(tope * f, def.formato)}
            </span>
          ))}
        </div>
        <ol className={styles.barras} onPointerLeave={() => setActivo(null)} data-muchas={puntos.length > 40 || undefined}>
          {puntos.map((pt, i) => (
            <li key={i} className={styles.columna}>
              <button
                type="button"
                className={styles.barraBoton}
                aria-label={`${pt.detalle}: ${formatear(pt.valor, def.formato)}`}
                aria-pressed={activo === i}
                onPointerEnter={() => setActivo(i)}
                onFocus={() => setActivo(i)}
                onBlur={() => setActivo(null)}
              >
                <span
                  className={styles.barraLed}
                  data-activa={actual === i || undefined}
                  data-cero={pt.valor === 0 || undefined}
                  style={{ height: `${Math.max((pt.valor / tope) * 100, pt.valor > 0 ? 2 : 0)}%`, animationDelay: `${i * (600 / puntos.length)}ms` }}
                />
              </button>
              <span className={styles.eje} aria-hidden="true">
                {i % cada === 0 || i === puntos.length - 1 ? pt.etiqueta : ""}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

// ------------------------------------------------------------- rankings ----

function Ranking({ def, filas }: { def: DefRanking; filas: DatosReporte["rankings"][string] }) {
  // Columnas que la base no mandó para este usuario (p. ej. utilidad a un vendedor) no se muestran.
  const columnas = def.columnas.filter((c) => c.principal || c.secundaria || filas.some((f) => f[c.clave] !== null && f[c.clave] !== undefined));
  const principal = columnas.find((c) => c.principal);
  const secundaria = columnas.find((c) => c.secundaria);
  const numericas = columnas.filter((c) => !c.principal && !c.secundaria);
  const maximo = Math.max(...filas.map((f) => Number(f[def.medida] ?? 0)), 1);

  return (
    <section className={styles.panel} data-ancho={def.ancho ?? "mitad"} aria-label={def.titulo}>
      <header className={styles.panelCabecera}>
        <h3 className={styles.panelTitulo}>{def.titulo}</h3>
        <span className={styles.panelNota}>{filas.length ? `Top ${filas.length}` : ""}</span>
      </header>
      {!filas.length ? (
        <p className={styles.vacio}>{def.vacio ?? "Sin datos en este período."}</p>
      ) : (
        <table className={styles.ranking}>
          <thead>
            <tr>
              <th scope="col" className={styles.posicion}>
                #
              </th>
              <th scope="col">{principal?.etiqueta}</th>
              {numericas.map((c) => (
                <th key={c.clave} scope="col" className={styles.numero}>
                  {c.etiqueta}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={i} style={{ animationDelay: `${120 + i * 35}ms` }}>
                <td className={styles.posicion}>{String(i + 1).padStart(2, "0")}</td>
                <td className={styles.nombre}>
                  <span className={styles.nombreTexto} title={String(f[principal?.clave ?? ""] ?? "")}>
                    {formatear(f[principal?.clave ?? ""], "texto")}
                  </span>
                  {secundaria && f[secundaria.clave] && <span className={styles.nombreSecundario}>{String(f[secundaria.clave])}</span>}
                  <span className={styles.pista} aria-hidden="true">
                    <span style={{ transform: `scaleX(${Number(f[def.medida] ?? 0) / maximo})`, animationDelay: `${200 + i * 35}ms` }} />
                  </span>
                </td>
                {numericas.map((c) => (
                  <td key={c.clave} className={styles.numero} data-medida={c.clave === def.medida || undefined}>
                    {formatear(f[c.clave], c.formato)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function Esqueleto() {
  return (
    <div className={styles.cuerpo} aria-label="Cargando reporte">
      <div className={styles.indicadores}>
        <div className={styles.esqueleto} data-alto="grande" />
        <div className={styles.instrumentos}>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className={styles.esqueleto} />
          ))}
        </div>
      </div>
      <div className={styles.esqueleto} data-alto="grafico" />
    </div>
  );
}

// ------------------------------------------------------------- exportar ----

/** Excel con una hoja de resumen, la serie y una hoja por ranking. */
async function exportarExcel(def: DefReporte, datos: DatosReporte) {
  const { default: escribir } = await import("write-excel-file/browser");
  const titulo = (t: string) => ({ value: t, fontWeight: "bold" as const });
  const resumen = [
    [titulo("Indicador"), titulo("Valor"), titulo("Período anterior"), titulo("Variación %")],
    ...def.indicadores
      .filter((i) => datos.indicadores[i.clave] != null)
      .map((i) => {
        const x = datos.indicadores[i.clave]!;
        const v = variacion(x.valor === null ? null : Number(x.valor), x.anterior === null ? null : Number(x.anterior));
        return [i.etiqueta, Number(x.valor ?? 0), Number(x.anterior ?? 0), v === null ? null : Math.round(v * 10) / 10];
      }),
  ];
  const hojas: { nombre: string; filas: Row[] }[] = [{ nombre: "Resumen", filas: resumen }];
  if (def.serie) {
    const s = def.serie;
    hojas.push({
      nombre: "Por día",
      filas: [
        [titulo("Fecha"), titulo(s.etiqueta), ...(s.secundaria ? [titulo(s.secundaria.etiqueta)] : [])],
        ...datos.serie.map((p) => [String(p.fecha), Number(p[s.clave] ?? 0), ...(s.secundaria ? [Number(p[s.secundaria.clave] ?? 0)] : [])]),
      ],
    });
  }
  for (const r of def.rankings) {
    const filas = datos.rankings[r.clave] ?? [];
    const cols = r.columnas.filter((c) => filas.some((f) => f[c.clave] !== null && f[c.clave] !== undefined));
    hojas.push({
      nombre: r.titulo.slice(0, 31),
      filas: [cols.map((c) => titulo(c.etiqueta)), ...filas.map((f) => cols.map((c) => (c.formato === "texto" || c.formato === "codigo" ? String(f[c.clave] ?? "") : Number(f[c.clave] ?? 0))))],
    });
  }
  await escribir(
    hojas.map((h) => ({
      data: h.filas,
      sheet: h.nombre,
      columns: (h.filas[0] ?? []).map((_, i) => ({ width: i === 0 ? 34 : 16 })),
    })),
  ).toFile(`${def.id}-${datos.periodo.desde}-a-${datos.periodo.hasta}.xlsx`);
}
