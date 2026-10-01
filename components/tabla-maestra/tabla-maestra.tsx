"use client";

import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
  type PointerEvent as PEvent,
  type ReactNode,
} from "react";
import { useApi } from "@/components/datos/apis";
import ui from "@/components/ui/controles.module.css";
import {
  IconoAnterior,
  IconoBuscar,
  IconoCerrar,
  IconoColumnas,
  IconoDensidad,
  IconoEditar,
  IconoFiltro,
  IconoMas,
  IconoRecargar,
  IconoSiguiente,
} from "@/components/ui/iconos";
import { urlImagen } from "@/lib/imagenes";
import { obtenerRecurso, textoNuevo } from "@/lib/recursos";
import type {
  DefColumna,
  DefRecurso,
  Filtro,
  Fila,
  Orden,
  PreferenciasTabla,
  ResultadoConsulta,
} from "@/lib/recursos/tipos";
import { PanelColumnas } from "./panel-columnas";
import { PanelFiltros } from "./panel-filtros";
import styles from "./tabla-maestra.module.css";
import {
  columnasIniciales,
  columnasPorDefecto,
  esNumerica,
  ETIQUETAS_OPERADOR,
  formatearCelda,
  SIMBOLO_OPERADOR,
  sinValor,
  useDiferido,
  useRetrasar,
  type ColumnaCfg,
} from "./utilidades";

export type TablaMaestraProps = {
  /** Id del recurso registrado en lib/recursos. */
  recurso: string;
  /** Permite crear/editar (la autorización real la hace RLS). */
  puedeEditar?: boolean;
  onNuevo?: () => void;
  onEditar?: (fila: Fila) => void;
  /** Abrir una fila sin editarla (p. ej. ver un documento). Tiene prioridad sobre onEditar. */
  onAbrir?: (fila: Fila) => void;
  /** Cambiar este número fuerza una recarga (p. ej. tras guardar). */
  version?: number;
  /** Id de la fila a resaltar (la última guardada). */
  resaltar?: string | number | null;
  /** Controles extra a la derecha de la barra. */
  acciones?: ReactNode;
};

const TAMANOS = [25, 50, 100, 200];
const prefsCache = new Map<string, PreferenciasTabla | null>();

/** Olvida las preferencias cacheadas (p. ej. tras restablecerlas desde el perfil). */
export function olvidarPreferenciasTablas() {
  prefsCache.clear();
}

type Panel = "filtros" | "columnas" | null;

