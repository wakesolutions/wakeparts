"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { CampoRelacion } from "@/components/formulario/campo-relacion";
import { useApi } from "@/components/datos/apis";
import ui from "@/components/ui/controles.module.css";
import { IconoAuto, IconoBuscar, IconoCerrar, IconoCopiar, IconoSiguiente } from "@/components/ui/iconos";
import {
  rangosDeAnios,
  type FilaCompat,
  type ItemVehiculo,
  type NivelVehiculo,
  type SugerenciaVehiculo,
} from "@/lib/vehiculos";
import styles from "./editor-compatibilidad.module.css";

type Props = {
  idProducto: number;
  editable: boolean;
  /** Se llama tras cada cambio guardado (p. ej. para refrescar la tabla). */
  onCambio?: () => void;
};

type Estado = "no" | "asignado" | "incluido" | "parcial";
type Ruta = { marca?: ItemVehiculo; modelo?: ItemVehiculo; anio?: ItemVehiculo };

const NIVEL_NUM: Record<NivelVehiculo, 1 | 2 | 3 | 4> = { marca: 1, modelo: 2, anio: 3, especificacion: 4 };
const ETIQUETAS: Record<NivelVehiculo, string> = { marca: "Marca", modelo: "Modelo", anio: "Año", especificacion: "Motor" };

/**
 * Asignación de vehículos a un producto, en columnas (Marca › Modelo › Año ›
 * Motor). Marcar un nivel cubre todo lo de abajo; Mayús+clic marca rangos de
 * años; «corolla 05» salta directo al vehículo.
 */
