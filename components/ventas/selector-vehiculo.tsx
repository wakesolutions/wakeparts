"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useApi } from "@/components/datos/apis";
import ui from "@/components/ui/controles.module.css";
import { IconoAuto, IconoBuscar, IconoCerrar } from "@/components/ui/iconos";
import type { ApiCatalogoVehiculos } from "@/components/compatibilidad/api";
import type { ItemVehiculo, SugerenciaVehiculo, Vehiculo } from "@/lib/vehiculos";
import styles from "./selector-vehiculo.module.css";

type Props = {
  valor: Vehiculo;
  onCambiar: (v: Vehiculo) => void;
  /** Abrir el panel desde afuera (atajo F4). */
  abrirSenal?: number;
};

type Paso = "marca" | "modelo" | "anio" | "motor";

/** Completa los nombres de un vehículo guardado solo con ids. */
export async function resolverVehiculo(
  catalogo: ApiCatalogoVehiculos,
  ids: { id_marca?: number | null; id_modelo?: number | null; id_modelo_anio?: number | null; id_especificacion?: number | null },
): Promise<Vehiculo> {
  const v: Vehiculo = {};
  if (!ids.id_marca) return v;
  const marca = (await catalogo.marcas()).find((m) => m.id === ids.id_marca);
  if (!marca) return v;
  v.marca = { id: marca.id, nombre: marca.nombre };
  if (!ids.id_modelo) return v;
  const modelo = (await catalogo.modelos(marca.id)).find((m) => m.id === ids.id_modelo);
  if (!modelo) return v;
  v.modelo = { id: modelo.id, nombre: modelo.nombre };
  if (!ids.id_modelo_anio) return v;
  const anio = (await catalogo.anios(modelo.id)).find((a) => a.id === ids.id_modelo_anio);
  if (!anio) return v;
  v.anio = { id: anio.id, nombre: anio.nombre };
  if (!ids.id_especificacion) return v;
  const motor = (await catalogo.motores(anio.id)).find((m) => m.id === ids.id_especificacion);
  if (motor) v.motor = { id: motor.id, nombre: motor.nombre, detalle: motor.detalle };
  return v;
}

/**
 * Selector de vehículo con forma de placa. Se escribe «corolla 05» o se
 * recorre Marca › Modelo › Año › Motor. Cada nivel se puede quitar desde la placa.
 */
