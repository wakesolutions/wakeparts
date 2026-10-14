"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useSesion } from "@/app/inicio/_components/sesion-contexto";
import escritorio from "@/app/inicio/_components/escritorio.module.css";
import { useApi } from "@/components/datos/apis";
import { IconoBuscar } from "@/components/ui/iconos";
import { useVentanas } from "@/components/ventanas/contexto";
import {
  CLAVES_MODULO,
  DESTINOS,
  FILTROS,
  FUENTES_BUSQUEDA,
  enlaceDe,
  pareceNumero,
  puntuar,
  resaltar,
  type FiltroBusqueda,
  type FuenteBusqueda,
  type Insignia,
  type Presentacion,
  type ResultadoBusqueda,
} from "@/lib/buscador";
import { tonoDeFabrica } from "@/lib/dock";
import { urlImagen } from "@/lib/imagenes";
import { pedirDestino } from "@/lib/ir-a";
import type { Enlace } from "@/lib/notificaciones";
import styles from "./buscador.module.css";

/* -------------------------------------------------------------- apertura --- */

const EVENTO = "wp:buscador:abrir";

/** Abre la búsqueda global desde cualquier lado (p. ej. el botón de la barra). */
export function abrirBuscador() {
  window.dispatchEvent(new Event(EVENTO));
}

const esMac = () => /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);
const sinSuscripcion = () => () => {};

/** «⌘ F» en Mac, «Ctrl F» en lo demás (en el servidor, Ctrl). */
export function useAtajoBuscar() {
  const mac = useSyncExternalStore(sinSuscripcion, esMac, () => false);
  return mac ? "⌘ F" : "Ctrl F";
}

/* ----------------------------------------------------------------- items --- */

/** Lo que se guarda en recientes (serializable). */
type Recuerdo = {
  clave: string;
  titulo: string;
  detalle: string;
  modulo: string;
  enlace: Enlace;
  insignia?: Insignia;
  imagen?: string;
};

type Item = {
  clave: string;
  titulo: string;
  detalle: string;
  /** Visual a la izquierda. */
  figura: ReactNode;
  /** Lectura o etiqueta a la derecha. */
  derecha?: ReactNode;
  tachado?: boolean;
  /** Resaltar la consulta en el título y el detalle. */
  resaltado?: boolean;
  ejecutar: () => void;
};

type Grupo = { id: string; titulo: string; items: Item[] };

const MAX_RECIENTES = 6;
const claveRecientes = (usuario: string) => `wp:buscador:recientes:${usuario}`;

function leerRecientes(usuario: string): Recuerdo[] {
  try {
    const v = JSON.parse(localStorage.getItem(claveRecientes(usuario)) ?? "[]");
    return Array.isArray(v) ? v.slice(0, MAX_RECIENTES) : [];
  } catch {
    return [];
  }
}

function guardarReciente(usuario: string, r: Recuerdo) {
  try {
    const lista = [r, ...leerRecientes(usuario).filter((x) => x.clave !== r.clave)].slice(0, MAX_RECIENTES);
    localStorage.setItem(claveRecientes(usuario), JSON.stringify(lista));
  } catch {
    // sin almacenamiento: no hay recientes
  }
}

/* ------------------------------------------------------------ componente --- */

/**
 * Búsqueda global del escritorio: Ctrl/⌘ F (o Ctrl/⌘ K) desde cualquier
 * ventana. Lleva a módulos, secciones y acciones, y encuentra documentos,
 * productos, clientes, recibos, compras y proveedores. Una segunda vez
 * Ctrl/⌘ F con el panel abierto lo cierra y deja la búsqueda del navegador.
 */
export function Buscador() {
  const [abierto, setAbierto] = useState(false);
  const [inicial, setInicial] = useState("");
  const previo = useRef<HTMLElement | null>(null);

  const abrir = useCallback(() => {
    previo.current = document.activeElement as HTMLElement | null;
    // Si hay texto seleccionado (p. ej. un número en una tabla), se busca eso.
    const sel = window.getSelection()?.toString().trim() ?? "";
    setInicial(sel.length > 1 && sel.length <= 60 && !sel.includes("\n") ? sel : "");
    setAbierto(true);
  }, []);

  const cerrar = useCallback((devolverFoco = true) => {
    setAbierto(false);
    if (devolverFoco) requestAnimationFrame(() => previo.current?.focus?.());
  }, []);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey || (k !== "f" && k !== "k")) return;
      if (abierto && k === "f") {
        // Segunda vez: el panel se va y queda la búsqueda en la página del navegador.
        cerrar();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      if (abierto) return;
      abrir();
    };
    const pedido = () => !abierto && abrir();
    window.addEventListener("keydown", tecla, { capture: true });
    window.addEventListener(EVENTO, pedido);
    return () => {
      window.removeEventListener("keydown", tecla, { capture: true });
      window.removeEventListener(EVENTO, pedido);
    };
  }, [abierto, abrir, cerrar]);

  if (!abierto) return null;
  return createPortal(<Panel inicial={inicial} onCerrar={cerrar} />, document.body);
}