export function EditorCompatibilidad({ idProducto, editable, onCambio }: Props) {
  const api = useApi("compatibilidad");
  const catalogo = useApi("vehiculos");

  const [filas, setFilas] = useState<FilaCompat[] | null>(null);
  const [ruta, setRuta] = useState<Ruta>({});
  const [listas, setListas] = useState<{ marcas?: ItemVehiculo[]; modelos?: ItemVehiculo[]; anios?: ItemVehiculo[]; motores?: ItemVehiculo[] }>({});
  const [filtros, setFiltros] = useState<Record<NivelVehiculo, string>>({ marca: "", modelo: "", anio: "", especificacion: "" });
  const [pendientes, setPendientes] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const ancla = useRef<{ nivel: NivelVehiculo; indice: number } | null>(null);

  // ------------------------------------------------------------- datos ------
  const recargar = () =>
    api
      .leer(idProducto)
      .then(setFilas)
      .catch(() => setError("No se pudo cargar la compatibilidad."));

  useEffect(() => {
    let vivo = true;
    api
      .leer(idProducto)
      .then((f) => vivo && setFilas(f))
      .catch(() => vivo && setError("No se pudo cargar la compatibilidad."));
    catalogo.marcas().then((marcas) => vivo && setListas((l) => ({ ...l, marcas })));
    return () => {
      vivo = false;
    };
  }, [api, catalogo, idProducto]);

  useEffect(() => {
    let vivo = true;
    if (ruta.marca) catalogo.modelos(ruta.marca.id).then((modelos) => vivo && setListas((l) => ({ ...l, modelos })));
    return () => {
      vivo = false;
    };
  }, [catalogo, ruta.marca]);

  useEffect(() => {
    let vivo = true;
    if (ruta.modelo) catalogo.anios(ruta.modelo.id).then((anios) => vivo && setListas((l) => ({ ...l, anios })));
    return () => {
      vivo = false;
    };
  }, [catalogo, ruta.modelo]);

  useEffect(() => {
    let vivo = true;
    if (ruta.anio) catalogo.motores(ruta.anio.id).then((motores) => vivo && setListas((l) => ({ ...l, motores })));
    return () => {
      vivo = false;
    };
  }, [catalogo, ruta.anio]);

  // ------------------------------------------------------------ estados -----
  const lista = useMemo(() => filas ?? [], [filas]);
  const estado = useMemo(() => {
    const marcasAsig = new Set(lista.filter((f) => f.nivel === 1).map((f) => f.id_marca));
    const modelosAsig = new Set(lista.filter((f) => f.nivel === 2).map((f) => f.id_modelo));
    const aniosAsig = new Set(lista.filter((f) => f.nivel === 3).map((f) => f.id_modelo_anio));
    const motoresAsig = new Set(lista.filter((f) => f.nivel === 4).map((f) => f.id_especificacion));
    const marcasConHijos = new Set(lista.filter((f) => f.nivel > 1).map((f) => f.id_marca));
    const modelosConHijos = new Set(lista.filter((f) => f.nivel > 2).map((f) => f.id_modelo));
    const aniosConHijos = new Set(lista.filter((f) => f.nivel > 3).map((f) => f.id_modelo_anio));
    return {
      marca: (id: number): Estado => (marcasAsig.has(id) ? "asignado" : marcasConHijos.has(id) ? "parcial" : "no"),
      modelo: (id: number): Estado =>
        ruta.marca && marcasAsig.has(ruta.marca.id)
          ? "incluido"
          : modelosAsig.has(id)
            ? "asignado"
            : modelosConHijos.has(id)
              ? "parcial"
              : "no",
      anio: (id: number): Estado =>
        (ruta.marca && marcasAsig.has(ruta.marca.id)) || (ruta.modelo && modelosAsig.has(ruta.modelo.id))
          ? "incluido"
          : aniosAsig.has(id)
            ? "asignado"
            : aniosConHijos.has(id)
              ? "parcial"
              : "no",
      especificacion: (id: number): Estado =>
        (ruta.marca && marcasAsig.has(ruta.marca.id)) ||
        (ruta.modelo && modelosAsig.has(ruta.modelo.id)) ||
        (ruta.anio && aniosAsig.has(ruta.anio.id))
          ? "incluido"
          : motoresAsig.has(id)
            ? "asignado"
            : "no",
    };
  }, [lista, ruta]);

  // -------------------------------------------------------- asignación -------
  /** Cambio optimista + guardado. */
  function aplicar(nivel: NivelVehiculo, items: ItemVehiculo[], asignar: boolean) {
    if (!editable || !items.length || !filas) return;
    const n = NIVEL_NUM[nivel];
    const ids = new Set(items.map((i) => i.id));
    const campo = { 1: "id_marca", 2: "id_modelo", 3: "id_modelo_anio", 4: "id_especificacion" }[n] as keyof FilaCompat;
    const anterior = filas;

    let siguiente: FilaCompat[];
    if (asignar) {
      // Lo nuevo cubre a lo más específico de debajo.
      const base = filas.filter((f) => !(f.nivel > n && ids.has(f[campo] as number)));
      const nuevas = items
        .filter((i) => !base.some((f) => f.nivel === n && f[campo] === i.id))
        .map<FilaCompat>((i, k) => ({
          id: -Date.now() - k,
          nivel: n,
          id_marca: n === 1 ? i.id : ruta.marca!.id,
          marca: n === 1 ? i.nombre : ruta.marca!.nombre,
          id_modelo: n === 2 ? i.id : n > 2 ? ruta.modelo!.id : null,
          modelo: n === 2 ? i.nombre : n > 2 ? ruta.modelo!.nombre : null,
          id_modelo_anio: n === 3 ? i.id : n > 3 ? ruta.anio!.id : null,
          anio: n === 3 ? Number(i.nombre) : n > 3 ? Number(ruta.anio!.nombre) : null,
          id_especificacion: n === 4 ? i.id : null,
          especificacion: n === 4 ? [i.nombre, i.detalle].filter(Boolean).join(" · ") : null,
        }));
      siguiente = [...base, ...nuevas];
    } else {
      siguiente = filas.filter((f) => !(f.nivel === n && ids.has(f[campo] as number)));
    }
    setFilas(siguiente);
    setError(null);
    setPendientes((p) => p + 1);
    api
      .cambiar(idProducto, nivel, [...ids], asignar)
      .then((r) => {
        if (!r.ok) {
          setFilas(anterior);
          setError(r.error);
        } else {
          onCambio?.();
          return recargar();
        }
      })
      .catch(() => {
        setFilas(anterior);
        setError("Sin conexión con el servidor.");
      })
      .finally(() => setPendientes((p) => p - 1));
  }

  function alternar(nivel: NivelVehiculo, visibles: ItemVehiculo[], indice: number, e: MouseEvent | KeyboardEvent) {
    const item = visibles[indice];
    const actual = estado[nivel](item.id);
    if (actual === "incluido") return;
    const asignar = actual !== "asignado";
    // Mayús+clic: rango desde el último marcado de la misma columna.
    if (e.shiftKey && ancla.current?.nivel === nivel) {
      const [a, b] = [ancla.current.indice, indice].sort((x, y) => x - y);
      aplicar(nivel, visibles.slice(a, b + 1), asignar);
    } else {
      aplicar(nivel, [item], asignar);
    }
    ancla.current = { nivel, indice };
  }

  // -------------------------------------------------------- navegación -------
  function ir(nivel: NivelVehiculo, item: ItemVehiculo) {
    if (nivel === "marca") {
      setRuta({ marca: item });
      setListas((l) => ({ marcas: l.marcas }));
      setFiltros((f) => ({ ...f, modelo: "", anio: "", especificacion: "" }));
    } else if (nivel === "modelo") {
      setRuta((r) => ({ marca: r.marca, modelo: item }));
      setListas((l) => ({ marcas: l.marcas, modelos: l.modelos }));
      setFiltros((f) => ({ ...f, anio: "", especificacion: "" }));
    } else if (nivel === "anio") {
      setRuta((r) => ({ ...r, anio: item }));
      setListas((l) => ({ ...l, motores: undefined }));
      setFiltros((f) => ({ ...f, especificacion: "" }));
    }
  }

  function saltar(s: SugerenciaVehiculo) {
    setRuta({
      marca: { id: s.id_marca, nombre: s.marca },
      modelo: { id: s.id_modelo, nombre: s.modelo },
      anio: s.id_modelo_anio ? { id: s.id_modelo_anio, nombre: String(s.anio) } : undefined,
    });
    setListas((l) => ({ marcas: l.marcas }));
    setFiltros({ marca: "", modelo: "", anio: "", especificacion: "" });
  }

  // ------------------------------------------------------------ resumen ------
  const resumen = useMemo(() => agrupar(lista), [lista]);

  function quitarGrupo(g: Grupo) {
    const porNivel = new Map<NivelVehiculo, ItemVehiculo[]>();
    for (const f of g.filas) {
      const nivel = (["marca", "modelo", "anio", "especificacion"] as const)[f.nivel - 1];
      const id = [f.id_marca, f.id_modelo, f.id_modelo_anio, f.id_especificacion][f.nivel - 1]!;
      porNivel.set(nivel, [...(porNivel.get(nivel) ?? []), { id, nombre: "" }]);
    }
    for (const [nivel, items] of porNivel) aplicar(nivel, items, false);
  }

  // ------------------------------------------------------------ render -------
  const columnas: { nivel: NivelVehiculo; items?: ItemVehiculo[]; titulo: string; activo?: number }[] = [
    { nivel: "marca", items: listas.marcas, titulo: "Marcas", activo: ruta.marca?.id },
    { nivel: "modelo", items: ruta.marca ? listas.modelos : [], titulo: ruta.marca?.nombre ?? "Modelos", activo: ruta.modelo?.id },
    { nivel: "anio", items: ruta.modelo ? listas.anios : [], titulo: ruta.modelo?.nombre ?? "Años", activo: ruta.anio?.id },
    { nivel: "especificacion", items: ruta.anio ? listas.motores : [], titulo: ruta.anio ? `${ruta.anio.nombre}` : "Motores" },
  ];

  return (
    <div className={styles.editor}>
      <div className={styles.barra}>
        <SaltoVehiculo onElegir={saltar} />
        <span className={styles.estado} data-activo={pendientes > 0 || undefined} role="status">
          <span className={styles.led} aria-hidden="true" />
          {pendientes > 0 ? "Guardando…" : filas ? "Guardado" : "Cargando…"}
        </span>
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.cuerpo}>
        <div className={styles.columnas}>
          {columnas.map((c, i) => (
            <Columna
              key={c.nivel}
              nivel={c.nivel}
              titulo={c.titulo}
              items={c.items}
              vacia={i > 0 && !columnas[i - 1].activo}
              anterior={i > 0 ? ETIQUETAS[columnas[i - 1].nivel].toLowerCase() : undefined}
              activo={c.activo}
              filtro={filtros[c.nivel]}
              editable={editable}
              estado={estado[c.nivel]}
              onFiltro={(v) => setFiltros((f) => ({ ...f, [c.nivel]: v }))}
              onIr={c.nivel === "especificacion" ? undefined : (item) => ir(c.nivel, item)}
              onAlternar={(visibles, indice, e) => alternar(c.nivel, visibles, indice, e)}
              onTodos={(visibles, asignar) => aplicar(c.nivel, visibles, asignar)}
            />
          ))}
        </div>

        <aside className={styles.resumen} aria-label="Vehículos asignados">
          <header className={styles.resumenCabeza}>
            <p className={ui.etiquetaSeccion}>Le queda a</p>
            <strong className={styles.resumenTotal}>{resumen.length}</strong>
          </header>
          {filas && resumen.length === 0 && (
            <div className={styles.universal}>
              <IconoAuto tamano={22} />
              <p>
                <strong>Sin vehículos.</strong> En la búsqueda aparece como <em>producto general</em>: sirve para
                cualquiera (aceites, herramientas, químicos…).
              </p>
            </div>
          )}
          <ul className={styles.grupos}>
            {resumen.map((g, i) => (
              <li key={g.clave} className={styles.grupo} style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}>
                <button
                  type="button"
                  className={styles.grupoIr}
                  onClick={() =>
                    setRuta({
                      marca: { id: g.filas[0].id_marca, nombre: g.filas[0].marca },
                      modelo: g.filas[0].id_modelo ? { id: g.filas[0].id_modelo, nombre: g.filas[0].modelo ?? "" } : undefined,
                    })
                  }
                >
                  <span className={styles.grupoTitulo}>{g.titulo}</span>
                  <span className={styles.grupoDetalle}>{g.detalle}</span>
                </button>
                {editable && (
                  <button
                    type="button"
                    className={styles.grupoQuitar}
                    aria-label={`Quitar ${g.titulo} ${g.detalle}`}
                    onClick={() => quitarGrupo(g)}
                  >
                    <IconoCerrar tamano={11} />
                  </button>
                )}
              </li>
            ))}
          </ul>
          {editable && <CopiarDe idProducto={idProducto} onCopiado={() => { onCambio?.(); void recargar(); }} />}
        </aside>
      </div>

      <p className={styles.pista}>
        Marcá una <strong>marca</strong> o un <strong>modelo</strong> completo, o años sueltos ·{" "}
        <kbd>Mayús</kbd>+clic marca un rango · en Años podés filtrar <kbd>2003-2008</kbd> y marcar todos.
      </p>
    </div>
  );
}

