"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useApi } from "@/components/datos/apis";
import { useVentanas } from "@/components/ventanas/contexto";
import { useVentanaActual } from "@/components/ventanas/ventana";
import ui from "@/components/ui/controles.module.css";
import { IconoBuscar, IconoCarrito, IconoCerrar, IconoImprimir, IconoMas } from "@/components/ui/iconos";
import { moneda } from "@/lib/formato";
import {
  calcularTotales,
  type CambiosCarrito,
  type CambiosLinea,
  type Carrito,
  type LineaCarrito,
  type ResultadoBusqueda,
  type TipoDocumento,
} from "@/lib/ventas";
import { textoVehiculo, type Vehiculo } from "@/lib/vehiculos";
import { Resultados } from "./resultados";
import { resolverVehiculo, SelectorVehiculo } from "./selector-vehiculo";
import { Ticket } from "./ticket";
import styles from "./mostrador.module.css";

const EVENTO_CARRITO = "wp:abrir-carrito";
let carritoPendiente: string | null = null;

/**
 * Pide al mostrador que muestre un carrito (p. ej. «cotización → carrito»).
 * Si el mostrador todavía no está abierto, lo toma al montarse.
 */
export function abrirCarritoEnMostrador(id: string) {
  carritoPendiente = id;
  window.dispatchEvent(new CustomEvent(EVENTO_CARRITO, { detail: id }));
}

function tomarPendiente() {
  const id = carritoPendiente;
  carritoPendiente = null;
  return id ?? undefined;
}

type Emitido = { id: string; numero: string; tipo: TipoDocumento; total: number };

const normal = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/**
 * Mostrador de «Cotizar y facturar»: carritos en pestañas, vehículo en placa,
 * búsqueda instantánea agrupada por compatibilidad y ticket con totales.
 */