function Panel({ inicial, onCerrar }: { inicial: string; onCerrar: (devolverFoco?: boolean) => void }) {
  const sesion = useSesion();
  const api = useApi("buscador");
  const { modulos, abrir, minimizarTodas } = useVentanas();
  const atajo = useAtajoBuscar();
  const idLista = useId();
  const entrada = useRef<HTMLInputElement>(null);
  const lista = useRef<HTMLDivElement>(null);
  const aguja = useRef<HTMLSpanElement>(null);

  const [consulta, setConsulta] = useState(inicial);
  const [filtro, elegirFiltro] = useState<FiltroBusqueda>("todo");
  const [activo, setActivo] = useState(0);
  // La consulta o el filtro cambian: la selección vuelve arriba.
  const setFiltro = useCallback((f: FiltroBusqueda) => {
    elegirFiltro(f);
    setActivo(0);
  }, []);
  const [datos, setDatos] = useState<{ q: string; filtro: FiltroBusqueda; r: ResultadoBusqueda } | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(false);
  const [recientes] = useState<Recuerdo[]>(() => leerRecientes(sesion.usuario.id));

  const q = consulta.trim();
  const visibles = useMemo(() => new Set(modulos.map((m) => m.id)), [modulos]);
  const porId = useMemo(() => new Map(modulos.map((m) => [m.id, m])), [modulos]);
  const fuentes = useMemo(
    () =>
      FUENTES_BUSQUEDA.filter(
        (f) => f.destinos.some((d) => visibles.has(d.modulo)) && (filtro === "todo" || f.filtro === filtro),
      ),
    [visibles, filtro],
  );
  const filtros = useMemo(
    () =>
      FILTROS.filter(
        (f) =>
          f.id === "todo" ||
          f.id === "ir" ||
          FUENTES_BUSQUEDA.some((x) => x.filtro === f.id && x.destinos.some((d) => visibles.has(d.modulo))),
      ),
    [visibles],
  );

  useEffect(() => {
    entrada.current?.focus();
    entrada.current?.select();
  }, []);

  // Datos del servidor: con pausa corta mientras se escribe; la respuesta vieja se descarta.
  const consultaDatos = q.length >= 2 && filtro !== "ir" && fuentes.length > 0;
  const buscando = cargando && consultaDatos;
  const turno = useRef(0);
  useEffect(() => {
    if (!consultaDatos) return;
    const mio = ++turno.current;
    const t = setTimeout(() => {
      setCargando(true);
      api
        .buscar(
          q,
          fuentes.map((f) => f.recurso),
          filtro === "todo" ? 4 : 15,
        )
        .then((r) => {
          if (mio !== turno.current) return;
          setDatos({ q, filtro, r });
          setError(false);
        })
        .catch(() => mio === turno.current && setError(true))
        .finally(() => mio === turno.current && setCargando(false));
    }, 140);
    return () => clearTimeout(t);
  }, [api, q, filtro, fuentes, consultaDatos]);

  /* --- acciones --- */

  const ir = useCallback(
    (r: Recuerdo) => {
      guardarReciente(sesion.usuario.id, r);
      onCerrar(false);
      if (r.modulo === "inicio") return minimizarTodas();
      abrir(r.modulo);
      if (r.enlace.seccion || r.enlace.recurso) pedirDestino(r.enlace);
    },
    [abrir, minimizarTodas, onCerrar, sesion.usuario.id],
  );

  const tono = useCallback(
    (modulo: string) => sesion.usuario.dock?.tonos?.[modulo] ?? tonoDeFabrica(modulo),
    [sesion.usuario.dock],
  );
  const pastilla = useCallback(
    (modulo: string, chica = false) => (
      <span className={styles.pastilla} data-tono={tono(modulo)} data-chica={chica || undefined}>
        <span className={escritorio.icono}>{porId.get(modulo)?.icono}</span>
      </span>
    ),
    [porId, tono],
  );

  const figuraRecuerdo = useCallback(
    (r: Recuerdo) =>
      r.insignia ? (
        <FiguraInsignia insignia={r.insignia} />
      ) : r.imagen ? (
        <FiguraFoto ruta={r.imagen} />
      ) : r.enlace.recurso === "productos" ? (
        <FiguraPieza />
      ) : r.enlace.id ? (
        <FiguraInicial texto={r.titulo} />
      ) : (
        pastilla(r.modulo)
      ),
    [pastilla],
  );

  /* --- grupos --- */

  const grupos = useMemo<Grupo[]>(() => {
    const salida: Grupo[] = [];

    // Sin consulta: acciones rápidas y lo último que abriste.
    if (!q) {
      const recuerdos = recientes.filter((r) => visibles.has(r.modulo));
      if (recuerdos.length)
        salida.push({
          id: "recientes",
          titulo: "Recientes",
          items: recuerdos.map((r) => ({
            clave: `reciente:${r.clave}`,
            titulo: r.titulo,
            detalle: r.detalle,
            figura: figuraRecuerdo(r),
            ejecutar: () => ir(r),
          })),
        });
      const acciones = DESTINOS.filter((d) => d.accion && visibles.has(d.modulo));
      if (acciones.length)
        salida.push({
          id: "acciones",
          titulo: "Acciones rápidas",
          items: acciones.map((d) => ({
            clave: d.id,
            titulo: d.titulo,
            detalle: d.lugar,
            figura: pastilla(d.modulo),
            derecha: <span className={styles.etiqueta}>Acción</span>,
            ejecutar: () =>
              ir({
                clave: d.id,
                titulo: d.titulo,
                detalle: d.lugar,
                modulo: d.modulo,
                enlace: { modulo: d.modulo, seccion: d.seccion },
              }),
          })),
        });
      return salida;
    }

    // «Ir a»: módulos, secciones y acciones que coinciden (en el navegador, al instante).
    if (filtro === "todo" || filtro === "ir") {
      const candidatos = [
        ...modulos
          .filter((m) => m.componente || m.id === "inicio")
          .map((m) => ({
            clave: `modulo:${m.id}`,
            puntos: puntuar(q, m.nombre, CLAVES_MODULO[m.id]) * 1.15,
            titulo: m.nombre,
            detalle: m.id === "inicio" ? "Ver el escritorio" : "Abrir el módulo",
            modulo: m.id,
            enlace: { modulo: m.id } as Enlace,
            tipo: "Módulo",
          })),
        ...DESTINOS.filter((d) => visibles.has(d.modulo)).map((d) => ({
          clave: d.id,
          puntos: puntuar(q, d.titulo, `${d.claves ?? ""} ${d.lugar}`),
          titulo: d.titulo,
          detalle: d.lugar,
          modulo: d.modulo,
          enlace: { modulo: d.modulo, seccion: d.seccion } as Enlace,
          tipo: d.accion ? "Acción" : "Sección",
        })),
      ]
        .filter((c) => c.puntos > 0)
        .sort((a, b) => b.puntos - a.puntos)
        .slice(0, filtro === "ir" ? 30 : 5);
      if (candidatos.length)
        salida.push({
          id: "ir",
          titulo: "Ir a",
          items: candidatos.map((c) => ({
            clave: c.clave,
            titulo: c.titulo,
            detalle: c.detalle,
            resaltado: true,
            figura: pastilla(c.modulo, c.tipo !== "Módulo"),
            derecha: <span className={styles.etiqueta}>{c.tipo}</span>,
            ejecutar: () =>
              ir({ clave: c.clave, titulo: c.titulo, detalle: c.detalle, modulo: c.modulo, enlace: c.enlace }),
          })),
        });
    }

    // Datos: lo que trajo el servidor para esta consulta (o la anterior, mientras llega la nueva).
    if (filtro !== "ir" && datos && q.length >= 2) {
      const registros: Grupo[] = [];
      for (const fuente of fuentes) {
        const r = datos.r[fuente.recurso];
        if (!r?.filas.length) continue;
        const items: Item[] = [];
        for (const fila of r.filas) {
          const enlace = enlaceDe(fuente, fila, visibles);
          if (!enlace) continue;
          items.push(itemRegistro(fuente, fila, enlace, ir, figuraRecuerdo));
        }
        if (filtro === "todo" && r.total > r.filas.length) {
          items.push({
            clave: `mas:${fuente.recurso}`,
            titulo: `Ver más ${fuente.grupo.toLowerCase()}`,
            detalle: `${r.total.toLocaleString("es-HN")} coinciden con «${datos.q}»`,
            figura: <span className={styles.mas} aria-hidden="true">+{Math.min(r.total - r.filas.length, 999)}</span>,
            ejecutar: () => setFiltro(fuente.filtro),
          });
        }
        if (items.length) registros.push({ id: fuente.recurso, titulo: fuente.grupo, items });
      }
      // Un número de factura o recibo: los documentos van antes que los módulos.
      if (pareceNumero(q)) salida.unshift(...registros);
      else salida.push(...registros);
    }
    return salida;
  }, [q, filtro, setFiltro, recientes, visibles, modulos, datos, fuentes, ir, pastilla, figuraRecuerdo]);

  const items = useMemo(() => grupos.flatMap((g) => g.items), [grupos]);
  const total = items.filter((i) => !i.clave.startsWith("mas:")).length;
  const indice = Math.min(activo, Math.max(0, items.length - 1));
  const actual = items[indice];

  // La aguja (barra LED) se desliza hasta la fila activa y la fila se asoma si quedó fuera.
  useLayoutEffect(() => {
    const fila = lista.current?.querySelector<HTMLElement>(`[data-indice="${indice}"]`);
    const a = aguja.current;
    if (!a) return;
    if (!fila) {
      a.style.opacity = "0";
      return;
    }
    a.style.opacity = "1";
    a.style.transform = `translate3d(0, ${fila.offsetTop}px, 0)`;
    a.style.height = `${fila.offsetHeight}px`;
    fila.scrollIntoView({ block: "nearest" });
  }, [indice, grupos]);

  function alTeclear(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onCerrar();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!items.length) return;
      const paso = e.key === "ArrowDown" ? 1 : -1;
      setActivo((indice + paso + items.length) % items.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      actual?.ejecutar();
    } else if (e.key === "Tab") {
      e.preventDefault();
      const i = filtros.findIndex((f) => f.id === filtro);
      setFiltro(filtros[(i + (e.shiftKey ? -1 : 1) + filtros.length) % filtros.length].id);
    }
  }

  const sinResultados = q.length > 0 && !items.length && !buscando && (!consultaDatos || (datos?.q === q && datos.filtro === filtro));
  let n = -1;

  return (
    <div className={styles.velo} onPointerDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label="Buscar en Wake Parts"
        onKeyDown={alTeclear}
      >
        <div className={styles.barra}>
          <IconoBuscar tamano={18} className={styles.lupa} />
          <input
            ref={entrada}
            className={styles.entrada}
            value={consulta}
            onChange={(e) => {
              setConsulta(e.target.value);
              setActivo(0);
            }}
            placeholder="Buscá módulos, facturas, productos, clientes…"
            role="combobox"
            aria-expanded={items.length > 0}
            aria-controls={idLista}
            aria-activedescendant={actual ? `${idLista}-${indice}` : undefined}
            aria-autocomplete="list"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="go"
          />
          <span className={styles.lcd} aria-live="polite" aria-label={q ? `${total} resultados` : undefined}>
            {q ? String(Math.min(total, 99)).padStart(2, "0") : "--"}
            <small>res</small>
          </span>
          <button type="button" className={styles.esc} onClick={() => onCerrar()} aria-label="Cerrar la búsqueda">
            Esc
          </button>
        </div>

        <div className={styles.filtros} role="tablist" aria-label="Qué buscar">
          {filtros.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filtro === f.id}
              className={styles.filtro}
              onClick={() => {
                setFiltro(f.id);
                entrada.current?.focus();
              }}
            >
              {f.nombre}
            </button>
          ))}
        </div>

        <div className={styles.carga} data-cargando={buscando || undefined} aria-hidden="true" />

        <div className={styles.lista} ref={lista} id={idLista} role="listbox" aria-label="Resultados">
          <div className={styles.contenido}>
            <span ref={aguja} className={styles.aguja} aria-hidden="true" />
            {grupos.map((g) => (
              <section key={g.id} className={styles.grupo} aria-label={g.titulo}>
                <p className={styles.grupoTitulo}>{g.titulo}</p>
                {g.items.map((it) => {
                  n += 1;
                  const i = n;
                  return (
                    <div
                      key={it.clave}
                      id={`${idLista}-${i}`}
                      role="option"
                      aria-selected={i === indice}
                      data-indice={i}
                      className={styles.fila}
                      data-tachado={it.tachado || undefined}
                      onPointerMove={() => i !== indice && setActivo(i)}
                      onClick={() => it.ejecutar()}
                    >
                      <span className={styles.figura}>{it.figura}</span>
                      <span className={styles.textos}>
                        <span className={styles.titulo}>
                          {it.resaltado ? <Marcado texto={it.titulo} q={q} /> : it.titulo}
                        </span>
                        {it.detalle && (
                          <span className={styles.detalle}>
                            {it.resaltado ? <Marcado texto={it.detalle} q={q} /> : it.detalle}
                          </span>
                        )}
                      </span>
                      {it.derecha && <span className={styles.derecha}>{it.derecha}</span>}
                    </div>
                  );
                })}
              </section>
            ))}

            {sinResultados && (
              <div className={styles.vacio}>
                <p className={styles.vacioTitulo}>Nada con «{q}»</p>
                <p className={styles.vacioTexto}>
                  {q.length < 2
                    ? "Escribí un poco más para buscar en tus datos."
                    : "Probá con el código del producto, el número de la factura, el RTN o parte del nombre."}
                </p>
              </div>
            )}
            {error && !buscando && (
              <p className={styles.aviso}>No se pudo buscar en tus datos. Revisá la conexión e intentá de nuevo.</p>
            )}
          </div>
        </div>

        <footer className={styles.pie}>
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> moverse
          </span>
          <span>
            <kbd>↵</kbd> abrir
          </span>
          <span>
            <kbd>Tab</kbd> filtrar
          </span>
          <span className={styles.pieDerecha}>
            <kbd>{atajo}</kbd> otra vez: buscar en la página
          </span>
        </footer>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- piezas --- */