// --------------------------------------------------------------- columna ----

function filtrar(nivel: NivelVehiculo, items: ItemVehiculo[], filtro: string) {
  const f = filtro.trim().toLowerCase();
  if (!f) return items;
  if (nivel === "anio") {
    // «2003-2008», «03-08», «2005»
    const rango = f.match(/^(\d{2,4})\s*[-–a]\s*(\d{2,4})$/);
    const año = (t: string) => (t.length === 2 ? (Number(t) >= 50 ? 1900 : 2000) + Number(t) : Number(t));
    if (rango) {
      const [a, b] = [año(rango[1]), año(rango[2])].sort((x, y) => x - y);
      return items.filter((i) => Number(i.nombre) >= a && Number(i.nombre) <= b);
    }
  }
  return items.filter((i) => `${i.nombre} ${i.detalle ?? ""}`.toLowerCase().includes(f));
}

function Columna({
  nivel,
  titulo,
  items,
  vacia,
  anterior,
  activo,
  filtro,
  editable,
  estado,
  onFiltro,
  onIr,
  onAlternar,
  onTodos,
}: {
  nivel: NivelVehiculo;
  titulo: string;
  items?: ItemVehiculo[];
  vacia: boolean;
  anterior?: string;
  activo?: number;
  filtro: string;
  editable: boolean;
  estado: (id: number) => Estado;
  onFiltro: (v: string) => void;
  onIr?: (item: ItemVehiculo) => void;
  onAlternar: (visibles: ItemVehiculo[], indice: number, e: MouseEvent | KeyboardEvent) => void;
  onTodos: (visibles: ItemVehiculo[], asignar: boolean) => void;
}) {
  const visibles = useMemo(() => filtrar(nivel, items ?? [], filtro), [nivel, items, filtro]);
  const lista = useRef<HTMLUListElement>(null);
  const asignables = visibles.filter((i) => estado(i.id) !== "incluido");
  const todosMarcados = asignables.length > 0 && asignables.every((i) => estado(i.id) === "asignado");

  function teclear(e: KeyboardEvent<HTMLUListElement>) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const botones = [...(lista.current?.querySelectorAll<HTMLButtonElement>("[data-nav]") ?? [])];
    const i = botones.indexOf(document.activeElement as HTMLButtonElement);
    botones[Math.max(0, Math.min(botones.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)))]?.focus();
  }

  return (
    <section className={styles.columna} aria-label={ETIQUETAS[nivel]}>
      <header className={styles.columnaCabeza}>
        <p className={styles.columnaEtiqueta}>{ETIQUETAS[nivel]}</p>
        <p className={styles.columnaTitulo} title={titulo}>
          {titulo}
        </p>
        <input
          type="search"
          className={`${ui.campo} ${styles.columnaFiltro}`}
          placeholder={nivel === "anio" ? "2003-2008" : "Filtrar…"}
          aria-label={`Filtrar ${ETIQUETAS[nivel].toLowerCase()}`}
          value={filtro}
          disabled={vacia}
          onChange={(e) => onFiltro(e.target.value)}
        />
        {editable && nivel !== "marca" && !vacia && asignables.length > 1 && (
          <button type="button" className={styles.todos} onClick={() => onTodos(asignables, !todosMarcados)}>
            {todosMarcados ? "Desmarcar" : "Marcar"} {filtro ? `los ${asignables.length}` : "todos"}
          </button>
        )}
      </header>

      {vacia ? (
        <p className={styles.columnaVacia}>Elegí {anterior === "año" ? "un año" : `una ${anterior}`}</p>
      ) : !items ? (
        <div className={styles.columnaCargando} aria-label="Cargando" />
      ) : (
        <ul className={styles.items} ref={lista} onKeyDown={teclear} role="list">
          {visibles.map((item, i) => {
            const e = estado(item.id);
            return (
              <li key={item.id} className={styles.item} data-activo={activo === item.id || undefined} data-estado={e}>
                <button
                  type="button"
                  className={styles.check}
                  data-estado={e}
                  disabled={!editable || e === "incluido"}
                  aria-pressed={e === "asignado"}
                  aria-label={`${e === "asignado" ? "Quitar" : "Asignar"} ${item.nombre}`}
                  title={e === "incluido" ? "Incluido por un nivel superior" : e === "parcial" ? "Parte asignada" : undefined}
                  onClick={(ev) => onAlternar(visibles, i, ev)}
                />
                {onIr ? (
                  <button type="button" className={styles.nombre} data-nav="" onClick={() => onIr(item)}>
                    <span className={styles.nombreTexto}>{item.nombre}</span>
                    <span className={styles.detalle}>{item.detalle}</span>
                    <IconoSiguiente tamano={12} className={styles.flecha} />
                  </button>
                ) : (
                  <button
                    type="button"
                    className={styles.nombre}
                    data-nav=""
                    disabled={!editable || e === "incluido"}
                    onClick={(ev) => onAlternar(visibles, i, ev)}
                  >
                    <span className={styles.nombreTexto}>{item.nombre}</span>
                    <span className={styles.detalle}>{item.detalle}</span>
                  </button>
                )}
              </li>
            );
          })}
          {visibles.length === 0 && <li className={styles.columnaVacia}>Sin coincidencias</li>}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------- salto rápido ----

function SaltoVehiculo({ onElegir }: { onElegir: (s: SugerenciaVehiculo) => void }) {
  const catalogo = useApi("vehiculos");
  const listaId = useId();
  const [texto, setTexto] = useState("");
  const [sugerencias, setSugerencias] = useState<SugerenciaVehiculo[]>([]);
  const [activa, setActiva] = useState(0);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (texto.trim().length < 2) return;
    let vivo = true;
    const t = setTimeout(() => {
      catalogo
        .buscar(texto)
        .then((s) => {
          if (!vivo) return;
          setSugerencias(s);
          setActiva(0);
        })
        .catch(() => {});
    }, 140);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [catalogo, texto]);

  const visibles = texto.trim().length < 2 ? [] : sugerencias;

  function elegir(s: SugerenciaVehiculo) {
    onElegir(s);
    setTexto("");
    setAbierto(false);
  }

  return (
    <div className={styles.salto}>
      <IconoBuscar tamano={14} />
      <input
        type="search"
        className={`${ui.campo} ${styles.saltoCampo}`}
        placeholder="Ir a un vehículo: «corolla 05», «hilux 2010»…"
        aria-label="Ir a un vehículo"
        role="combobox"
        aria-controls={listaId}
        aria-expanded={abierto && visibles.length > 0}
        value={texto}
        onFocus={() => setAbierto(true)}
        onBlur={() => setTimeout(() => setAbierto(false), 120)}
        onChange={(e) => {
          setTexto(e.target.value);
          setAbierto(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiva((a) => Math.min(a + 1, visibles.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiva((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && visibles[activa]) {
            e.preventDefault();
            elegir(visibles[activa]);
          }
        }}
      />
      {abierto && visibles.length > 0 && (
        <ul className={styles.saltoLista} role="listbox" id={listaId}>
          {visibles.map((s, i) => (
            <li
              key={`${s.id_modelo}-${s.id_modelo_anio ?? "m"}`}
              role="option"
              aria-selected={i === activa}
              onPointerDown={(e) => {
                e.preventDefault();
                elegir(s);
              }}
              onPointerEnter={() => setActiva(i)}
            >
              <span className={styles.saltoMarca}>{s.marca}</span> {s.modelo}
              <span className={styles.saltoAnio}>
                {s.anio ?? (s.anio_desde ? `${s.anio_desde}–${s.anio_hasta}` : "")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ------------------------------------------------------------- copiar de ----

function CopiarDe({ idProducto, onCopiado }: { idProducto: number; onCopiado: () => void }) {
  const api = useApi("compatibilidad");
  const [origen, setOrigen] = useState<string | number | null>(null);
  const [estado, setEstado] = useState<string | null>(null);

  return (
    <div className={styles.copiar}>
      <p className={ui.etiquetaSeccion}>Copiar de otro producto</p>
      <CampoRelacion
        id={`copiar-${idProducto}`}
        fuente={{ recurso: "productos", valor: "id", etiqueta: ["codigo", "nombre"] }}
        valor={origen}
        onCambiar={setOrigen}
      />
      <button
        type="button"
        className={ui.boton}
        disabled={!origen}
        onClick={() =>
          api.copiar(Number(origen), idProducto).then((r) => {
            setEstado(r.ok ? "Copiado." : r.error);
            if (r.ok) {
              setOrigen(null);
              onCopiado();
            }
          })
        }
      >
        <IconoCopiar tamano={14} /> Copiar vehículos
      </button>
      {estado && <p className={styles.copiarEstado}>{estado}</p>}
    </div>
  );
}

// --------------------------------------------------------------- resumen ----

type Grupo = { clave: string; titulo: string; detalle: string; filas: FilaCompat[] };

/** TOYOTA · toda la marca / TOYOTA COROLLA · 2003–2006, 2008 / … 2005 · 1.8 L */
function agrupar(filas: FilaCompat[]): Grupo[] {
  const grupos: Grupo[] = [];
  const porModelo = new Map<string, FilaCompat[]>();
  for (const f of filas) {
    if (f.nivel === 1) grupos.push({ clave: `m${f.id_marca}`, titulo: f.marca, detalle: "Toda la marca", filas: [f] });
    else if (f.nivel === 2)
      grupos.push({ clave: `o${f.id_modelo}`, titulo: `${f.marca} ${f.modelo}`, detalle: "Todos los años", filas: [f] });
    else if (f.nivel === 3) {
      const k = `${f.id_modelo}`;
      porModelo.set(k, [...(porModelo.get(k) ?? []), f]);
    } else {
      grupos.push({
        clave: `e${f.id_especificacion}`,
        titulo: `${f.marca} ${f.modelo} ${f.anio}`,
        detalle: f.especificacion ?? "",
        filas: [f],
      });
    }
  }
  for (const [k, fs] of porModelo) {
    grupos.push({
      clave: `a${k}`,
      titulo: `${fs[0].marca} ${fs[0].modelo}`,
      detalle: rangosDeAnios(fs.map((f) => f.anio!)),
      filas: fs,
    });
  }
  return grupos.sort((a, b) => a.titulo.localeCompare(b.titulo, "es"));
}
