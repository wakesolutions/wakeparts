"use client";

import { useState, type ReactNode } from "react";
import { accionEliminar, accionGuardar, accionLeer } from "@/app/acciones/recursos";
import { Formulario } from "@/components/formulario/formulario";
import { invalidarOpciones } from "@/components/tabla-maestra/opciones-cache";
import { TablaMaestra } from "@/components/tabla-maestra/tabla-maestra";
import ui from "@/components/ui/controles.module.css";
import { useVentanaActual } from "@/components/ventanas/ventana";
import { VentanaFlotante } from "@/components/ventanas/ventana-flotante";
import { obtenerRecurso, textoNuevo } from "@/lib/recursos";
import type { Fila } from "@/lib/recursos/tipos";
import styles from "./mantenimiento.module.css";

/** Pestaña extra de la ventana de edición (solo con un registro guardado). */
export type Pestana = {
  id: string;
  titulo: string;
  /** Contador opcional junto al título (p. ej. cantidad de fotos). */
  contador?: number;
  contenido: ReactNode;
};

export type ContextoPestanas = {
  clave: string | number;
  fila: Fila;
  /** Recarga la tabla y resalta la fila (tras cambios hechos en una pestaña). */
  refrescar: () => void;
};

type Props = {
  /** Id del recurso registrado en lib/recursos. */
  recurso: string;
  /** Permisos del usuario actual para este recurso. */
  puedeEditar: boolean;
  /** Pestañas extra al editar (fotos, compatibilidad…). La primera siempre es «Datos». */
  pestanas?: (ctx: ContextoPestanas) => Pestana[];
  /** Abrir en vez de editar (p. ej. ver un documento emitido). */
  onAbrir?: (fila: Fila) => void;
  /** Controles extra en la barra de la tabla. */
  acciones?: ReactNode;
  /** Forzar recarga desde afuera. */
  version?: number;
};

type Edicion = { modo: "nuevo" } | { modo: "editar"; fila: Fila; recienCreado?: boolean };

/**
 * Mantenimiento completo de una tabla: TablaMaestra + ventana hija con el
 * Formulario para crear, editar y eliminar. Uso:
 *
 *   <MantenimientoRecurso recurso="marcas" puedeEditar={esAdmin} />
 */