function itemRegistro(
  fuente: FuenteBusqueda,
  fila: Record<string, unknown>,
  enlace: Enlace,
  ir: (r: Recuerdo) => void,
  figura: (r: Recuerdo) => ReactNode,
): Item {
  const p: Presentacion = fuente.presentar(fila);
  const recuerdo: Recuerdo = {
    clave: `${enlace.recurso}:${enlace.id}`,
    titulo: p.titulo,
    detalle: p.detalle,
    modulo: enlace.modulo!,
    enlace,
    insignia: p.insignia,
    imagen: p.imagen,
  };
  return {
    clave: recuerdo.clave,
    titulo: p.titulo,
    detalle: p.detalle,
    tachado: p.tachado,
    resaltado: true,
    figura: figura(recuerdo),
    derecha:
      p.valor || p.nota ? (
        <span className={styles.lectura}>
          {p.valor && <span className={styles.valor}>{p.valor}</span>}
          {p.nota && (
            <span className={styles.nota} data-tono={p.nota.tono}>
              {p.nota.texto}
            </span>
          )}
        </span>
      ) : undefined,
    ejecutar: () => ir(recuerdo),
  };
}

function Marcado({ texto, q }: { texto: string; q: string }) {
  return (
    <>
      {resaltar(texto, q).map((p, i) => (p.si ? <mark key={i}>{p.t}</mark> : <span key={i}>{p.t}</span>))}
    </>
  );
}