export function TablaMaestra({
  recurso,
  puedeEditar = false,
  onNuevo,
  onEditar: onEditarProp,
  onAbrir,
  version = 0,
  resaltar,
  acciones,
}: TablaMaestraProps) {
  const onEditar = onAbrir ?? (puedeEditar ? onEditarProp : undefined);
  const conAccion = Boolean(onEditar);
  const def = obtenerRecurso(recurso);
  const api = useApi("recursos");
  const clavePrefs = `tabla:${def.id}`;

  // ------------------------------------------------------------ estado ----
  const [listo, setListo] = useState(prefsCache.has(clavePrefs));
  const [columnas, setColumnas] = useState<ColumnaCfg[]>(() =>
    columnasIniciales(def, prefsCache.get(clavePrefs) ?? null),
  );
  const [orden, setOrden] = useState<Orden[]>(() => prefsCache.get(clavePrefs)?.orden ?? []);
  const [tamano, setTamano] = useState(() => prefsCache.get(clavePrefs)?.tamano ?? 50);
  const [densidad, setDensidad] = useState<"compacta" | "normal">(
    () => prefsCache.get(clavePrefs)?.densidad ?? "normal",
  );
  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState<Filtro[]>([]);
  const [pagina, setPagina] = useState(0);
  const [recargas, setRecargas] = useState(0);
  const [resultado, setResultado] = useState<ResultadoConsulta | null>(null);
  const [seleccion, setSeleccion] = useState<string | number | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [cargando, iniciar] = useTransition();

  const busquedaDif = useDiferido(busqueda, 250);
  const filtrosDif = useDiferido(filtros, 350);

  // Preferencias guardadas del usuario
  useEffect(() => {
    if (prefsCache.has(clavePrefs)) return;
    let vivo = true;
    api
      .leerPreferencias(clavePrefs)
      .catch(() => null)
      .then((p) => {
        if (!vivo) return;
        prefsCache.set(clavePrefs, p);
        setColumnas(columnasIniciales(def, p));
        setOrden(p?.orden ?? []);
        setTamano(p?.tamano ?? 50);
        setDensidad(p?.densidad ?? "normal");
        setListo(true);
      });
    return () => {
      vivo = false;
    };
  }, [api, clavePrefs, def]);

  const guardarDiferido = useRetrasar((cfg: PreferenciasTabla) => {
    api.guardarPreferencias(clavePrefs, cfg).catch(() => {});
  }, 700);

  const configActual = useRef<PreferenciasTabla>({});
  useEffect(() => {
    configActual.current = { columnas, orden, tamano, densidad };
  });
  function persistir(cambios: PreferenciasTabla) {
    const cfg = { ...configActual.current, ...cambios };
    prefsCache.set(clavePrefs, cfg);
    guardarDiferido(cfg);
  }

  // ------------------------------------------------------------ datos -----
  const ordenEfectivo = orden.length ? orden : [...(def.orden ?? [])];
  const consulta = useMemo(
    () => ({
      busqueda: busquedaDif,
      filtros: filtrosDif.filter((f) => sinValor(f.operador) || f.valor !== undefined || f.valores?.length),
      orden: ordenEfectivo,
      pagina,
      tamano,
    }),
    // ordenEfectivo se recalcula cada render; su contenido está en `orden`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [busquedaDif, filtrosDif, orden, pagina, tamano],
  );

  const peticion = useRef(0);
  useEffect(() => {
    if (!listo) return;
    const id = ++peticion.current;
    iniciar(async () => {
      const r = await api.consultar(def.id, consulta).catch(
        (): ResultadoConsulta => ({ ok: false, error: "Sin conexión con el servidor." }),
      );
      if (id === peticion.current) iniciar(() => setResultado(r));
    });
  }, [api, def.id, consulta, listo, version, recargas]);

  const filas = resultado?.ok ? resultado.filas : [];
  const total = resultado?.ok ? resultado.total : 0;
  const paginas = Math.max(1, Math.ceil(total / tamano));

  // ------------------------------------------------------------ acciones --
  function cambiarBusqueda(v: string) {
    setBusqueda(v);
    setPagina(0);
  }
  function cambiarFiltros(f: Filtro[]) {
    setFiltros(f);
    setPagina(0);
  }
  function cambiarColumnas(c: ColumnaCfg[]) {
    setColumnas(c);
    persistir({ columnas: c });
  }
  function cambiarOrden(o: Orden[]) {
    setOrden(o);
    setPagina(0);
    persistir({ orden: o });
  }
  function cambiarTamano(t: number) {
    setTamano(t);
    setPagina(0);
    persistir({ tamano: t });
  }
  function alternarDensidad() {
    const d = densidad === "compacta" ? "normal" : "compacta";
    setDensidad(d);
    persistir({ densidad: d });
  }

  function ordenarPor(clave: string, multiple: boolean) {
    const actual = ordenEfectivo;
    const i = actual.findIndex((o) => o.columna === clave);
    let nuevo: Orden[];
    if (!multiple) {
      if (i === -1 || actual.length > 1) nuevo = [{ columna: clave, dir: "asc" }];
      else if (actual[i].dir === "asc") nuevo = [{ columna: clave, dir: "desc" }];
      else nuevo = [];
    } else if (i === -1) nuevo = [...actual, { columna: clave, dir: "asc" }];
    else if (actual[i].dir === "asc") nuevo = actual.map((o) => (o.columna === clave ? { ...o, dir: "desc" } : o));
    else nuevo = actual.filter((o) => o.columna !== clave);
    cambiarOrden(nuevo);
  }

  // Cerrar paneles al hacer clic afuera
  const barraRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!panel) return;
    const cerrar = (e: PointerEvent) => {
      if (!barraRef.current?.contains(e.target as Node)) setPanel(null);
    };
    const esc = (e: globalThis.KeyboardEvent) => e.key === "Escape" && setPanel(null);
    document.addEventListener("pointerdown", cerrar);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", cerrar);
      document.removeEventListener("keydown", esc);
    };
  }, [panel]);

  // ------------------------------------------------------------ columnas --
  const visibles = columnas
    .filter((c) => c.visible)
    .map((c) => ({ cfg: c, def: def.columnas.find((d) => d.clave === c.clave)! }))
    .filter((c) => c.def);
  const anchoTotal = visibles.reduce((s, c) => s + c.cfg.ancho, 0) + (conAccion ? 44 : 0);

  const tablaRef = useRef<HTMLTableElement>(null);
  const colRefs = useRef(new Map<string, HTMLTableColElement>());

  function iniciarRedimension(e: PEvent<HTMLSpanElement>, clave: string) {
    e.preventDefault();
    e.stopPropagation();
    const col = colRefs.current.get(clave);
    const tabla = tablaRef.current;
    const cfg = columnas.find((c) => c.clave === clave);
    if (!col || !tabla || !cfg) return;
    const x0 = e.clientX;
    const ancho0 = cfg.ancho;
    const tabla0 = anchoTotal;
    let ancho = ancho0;
    const objetivo = e.currentTarget;
    objetivo.setPointerCapture(e.pointerId);

    const mover = (ev: PointerEvent) => {
      ancho = Math.round(Math.min(Math.max(ancho0 + ev.clientX - x0, 56), 900));
      col.style.width = `${ancho}px`;
      tabla.style.width = `${tabla0 + ancho - ancho0}px`;
    };
    const soltar = () => {
      objetivo.removeEventListener("pointermove", mover);
      objetivo.removeEventListener("pointerup", soltar);
      objetivo.removeEventListener("pointercancel", soltar);
      cambiarColumnas(columnas.map((c) => (c.clave === clave ? { ...c, ancho } : c)));
    };
    objetivo.addEventListener("pointermove", mover);
    objetivo.addEventListener("pointerup", soltar);
    objetivo.addEventListener("pointercancel", soltar);
  }

  // ------------------------------------------------------------ teclado ---
  function alTeclear(e: KeyboardEvent<HTMLDivElement>) {
    if (!filas.length) return;
    const i = filas.findIndex((f) => f[def.clave] === seleccion);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const siguiente = e.key === "ArrowDown" ? Math.min(i + 1, filas.length - 1) : Math.max(i - 1, 0);
      const fila = filas[i === -1 ? 0 : siguiente];
      setSeleccion(fila[def.clave] as string | number);
      e.currentTarget
        .querySelector(`[data-clave="${String(fila[def.clave])}"]`)
        ?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter" && i !== -1) {
      onEditar?.(filas[i]);
    }
  }

  const activos = filtros.filter((f) => sinValor(f.operador) || f.valor !== undefined || f.valores?.length);
  const desde = total === 0 ? 0 : pagina * tamano + 1;
  const hasta = Math.min(total, (pagina + 1) * tamano);

  return (
    <div className={styles.tabla} data-densidad={densidad}>
      {/* ----------------------------------------------------- barra ---- */}
      <div className={styles.barra} ref={barraRef}>
        <label className={styles.buscar}>
          <IconoBuscar tamano={14} />
          <input
            type="search"
            className={`${ui.campo} ${styles.buscarCampo}`}
            placeholder={`Buscar ${def.nombrePlural.toLowerCase()}…`}
            aria-label={`Buscar ${def.nombrePlural.toLowerCase()}`}
            value={busqueda}
            onChange={(e) => cambiarBusqueda(e.target.value)}
          />
        </label>

        <div className={styles.grupo}>
          <div className={styles.anclaPopover}>
            <button
              type="button"
              className={ui.boton}
              aria-expanded={panel === "filtros"}
              onClick={() => setPanel(panel === "filtros" ? null : "filtros")}
            >
              <IconoFiltro tamano={14} /> Filtros
              {activos.length > 0 && <span className={ui.contador}>{activos.length}</span>}
            </button>
            {panel === "filtros" && (
              <div className={`${ui.popover} ${styles.popoverFiltros}`}>
                <PanelFiltros def={def} filtros={filtros} onCambiar={cambiarFiltros} />
              </div>
            )}
          </div>

          <div className={styles.anclaPopover}>
            <button
              type="button"
              className={ui.boton}
              aria-expanded={panel === "columnas"}
              onClick={() => setPanel(panel === "columnas" ? null : "columnas")}
            >
              <IconoColumnas tamano={14} /> Columnas
            </button>
            {panel === "columnas" && (
              <div className={`${ui.popover} ${styles.popoverColumnas}`}>
                <PanelColumnas
                  def={def}
                  columnas={columnas}
                  onCambiar={cambiarColumnas}
                  onRestablecer={() => {
                    cambiarColumnas(columnasPorDefecto(def));
                    cambiarOrden([]);
                  }}
                />
              </div>
            )}
          </div>

          <button
            type="button"
            className={`${ui.boton} ${ui.icono}`}
            aria-pressed={densidad === "compacta"}
            aria-label="Filas compactas"
            title="Filas compactas"
            onClick={alternarDensidad}
          >
            <IconoDensidad tamano={14} />
          </button>
          <button
            type="button"
            className={`${ui.boton} ${ui.icono}`}
            aria-label="Recargar"
            title="Recargar"
            onClick={() => setRecargas((n) => n + 1)}
          >
            <IconoRecargar tamano={14} />
          </button>
        </div>

        <div className={styles.derecha}>
          {acciones}
          {puedeEditar && onNuevo && (
            <button type="button" className={`${ui.boton} ${ui.primario}`} onClick={onNuevo}>
              <IconoMas tamano={14} /> {textoNuevo(def)}
            </button>
          )}
        </div>
      </div>

      {activos.length > 0 && (
        <ul className={styles.chips} aria-label="Filtros activos">
          {activos.map((f) => (
            <li key={f.id} className={styles.chip}>
              <button type="button" onClick={() => setPanel("filtros")}>
                {textoFiltro(def, f)}
              </button>
              <button
                type="button"
                aria-label="Quitar filtro"
                onClick={() => cambiarFiltros(filtros.filter((x) => x.id !== f.id))}
              >
                <IconoCerrar tamano={11} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* ----------------------------------------------------- tabla ---- */}
      <div
        className={styles.marco}
        tabIndex={0}
        onKeyDown={alTeclear}
        aria-busy={cargando}
        data-cargando={cargando || !listo || undefined}
      >
        <span className={styles.progreso} aria-hidden="true" />
        <table ref={tablaRef} className={styles.grilla} style={{ width: anchoTotal }}>
          <colgroup>
            {visibles.map(({ cfg }) => (
              <col
                key={cfg.clave}
                style={{ width: cfg.ancho }}
                ref={(el) => {
                  if (el) colRefs.current.set(cfg.clave, el);
                  else colRefs.current.delete(cfg.clave);
                }}
              />
            ))}
            {conAccion && <col style={{ width: 44 }} />}
          </colgroup>
          <thead>
            <tr>
              {visibles.map(({ def: col }) => {
                const i = ordenEfectivo.findIndex((o) => o.columna === col.clave);
                const o = ordenEfectivo[i];
                const ordenable = col.ordenable !== false;
                return (
                  <th
                    key={col.clave}
                    scope="col"
                    data-numerica={esNumerica(col) || undefined}
                    aria-sort={o ? (o.dir === "asc" ? "ascending" : "descending") : undefined}
                  >
                    <button
                      type="button"
                      className={styles.encabezado}
                      disabled={!ordenable}
                      onClick={(e) => ordenarPor(col.clave, e.shiftKey)}
                      title={ordenable ? "Clic para ordenar · Mayús+clic para orden múltiple" : undefined}
                    >
                      <span className={styles.encabezadoTexto}>{col.etiqueta}</span>
                      {o && (
                        <span className={styles.indicadorOrden} data-dir={o.dir}>
                          <svg viewBox="0 0 10 10" width="9" height="9" aria-hidden="true">
                            <path d="M5 2 9 8H1z" fill="currentColor" />
                          </svg>
                          {ordenEfectivo.length > 1 && <small>{i + 1}</small>}
                        </span>
                      )}
                    </button>
                    <span
                      className={styles.redimensionar}
                      onPointerDown={(e) => iniciarRedimension(e, col.clave)}
                      aria-hidden="true"
                    />
                  </th>
                );
              })}
              {conAccion && (
                <th scope="col" aria-label="Acciones">
                  <span className={styles.encabezado} />
                </th>
              )}
            </tr>
          </thead>
          <Cuerpo
            def={def}
            columnas={visibles.map((v) => v.def)}
            filas={filas}
            seleccion={seleccion}
            resaltar={resaltar ?? null}
            puedeEditar={conAccion}
            abrir={Boolean(onAbrir)}
            onSeleccionar={setSeleccion}
            onEditar={onEditar}
          />
        </table>

        {resultado && !resultado.ok && (
          <div className={styles.estado}>
            <p className={styles.estadoTitulo}>No se pudo cargar</p>
            <p>{resultado.error}</p>
            <button type="button" className={ui.boton} onClick={() => setRecargas((n) => n + 1)}>
              <IconoRecargar tamano={14} /> Reintentar
            </button>
          </div>
        )}
        {resultado?.ok && filas.length === 0 && (
          <div className={styles.estado}>
            <p className={styles.estadoTitulo}>Sin resultados</p>
            {busqueda || activos.length ? (
              <>
                <p>Ningún registro coincide con la búsqueda o los filtros.</p>
                <button
                  type="button"
                  className={ui.boton}
                  onClick={() => {
                    cambiarBusqueda("");
                    cambiarFiltros([]);
                  }}
                >
                  Limpiar búsqueda y filtros
                </button>
              </>
            ) : (
              <p>Todavía no hay {def.nombrePlural.toLowerCase()}.</p>
            )}
          </div>
        )}
      </div>

      {/* ----------------------------------------------------- pie ------ */}
      <div className={styles.pie}>
        <span className={styles.conteo}>
          {resultado?.ok ? (
            <>
              <strong>
                {desde.toLocaleString("es-HN")}–{hasta.toLocaleString("es-HN")}
              </strong>{" "}
              de {total.toLocaleString("es-HN")}
            </>
          ) : (
            "Cargando…"
          )}
        </span>

        <div className={styles.paginacion}>
          <label className={styles.tamano}>
            <span>Filas</span>
            <select
              className={`${ui.campo} ${ui.campoMono}`}
              value={tamano}
              onChange={(e) => cambiarTamano(Number(e.target.value))}
            >
              {TAMANOS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className={`${ui.boton} ${ui.icono}`}
            aria-label="Página anterior"
            disabled={pagina === 0}
            onClick={() => setPagina((p) => Math.max(0, p - 1))}
          >
            <IconoAnterior tamano={14} />
          </button>
          <span className={styles.paginaActual}>
            {pagina + 1} / {paginas}
          </span>
          <button
            type="button"
            className={`${ui.boton} ${ui.icono}`}
            aria-label="Página siguiente"
            disabled={pagina + 1 >= paginas}
            onClick={() => setPagina((p) => p + 1)}
          >
            <IconoSiguiente tamano={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function textoFiltro(def: DefRecurso, f: Filtro) {
  const col = def.columnas.find((c) => c.clave === f.columna);
  const nombre = col?.etiqueta ?? f.columna;
  if (sinValor(f.operador)) return `${nombre} ${ETIQUETAS_OPERADOR[f.operador]}`;
  if (f.operador === "en") {
    const etiquetas = (f.valores ?? []).map(
      (v) => col?.opciones?.find((o) => String(o.valor) === String(v))?.etiqueta ?? String(v),
    );
    return `${nombre}: ${etiquetas.length > 3 ? `${etiquetas.slice(0, 3).join(", ")} +${etiquetas.length - 3}` : etiquetas.join(", ")}`;
  }
  if (f.operador === "entre") return `${nombre} entre ${f.valor ?? "…"} y ${f.valor2 ?? "…"}`;
  const simbolo = SIMBOLO_OPERADOR[f.operador];
  return simbolo ? `${nombre} ${simbolo} ${f.valor}` : `${nombre} ${ETIQUETAS_OPERADOR[f.operador]} «${f.valor}»`;
}

// ---------------------------------------------------------------- cuerpo ---
// Memorizado: redimensionar columnas o abrir paneles no re-renderiza las filas.

type CuerpoProps = {
  def: DefRecurso;
  columnas: DefColumna[];
  filas: Fila[];
  seleccion: string | number | null;
  resaltar: string | number | null;
  puedeEditar: boolean;
  /** La acción de la fila es «abrir» (no editar). */
  abrir?: boolean;
  onSeleccionar: (id: string | number) => void;
  onEditar?: (fila: Fila) => void;
};

const Cuerpo = memo(
  function Cuerpo({ def, columnas, filas, seleccion, resaltar, puedeEditar, abrir, onSeleccionar, onEditar }: CuerpoProps) {
    return (
      <tbody>
        {filas.map((fila) => {
          const id = fila[def.clave] as string | number;
          return (
            <tr
              key={String(id)}
              data-clave={String(id)}
              aria-selected={seleccion === id}
              data-resaltada={resaltar === id || undefined}
              onClick={() => onSeleccionar(id)}
              onDoubleClick={() => puedeEditar && onEditar?.(fila)}
            >
              {columnas.map((col) => {
                const texto = formatearCelda(col, fila[col.clave]);
                if (col.formato === "imagen") {
                  return (
                    <td key={col.clave} data-formato="imagen">
                      {texto ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img className={styles.miniatura} src={urlImagen(texto)} alt="" loading="lazy" decoding="async" />
                      ) : (
                        <span className={styles.sinImagen} aria-hidden="true" />
                      )}
                    </td>
                  );
                }
                return (
                  <td
                    key={col.clave}
                    data-numerica={esNumerica(col) || undefined}
                    data-formato={col.formato}
                    data-alerta={col.alerta && fila[col.alerta] === true ? "" : undefined}
                    data-vacio={col.vacio && texto === col.vacio ? "" : undefined}
                    title={texto ?? undefined}
                  >
                    {texto === null ? <span className={styles.nulo}>—</span> : texto}
                  </td>
                );
              })}
              {puedeEditar && (
                <td className={styles.celdaAccion}>
                  <button
                    type="button"
                    className={styles.editar}
                    aria-label={abrir ? "Abrir" : "Editar"}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditar?.(fila);
                    }}
                  >
                    {abrir ? <IconoSiguiente tamano={13} /> : <IconoEditar tamano={13} />}
                  </button>
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    );
  },
  (a, b) =>
    a.filas === b.filas &&
    a.seleccion === b.seleccion &&
    a.resaltar === b.resaltar &&
    a.puedeEditar === b.puedeEditar &&
    a.abrir === b.abrir &&
    a.onEditar === b.onEditar &&
    a.columnas.map((c) => c.clave).join() === b.columnas.map((c) => c.clave).join(),
);