export function MantenimientoRecurso({ recurso, puedeEditar, pestanas, onAbrir, acciones, version: versionExterna = 0 }: Props) {
  const def = obtenerRecurso(recurso);
  const ventanaMadre = useVentanaActual() ?? undefined;
  const [edicion, setEdicion] = useState<Edicion | null>(null);
  const [pestana, setPestana] = useState("datos");
  const [version, setVersion] = useState(0);
  const [resaltar, setResaltar] = useState<string | number | null>(null);

  const puedeCrear = puedeEditar && def.acciones?.crear !== false;
  const puedeModificar = puedeEditar && def.acciones?.editar !== false;
  const puedeEliminar = puedeEditar && def.acciones?.eliminar !== false;

  const cerrar = () => setEdicion(null);
  const abrir = (e: Edicion) => {
    setEdicion(e);
    setPestana("datos");
  };

  function refrescar(id: string | number | null) {
    invalidarOpciones(def.id);
    setResaltar(id);
    setVersion((v) => v + 1);
  }

  const clave = edicion?.modo === "editar" ? (edicion.fila[def.clave] as string | number) : null;
  const titulo =
    edicion?.modo === "editar"
      ? [def.titulo ?? def.clave]
          .flat()
          .map((c) => String(edicion.fila[c] ?? ""))
          .filter(Boolean)
          .join(" · ")
      : textoNuevo(def);

  const extras =
    edicion?.modo === "editar" && pestanas
      ? pestanas({ clave: clave!, fila: edicion.fila, refrescar: () => refrescar(clave) })
      : [];
  const tamano = def.ventana ?? { w: 520, h: Math.min(180 + def.campos.length * 86, 720) };

  // Con pestañas extra, crear deja la ventana abierta en el registro nuevo
  // para seguir con fotos, compatibilidad, etc.
  async function trasCrear(id: string | number) {
    if (!pestanas) return cerrar();
    const fila = await accionLeer(def.id, id).catch(() => null);
    if (fila) setEdicion({ modo: "editar", fila, recienCreado: true });
    else cerrar();
  }

  return (
    <div className={styles.mantenimiento}>
      <TablaMaestra
        recurso={recurso}
        puedeEditar={puedeModificar}
        onNuevo={puedeCrear ? () => abrir({ modo: "nuevo" }) : undefined}
        onEditar={(fila) => abrir({ modo: "editar", fila })}
        onAbrir={onAbrir}
        version={version + versionExterna}
        resaltar={resaltar}
        acciones={acciones}
      />

      {edicion && (
        <VentanaFlotante
          id={`form:${def.id}`}
          titulo={edicion.modo === "editar" ? `Editar ${def.nombre}` : textoNuevo(def)}
          padre={ventanaMadre}
          tamano={tamano}
          onCerrar={cerrar}
          foco={clave ?? "nuevo"}
        >
          <div className={styles.hoja} key={clave ?? "nuevo"} data-con-pestanas={extras.length ? "" : undefined}>
            <header className={styles.hojaEncabezado}>
              <p className={ui.etiquetaSeccion}>
                {edicion.modo === "editar" ? `Editar ${def.nombre}` : def.nombrePlural}
              </p>
              <h2 className={styles.hojaTitulo}>{titulo}</h2>
            </header>

            {extras.length > 0 && (
              <div className={styles.pestanas} role="tablist" aria-label="Secciones">
                {[{ id: "datos", titulo: "Datos", contador: undefined }, ...extras].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    role="tab"
                    className={styles.pestana}
                    aria-selected={pestana === p.id}
                    onClick={() => setPestana(p.id)}
                  >
                    {p.titulo}
                    {p.contador !== undefined && <span className={styles.pestanaContador}>{p.contador}</span>}
                  </button>
                ))}
              </div>
            )}

            {edicion.modo === "editar" && edicion.recienCreado && pestana === "datos" && extras.length > 0 && (
              <p className={styles.sugerencia} role="status">
                Guardado. Seguí con {extras.map((p) => p.titulo.toLowerCase()).join(" y ")} en las pestañas de arriba.
              </p>
            )}

            {extras.map(
              (p) =>
                pestana === p.id && (
                  <div key={p.id} role="tabpanel" className={styles.panelPestana}>
                    {p.contenido}
                  </div>
                ),
            )}

            <div role="tabpanel" hidden={pestana !== "datos"}>
              <Formulario
                campos={def.campos}
                edicion={edicion.modo === "editar"}
                valoresIniciales={edicion.modo === "editar" ? edicion.fila : undefined}
                onCancelar={cerrar}
                onGuardar={async (valores) => {
                  const r = await accionGuardar(def.id, clave, valores);
                  if (r.ok) {
                    refrescar(r.id);
                    if (clave === null) await trasCrear(r.id);
                    else if (pestanas) {
                      const fila = await accionLeer(def.id, r.id).catch(() => null);
                      if (fila) setEdicion({ modo: "editar", fila });
                    } else cerrar();
                  }
                  return r;
                }}
                onGuardarYSeguir={
                  edicion.modo === "nuevo"
                    ? async (valores) => {
                        const r = await accionGuardar(def.id, null, valores);
                        if (r.ok) refrescar(r.id);
                        return r;
                      }
                    : undefined
                }
                onEliminar={
                  clave !== null && puedeEliminar
                    ? async () => {
                        const r = await accionEliminar(def.id, clave);
                        if (r.ok) {
                          refrescar(null);
                          cerrar();
                        }
                        return r;
                      }
                    : undefined
                }
              />
            </div>
          </div>
        </VentanaFlotante>
      )}
    </div>
  );
}