function FiguraInsignia({ insignia }: { insignia: Insignia }) {
  return (
    <span className={styles.insignia} data-tono={insignia.tono ?? "neutro"}>
      {insignia.texto}
    </span>
  );
}

function FiguraFoto({ ruta }: { ruta: string }) {
  const [falla, setFalla] = useState(false);
  if (falla) return <FiguraPieza />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className={styles.foto} src={urlImagen(ruta)} alt="" loading="lazy" onError={() => setFalla(true)} />
  );
}

function FiguraInicial({ texto }: { texto: string }) {
  return (
    <span className={styles.inicial} aria-hidden="true">
      {texto.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

/** Producto sin foto: un engrane (pieza) grabado, nunca una imagen genérica. */
function FiguraPieza() {
  return (
    <span className={styles.pieza} aria-hidden="true">
      <svg viewBox="0 0 24 24" width="18" height="18">
        <path
          d="M10.3 2.5h3.4l.5 2.4 1.7.7 2-1.4 2.4 2.4-1.4 2 .7 1.7 2.4.5v3.4l-2.4.5-.7 1.7 1.4 2-2.4 2.4-2-1.4-1.7.7-.5 2.4h-3.4l-.5-2.4-1.7-.7-2 1.4-2.4-2.4 1.4-2-.7-1.7-2.4-.5v-3.4l2.4-.5.7-1.7-1.4-2 2.4-2.4 2 1.4 1.7-.7z"
          fill="currentColor"
        />
        <circle cx="12" cy="12" r="3.4" fill="var(--wp-field)" />
      </svg>
    </span>
  );
}