export function Mostrador({ veMargen }: { veMargen: boolean }) {
  const api = useApi("ventas");
  const catalogo = useApi("vehiculos");

  const [carritos, setCarritos] = useState<Carrito[] | null>(null);
  const [activoId, setActivoId] = useState<string | null>(null);
  const [lineas, setLineas] = useState<Record<string, LineaCarrito[]>>({});
  const [vehiculos, setVehiculos] = useState<Record<string, Vehiculo>>({});
  const [texto, setTexto] = useState("");
  const [consulta, setConsulta] = useState<{ texto: string; resultados: ResultadoBusqueda[] }>({ texto: "", resultados: [] });
  const [buscando, setBuscando] = useState(false);
  const [indice, setIndice] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [emitido, setEmitido] = useState<Emitido | null>(null);
  const [vista, setVista] = useState<"buscar" | "carrito">("buscar");
  const [senalVehiculo, setSenalVehiculo] = useState(0);
  const buscador = useRef<HTMLInputElement>(null);

  const carrito = carritos?.find((c) => c.id === activoId) ?? null;
  const lineasActivas = useMemo(() => (activoId ? (lineas[activoId] ?? []) : []), [activoId, lineas]);
  const vehiculo = (activoId && vehiculos[activoId]) || {};

  // ------------------------------------------------------------ carritos ---
  const cargarCarritos = useCallback(
    async (seleccionar?: string) => {
      let lista = await api.carritos().catch(() => [] as Carrito[]);
      if (!lista.length) {
        const r = await api.crearCarrito();
        if (r.ok) lista = [r.carrito];
      }
      setCarritos(lista);
      setActivoId((actual) => seleccionar ?? (lista.some((c) => c.id === actual) ? actual : (lista[0]?.id ?? null)));
    },
    [api],
  );

  useEffect(() => {
    // Diferido: en modo estricto el primer montaje se cancela sin crear carritos de más.
    const t = setTimeout(() => void cargarCarritos(tomarPendiente()), 0);
    return () => clearTimeout(t);
  }, [cargarCarritos]);

  // Abrir un carrito creado desde un documento (módulo Ventas).
  useEffect(() => {
    const abrir = () => void cargarCarritos(tomarPendiente());
    window.addEventListener(EVENTO_CARRITO, abrir);
    return () => window.removeEventListener(EVENTO_CARRITO, abrir);
  }, [cargarCarritos]);

  // Líneas y vehículo del carrito activo.
  useEffect(() => {
    if (!carrito) return;
    let vivo = true;
    if (!lineas[carrito.id]) {
      api.lineas(carrito.id).then((l) => vivo && setLineas((m) => ({ ...m, [carrito.id]: l })));
    }
    if (!vehiculos[carrito.id]) {
      resolverVehiculo(catalogo, carrito).then((v) => vivo && setVehiculos((m) => ({ ...m, [carrito.id]: v })));
    }
    return () => {
      vivo = false;
    };
    // Solo al cambiar de carrito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carrito?.id, api, catalogo]);

  async function nuevoCarrito() {
    const r = await api.crearCarrito();
    if (!r.ok) return setError(r.error);
    setCarritos((c) => [...(c ?? []), r.carrito]);
    setActivoId(r.carrito.id);
    setEmitido(null);
    buscador.current?.focus();
  }

  async function descartar(id: string) {
    const r = await api.descartarCarrito(id);
    if (!r.ok) return setError(r.error);
    const resto = (carritos ?? []).filter((c) => c.id !== id);
    if (!resto.length) return cargarCarritos();
    setCarritos(resto);
    if (activoId === id) setActivoId(resto[0].id);
  }

  function cambiarCarrito(cambios: CambiosCarrito) {
    if (!carrito) return;
    const id = carrito.id;
    setCarritos((cs) => cs?.map((c) => (c.id === id ? { ...c, ...cambios } : c)) ?? cs);
    setError(null);
    api.actualizarCarrito(id, cambios).then((r) => {
      if (r.ok) setCarritos((cs) => cs?.map((c) => (c.id === id ? r.carrito : c)) ?? cs);
      else {
        setError(r.error);
        // Volver al estado real.
        void cargarCarritos(id);
      }
    });
  }

  function cambiarVehiculo(v: Vehiculo) {
    if (!carrito) return;
    setVehiculos((m) => ({ ...m, [carrito.id]: v }));
    cambiarCarrito({
      id_marca: v.marca?.id ?? null,
      id_modelo: v.modelo?.id ?? null,
      id_modelo_anio: v.anio?.id ?? null,
      id_especificacion: v.motor?.id ?? null,
    });
  }

  // -------------------------------------------------------------- líneas ---
  const ponerLineas = (id: string, f: (l: LineaCarrito[]) => LineaCarrito[]) =>
    setLineas((m) => ({ ...m, [id]: f(m[id] ?? []) }));

  function agregar(r: ResultadoBusqueda) {
    if (!carrito) return;
    const id = carrito.id;
    setError(null);
    const existente = lineasActivas.find((l) => l.id_producto === r.id);
    if (existente) return cambiarLinea(existente.id, { cantidad: existente.cantidad + 1 });

    const temporal: LineaCarrito = {
      id: -Date.now(),
      id_carrito: id,
      id_producto: r.id,
      codigo: r.codigo,
      descripcion: r.nombre,
      cantidad: 1,
      precio: r.precio,
      descuento_pct: 0,
      exento: r.exento,
      orden: lineasActivas.length + 1,
      costo: r.costo,
      existencia: r.existencia,
      controla_inventario: r.controla_inventario,
      unidad: r.unidad,
      oem: r.oem,
      imagen: r.imagen,
    };
    ponerLineas(id, (l) => [...l, temporal]);
    api
      .agregarLinea(id, { id_producto: r.id, codigo: r.codigo, descripcion: r.nombre, cantidad: 1, precio: r.precio, exento: r.exento })
      .then((res) => {
        if (res.ok) ponerLineas(id, (l) => l.map((x) => (x.id === temporal.id ? res.linea : x)));
        else {
          ponerLineas(id, (l) => l.filter((x) => x.id !== temporal.id));
          setError(res.error);
        }
      });
  }

  function lineaLibre(descripcion: string, precio: number, exento: boolean) {
    if (!carrito) return;
    const id = carrito.id;
    api.agregarLinea(id, { descripcion, precio, exento, cantidad: 1 }).then((res) => {
      if (res.ok) ponerLineas(id, (l) => [...l, res.linea]);
      else setError(res.error);
    });
  }

  function cambiarLinea(idLinea: number, cambios: CambiosLinea) {
    if (!carrito) return;
    const id = carrito.id;
    const anterior = lineasActivas;
    ponerLineas(id, (l) => l.map((x) => (x.id === idLinea ? { ...x, ...cambios } : x)));
    setError(null);
    if (idLinea < 0) return; // todavía no llegó del servidor
    api.actualizarLinea(idLinea, cambios).then((r) => {
      if (!r.ok) {
        ponerLineas(id, () => anterior);
        setError(r.error);
      }
    });
  }

  function quitarLinea(idLinea: number) {
    if (!carrito) return;
    const id = carrito.id;
    const anterior = lineasActivas;
    ponerLineas(id, (l) => l.filter((x) => x.id !== idLinea));
    if (idLinea < 0) return;
    api.quitarLinea(idLinea).then((r) => {
      if (!r.ok) {
        ponerLineas(id, () => anterior);
        setError(r.error);
      }
    });
  }

  async function emitir(tipo: TipoDocumento) {
    if (!carrito) return;
    setOcupado(true);
    setError(null);
    const total = calcularTotales(lineasActivas, carrito.descuento_pct).total;
    const r = await api.emitir(carrito.id, tipo).catch(() => ({ ok: false as const, error: "Sin conexión con el servidor." }));
    setOcupado(false);
    if (!r.ok) return setError(r.error);
    setEmitido({ id: r.id, numero: r.numero, tipo, total });
    setTexto("");
    let resto = (carritos ?? []).filter((c) => c.id !== carrito.id);
    // Siguiente cliente: si no quedan carritos, se abre uno vacío.
    if (!resto.length) {
      const nuevo = await api.crearCarrito();
      if (nuevo.ok) resto = [nuevo.carrito];
    }
    setCarritos(resto);
    setActivoId(resto[0]?.id ?? null);
  }

  // ------------------------------------------------------------ búsqueda ---
  const idsVehiculo = carrito
    ? `${carrito.id_marca ?? ""}|${carrito.id_modelo ?? ""}|${carrito.id_modelo_anio ?? ""}|${carrito.id_especificacion ?? ""}`
    : "";
  const peticion = useRef(0);
  useEffect(() => {
    if (!carrito) return;
    const n = ++peticion.current;
    const t = setTimeout(
      () => {
        setBuscando(true);
        api
          .buscar({
            texto,
            vehiculo: {
              id_marca: carrito.id_marca,
              id_modelo: carrito.id_modelo,
              id_modelo_anio: carrito.id_modelo_anio,
              id_especificacion: carrito.id_especificacion,
            },
            limite: 60,
          })
          .then((resultados) => {
            if (n !== peticion.current) return;
            setConsulta({ texto, resultados });
            setIndice(0);
          })
          .catch(() => {})
          .finally(() => n === peticion.current && setBuscando(false));
      },
      texto ? 110 : 0,
    );
    return () => clearTimeout(t);
    // idsVehiculo resume el vehículo del carrito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, texto, idsVehiculo, carrito?.id]);

  // Mientras llega la respuesta, se afina localmente lo que ya se tiene.
  const resultados = useMemo(() => {
    const previo = normal(consulta.texto.trim());
    const actual = normal(texto.trim());
    if (!actual || actual === previo || !actual.startsWith(previo)) return consulta.resultados;
    const palabras = actual.split(/\s+/).filter(Boolean);
    return consulta.resultados.filter((r) => {
      const heno = normal(`${r.nombre} ${r.codigo} ${r.marca ?? ""} ${r.oem ?? ""} ${r.categoria}`);
      return palabras.every((p) => heno.includes(p));
    });
  }, [consulta, texto]);

  const enCarrito = useMemo(() => {
    const m = new Map<number, number>();
    for (const l of lineasActivas) if (l.id_producto) m.set(l.id_producto, (m.get(l.id_producto) ?? 0) + l.cantidad);
    return m;
  }, [lineasActivas]);

  // -------------------------------------------------------------- teclado --
  function teclearBuscador(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndice((i) => Math.min(i + 1, resultados.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndice((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && resultados[indice]) {
      e.preventDefault();
      agregar(resultados[indice]);
    } else if (e.key === "Escape" && texto) {
      e.stopPropagation();
      setTexto("");
    }
  }

  // Atajos del mostrador: activos mientras su ventana es la enfocada.
  const ventana = useVentanaActual();
  const { enfocada } = useVentanas();
  const atajosActivos = !ventana || enfocada === ventana;
  const manejarAtajo = useRef<(e: globalThis.KeyboardEvent) => void>(() => {});
  useEffect(() => {
    manejarAtajo.current = teclearModulo;
  });
  useEffect(() => {
    if (!atajosActivos) return;
    const f = (e: globalThis.KeyboardEvent) => manejarAtajo.current(e);
    document.addEventListener("keydown", f);
    return () => document.removeEventListener("keydown", f);
  }, [atajosActivos]);

  function teclearModulo(e: globalThis.KeyboardEvent) {
    if (e.key === "F2" || (e.key === "/" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement))) {
      e.preventDefault();
      setVista("buscar");
      buscador.current?.focus();
    } else if (e.key === "F4") {
      e.preventDefault();
      setVista("buscar");
      setSenalVehiculo((n) => n + 1);
    } else if (e.key === "F9" && lineasActivas.length) {
      e.preventDefault();
      setVista("carrito");
      document.querySelector<HTMLButtonElement>(`[data-mostrador="${activoId}"] [data-facturar]`)?.click();
    }
  }

  useEffect(() => {
    const el = document.querySelector<HTMLElement>(`[data-mostrador] [data-indice="${indice}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [indice]);

  // --------------------------------------------------------------- render ---
  const nombreVehiculo = textoVehiculo(vehiculo) || "este vehículo";
  const totalActual = carrito ? calcularTotales(lineasActivas, carrito.descuento_pct).total : 0;

  return (
    <div className={styles.mostrador} data-mostrador={activoId ?? ""} data-vista={vista}>
      {/* ------------------------------------------------ carritos ---- */}
      <nav className={styles.carritos} aria-label="Carritos abiertos">
        <ul>
          {(carritos ?? []).map((c, i) => {
            const nombre = c.cliente_nombre ?? c.nombre ?? `Carrito ${i + 1}`;
            const n = c.id === activoId ? lineasActivas.length : c.lineas;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  className={styles.pestana}
                  aria-current={c.id === activoId || undefined}
                  onClick={() => {
                    setActivoId(c.id);
                    setEmitido(null);
                  }}
                >
                  <IconoCarrito tamano={13} />
                  <span className={styles.pestanaNombre}>{nombre}</span>
                  {c.vehiculo && <span className={styles.pestanaVehiculo}>{c.vehiculo}</span>}
                  <span className={styles.pestanaCuenta}>{n}</span>
                </button>
              </li>
            );
          })}
          <li>
            <button type="button" className={styles.nuevo} onClick={nuevoCarrito} aria-label="Nuevo carrito" title="Nuevo carrito">
              <IconoMas tamano={14} />
            </button>
          </li>
        </ul>
        <div className={styles.segmento} role="tablist" aria-label="Vista">
          <button type="button" role="tab" aria-selected={vista === "buscar"} onClick={() => setVista("buscar")}>
            Buscar
          </button>
          <button type="button" role="tab" aria-selected={vista === "carrito"} onClick={() => setVista("carrito")}>
            Carrito · {moneda(totalActual)}
          </button>
        </div>
      </nav>

      {/* ------------------------------------------------ búsqueda ---- */}
      <section className={styles.busqueda} aria-label="Búsqueda de productos">
        <SelectorVehiculo valor={vehiculo} onCambiar={cambiarVehiculo} abrirSenal={senalVehiculo} />

        <label className={styles.buscar} data-cargando={buscando || undefined}>
          <IconoBuscar tamano={18} />
          <input
            ref={buscador}
            type="search"
            className={styles.buscarCampo}
            placeholder="Buscar repuesto, código, OEM o equivalencia…"
            aria-label="Buscar productos"
            autoComplete="off"
            spellCheck={false}
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              setEmitido(null);
            }}
            onKeyDown={teclearBuscador}
          />
          <span className={styles.atajos} aria-hidden="true">
            <kbd>↑↓</kbd> elegir <kbd>↵</kbd> agregar
          </span>
          <span className={styles.barrido} aria-hidden="true" />
        </label>

        <div className={styles.resultados}>
          {emitido ? (
            <Sello emitido={emitido} onNuevo={nuevoCarrito} onCerrar={() => setEmitido(null)} urlImpresion={api.urlImpresion(emitido.id)} />
          ) : resultados.length ? (
            <Resultados
              resultados={resultados}
              vehiculo={nombreVehiculo}
              texto={texto}
              activo={indice}
              enCarrito={enCarrito}
              onAgregar={agregar}
              onActivo={setIndice}
            />
          ) : (
            <div className={styles.sinResultados}>
              {!carritos ? (
                <p>Preparando el mostrador…</p>
              ) : texto ? (
                <>
                  <p className={styles.sinTitulo}>Nada con «{texto}»</p>
                  <p>Probá con otra palabra, el código OEM o quitá el vehículo.</p>
                </>
              ) : (
                <>
                  <p className={styles.sinTitulo}>Listo para vender</p>
                  <p>Elegí el vehículo del cliente y escribí qué necesita. También funciona con códigos y números OEM.</p>
                </>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ------------------------------------------------ ticket ------ */}
      <div className={styles.lado}>
        {carrito ? (
          <Ticket
            key={carrito.id}
            carrito={carrito}
            lineas={lineasActivas}
            veMargen={veMargen}
            ocupado={ocupado}
            error={error}
            onCambiarCarrito={cambiarCarrito}
            onCambiarLinea={cambiarLinea}
            onQuitarLinea={quitarLinea}
            onLineaLibre={lineaLibre}
            onEmitir={emitir}
            onDescartar={() => void descartar(carrito.id)}
          />
        ) : (
          <div className={styles.sinCarrito}>
            <p>No hay carritos abiertos.</p>
            <button type="button" className={`${ui.boton} ${ui.primario}`} onClick={nuevoCarrito}>
              <IconoMas tamano={14} /> Nuevo carrito
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Sello de documento emitido. */
function Sello({
  emitido,
  onNuevo,
  onCerrar,
  urlImpresion,
}: {
  emitido: Emitido;
  onNuevo: () => void;
  onCerrar: () => void;
  urlImpresion: string;
}) {
  return (
    <div className={styles.emitido} role="status">
      <button type="button" className={`${ui.boton} ${ui.fantasma} ${styles.emitidoCerrar}`} onClick={onCerrar} aria-label="Cerrar">
        <IconoCerrar tamano={14} />
      </button>
      <div className={styles.sello}>
        <span className={styles.selloTipo}>{emitido.tipo === "factura" ? "Facturado" : "Cotizado"}</span>
        <span className={styles.selloNumero}>{emitido.numero}</span>
        <span className={styles.selloTotal}>{moneda(emitido.total)}</span>
      </div>
      <div className={styles.emitidoAcciones}>
        <a className={`${ui.boton} ${ui.primario}`} href={urlImpresion} target="_blank" rel="noopener">
          <IconoImprimir tamano={14} /> Imprimir
        </a>
        <button type="button" className={ui.boton} onClick={onNuevo}>
          <IconoMas tamano={14} /> Nuevo carrito
        </button>
      </div>
    </div>
  );
}