export function SelectorVehiculo({ valor, onCambiar, abrirSenal }: Props) {
  const catalogo = useApi("vehiculos");
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [sugerencias, setSugerencias] = useState<SugerenciaVehiculo[]>([]);
  const [opciones, setOpciones] = useState<ItemVehiculo[] | null>(null);
  const [activa, setActiva] = useState(0);
  const contenedor = useRef<HTMLDivElement>(null);
  const entrada = useRef<HTMLInputElement>(null);

  const paso: Paso | null = !valor.marca ? "marca" : !valor.modelo ? "modelo" : !valor.anio ? "anio" : !valor.motor ? "motor" : null;

  // Atajo externo para abrir.
  const senalPrevia = useRef(abrirSenal);
  useEffect(() => {
    if (abrirSenal === senalPrevia.current) return;
    senalPrevia.current = abrirSenal;
    setAbierto(true);
  }, [abrirSenal]);

  useEffect(() => {
    if (abierto) entrada.current?.focus();
  }, [abierto, paso]);

  // Opciones del paso actual.
  useEffect(() => {
    if (!abierto || !paso) return;
    let vivo = true;
    const cargar =
      paso === "marca"
        ? catalogo.marcas()
        : paso === "modelo"
          ? catalogo.modelos(valor.marca!.id)
          : paso === "anio"
            ? catalogo.anios(valor.modelo!.id)
            : catalogo.motores(valor.anio!.id);
    cargar.then((o) => vivo && setOpciones(o)).catch(() => vivo && setOpciones([]));
    return () => {
      vivo = false;
    };
  }, [abierto, paso, catalogo, valor.marca, valor.modelo, valor.anio]);

  // Búsqueda libre «corolla 05».
  const buscarLibre = texto.trim().length >= 2 && paso !== "anio" && paso !== "motor";
  useEffect(() => {
    if (!buscarLibre) return;
    let vivo = true;
    const t = setTimeout(() => {
      catalogo.buscar(texto).then((s) => {
        if (!vivo) return;
        setSugerencias(s);
        setActiva(0);
      });
    }, 120);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [buscarLibre, catalogo, texto]);

  useEffect(() => {
    if (!abierto) return;
    const cerrar = (e: PointerEvent) => {
      if (!contenedor.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("pointerdown", cerrar);
    return () => document.removeEventListener("pointerdown", cerrar);
  }, [abierto]);

  const filtro = texto.trim().toLowerCase();
  const visibles = (opciones ?? []).filter((o) => !filtro || `${o.nombre} ${o.detalle ?? ""}`.toLowerCase().includes(filtro));
  const lista = buscarLibre ? sugerencias : visibles;

  function elegirSugerencia(s: SugerenciaVehiculo) {
    onCambiar({
      marca: { id: s.id_marca, nombre: s.marca },
      modelo: { id: s.id_modelo, nombre: s.modelo },
      anio: s.id_modelo_anio ? { id: s.id_modelo_anio, nombre: String(s.anio) } : undefined,
    });
    setTexto("");
    setOpciones(null);
  }

  function elegirOpcion(o: ItemVehiculo) {
    setTexto("");
    setOpciones(null);
    if (paso === "marca") onCambiar({ marca: { id: o.id, nombre: o.nombre } });
    else if (paso === "modelo") onCambiar({ marca: valor.marca, modelo: { id: o.id, nombre: o.nombre } });
    else if (paso === "anio") onCambiar({ ...valor, anio: { id: o.id, nombre: o.nombre }, motor: undefined });
    else if (paso === "motor") {
      onCambiar({ ...valor, motor: { id: o.id, nombre: o.nombre, detalle: o.detalle } });
      setAbierto(false);
    }
  }

  function quitarDesde(nivel: Paso) {
    const v: Vehiculo = {};
    if (nivel !== "marca") v.marca = valor.marca;
    if (nivel !== "marca" && nivel !== "modelo") v.modelo = valor.modelo;
    if (nivel === "motor") v.anio = valor.anio;
    onCambiar(v);
    setOpciones(null);
  }

  function teclear(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiva((a) => Math.min(a + 1, lista.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiva((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = lista[Math.min(activa, lista.length - 1)];
      if (!item) return;
      if (buscarLibre) elegirSugerencia(item as SugerenciaVehiculo);
      else elegirOpcion(item as ItemVehiculo);
    } else if (e.key === "Escape") {
      e.stopPropagation();
      setAbierto(false);
    } else if (e.key === "Backspace" && !texto && valor.marca) {
      // Borrar hacia atrás el último nivel elegido.
      quitarDesde(valor.motor ? "motor" : valor.anio ? "anio" : valor.modelo ? "modelo" : "marca");
    }
  }

  const titulo = [valor.marca?.nombre, valor.modelo?.nombre].filter(Boolean).join(" ");
  const etiquetaPaso = { marca: "Marca", modelo: "Modelo", anio: "Año", motor: "Motor" };

  return (
    <div className={styles.selector} ref={contenedor}>
      <button
        type="button"
        className={styles.placa}
        data-vacia={!valor.marca || undefined}
        aria-expanded={abierto}
        onClick={() => setAbierto((a) => !a)}
      >
        <span className={styles.banda}>
          <span>Vehículo</span>
          <kbd>F4</kbd>
        </span>
        {valor.marca ? (
          <span className={styles.lectura}>
            <span className={styles.titulo}>
              {titulo}
              {valor.anio && <span className={styles.anio}>{valor.anio.nombre}</span>}
            </span>
            <span className={styles.subtitulo}>
              {valor.motor ? [valor.motor.nombre, valor.motor.detalle].filter(Boolean).join(" · ") : valor.anio ? "Cualquier motor" : valor.modelo ? "Todos los años" : "Todos los modelos"}
            </span>
          </span>
        ) : (
          <span className={styles.lectura}>
            <span className={styles.titulo}>¿Qué vehículo?</span>
            <span className={styles.subtitulo}>Sin vehículo: se busca en todo el inventario</span>
          </span>
        )}
        <span className={styles.icono} aria-hidden="true">
          <IconoAuto tamano={26} />
        </span>
      </button>

      {valor.marca && (
        <ul className={styles.migas} aria-label="Vehículo elegido">
          {(
            [
              ["marca", valor.marca],
              ["modelo", valor.modelo],
              ["anio", valor.anio],
              ["motor", valor.motor],
            ] as const
          ).map(
            ([nivel, item]) =>
              item && (
                <li key={nivel}>
                  <button type="button" onClick={() => quitarDesde(nivel)} aria-label={`Quitar ${item.nombre}`}>
                    {item.nombre}
                    <IconoCerrar tamano={10} />
                  </button>
                </li>
              ),
          )}
        </ul>
      )}

      {abierto && (
        <div className={styles.panel} role="dialog" aria-label="Elegir vehículo">
          <label className={styles.buscar}>
            <IconoBuscar tamano={15} />
            <input
              ref={entrada}
              className={`${ui.campo} ${styles.buscarCampo}`}
              placeholder={
                paso === "marca" || paso === "modelo"
                  ? "Escribí modelo y año: «corolla 05», «hilux 2010»"
                  : paso === "anio"
                    ? "Año…"
                    : "Filtrar motores…"
              }
              value={texto}
              onChange={(e) => {
                setTexto(e.target.value);
                setActiva(0);
              }}
              onKeyDown={teclear}
              aria-label="Buscar vehículo"
            />
          </label>

          {paso && !buscarLibre && (
            <p className={styles.paso}>
              <span>{etiquetaPaso[paso]}</span>
              {paso === "motor" && (
                <button type="button" className={styles.cualquiera} onClick={() => setAbierto(false)}>
                  Cualquier motor
                </button>
              )}
            </p>
          )}

          {!paso && !buscarLibre && (
            <p className={styles.listo}>
              Vehículo completo. <button type="button" onClick={() => quitarDesde("motor")}>Cambiar motor</button>
            </p>
          )}

          <ul className={styles.opciones} data-paso={buscarLibre ? "libre" : paso} role="listbox">
            {buscarLibre
              ? sugerencias.map((s, i) => (
                  <li key={`${s.id_modelo}-${s.id_modelo_anio ?? "m"}`}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={i === activa}
                      onPointerEnter={() => setActiva(i)}
                      onClick={() => elegirSugerencia(s)}
                    >
                      <span className={styles.opcionMarca}>{s.marca}</span>
                      <span className={styles.opcionNombre}>{s.modelo}</span>
                      <span className={styles.opcionDetalle}>
                        {s.anio ?? (s.anio_desde ? `${s.anio_desde}–${s.anio_hasta}` : "")}
                      </span>
                    </button>
                  </li>
                ))
              : visibles.map((o, i) => (
                  <li key={o.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={i === activa}
                      onPointerEnter={() => setActiva(i)}
                      onClick={() => elegirOpcion(o)}
                    >
                      <span className={styles.opcionNombre}>{o.nombre}</span>
                      {o.detalle && <span className={styles.opcionDetalle}>{o.detalle}</span>}
                    </button>
                  </li>
                ))}
            {opciones === null && !buscarLibre && paso && <li className={styles.vacio}>Cargando…</li>}
            {lista.length === 0 && (buscarLibre || opciones !== null) && <li className={styles.vacio}>Sin coincidencias</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
