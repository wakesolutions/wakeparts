"use client";

import { useState, type ReactNode } from "react";
import { MantenimientoRecurso } from "@/components/mantenimiento/mantenimiento-recurso";
import { obtenerRecurso } from "@/lib/recursos";
import { puedeEscribir, useSesion } from "../sesion-contexto";
import styles from "./modulos.module.css";

export type SeccionTablas = {
  titulo: string;
  nota?: string;
  items: readonly {
    recurso: string;
    descripcion: string;
    /** Contenido propio en vez del mantenimiento genérico (p. ej. con pestañas extra). */
    contenido?: (ctx: { editable: boolean }) => ReactNode;
  }[];
};

/**
 * Módulo genérico «barra lateral de tablas + mantenimiento»: cada ítem abre el
 * MantenimientoRecurso de un recurso. Recuerda la última tabla elegida.
 */
export function ModuloTablas({
  id,
  secciones,
  inicial,
}: {
  /** Clave para recordar la sección elegida. */
  id: string;
  secciones: readonly SeccionTablas[];
  inicial: string;
}) {
  const sesion = useSesion();
  const todos = secciones.flatMap((s) => s.items);
  const clave = `wp:${id}:seccion`;
  const [actual, setActual] = useState<string>(() => {
    try {
      const guardado = localStorage.getItem(clave);
      if (todos.some((i) => i.recurso === guardado)) return guardado!;
    } catch {
      // sin almacenamiento
    }
    return inicial;
  });
  const def = obtenerRecurso(actual);
  const item = todos.find((i) => i.recurso === actual)!;
  const editable = puedeEscribir(sesion, def.escritura);

  function elegir(recurso: string) {
    setActual(recurso);
    try {
      localStorage.setItem(clave, recurso);
    } catch {
      // sin almacenamiento
    }
  }

  return (
    <div className={styles.modulo}>
      <nav className={styles.lateral} aria-label="Tablas">
        {secciones.map((s) => (
          <div key={s.titulo} className={styles.seccion}>
            <p className={styles.seccionTitulo}>{s.titulo}</p>
            <ul>
              {s.items.map((i, n) => (
                <li key={i.recurso}>
                  <button
                    type="button"
                    className={styles.item}
                    aria-current={actual === i.recurso ? "page" : undefined}
                    onClick={() => elegir(i.recurso)}
                  >
                    <span className={styles.itemNumero}>{String(n + 1).padStart(2, "0")}</span>
                    {obtenerRecurso(i.recurso).nombrePlural}
                  </button>
                </li>
              ))}
            </ul>
            {s.nota && <p className={styles.seccionNota}>{s.nota}</p>}
          </div>
        ))}
      </nav>

      <div className={styles.principal}>
        <header className={styles.cabecera} key={actual}>
          <div>
            <h3 className={styles.cabeceraTitulo}>{def.nombrePlural}</h3>
            <p className={styles.cabeceraDescripcion}>{item.descripcion}</p>
          </div>
          {!editable && <span className={styles.soloLectura}>Solo lectura</span>}
        </header>
        <div className={styles.cuerpo}>
          {item.contenido ? (
            <div key={actual} className={styles.cuerpoPropio}>
              {item.contenido({ editable })}
            </div>
          ) : (
            <MantenimientoRecurso key={actual} recurso={actual} puedeEditar={editable} />
          )}
        </div>
      </div>
    </div>
  );
}

export function ModuloMantenimiento() {
  return (
    <ModuloTablas
      id="mantenimiento"
      inicial="especificaciones"
      secciones={[
        {
          titulo: "Catálogo de productos",
          nota: "Global · las marcas de repuestos propias se agregan en Inventario",
          items: [
            {
              recurso: "categorias",
              descripcion: "Árbol de categorías (hasta 3 niveles). Los sinónimos alimentan la búsqueda del mostrador.",
            },
            {
              recurso: "categorias_relacionadas",
              descripcion: "Si el cliente busca una categoría, el mostrador le recomienda productos de la otra (y al revés).",
            },
          ],
        },
        {
          titulo: "Catálogo de vehículos",
          nota: "Global · compartido por todas las empresas",
          items: [
            { recurso: "marcas", descripcion: "Fabricantes de vehículos." },
            { recurso: "modelos", descripcion: "Modelos de cada marca." },
            { recurso: "modelos_anios", descripcion: "Años en que existió cada modelo." },
            { recurso: "tipos_carrocerias", descripcion: "Tipos de carrocería." },
            {
              recurso: "especificaciones",
              descripcion:
                "Variante concreta de cada año: carrocería y motor. Aquí se enganchará la compatibilidad de piezas.",
            },
          ],
        },
      ]}
    />
  );
}

export function ModuloUsuarios() {
  return (
    <ModuloTablas
      id="usuarios"
      inicial="miembros"
      secciones={[
        {
          titulo: "Equipo",
          nota: "Las personas entran con su cuenta de Google. Invitalas por correo.",
          items: [
            {
              recurso: "miembros",
              descripcion: "Quiénes tienen acceso a la empresa y con qué rol. Desactivá en vez de borrar.",
            },
            {
              recurso: "invitaciones",
              descripcion:
                "Invitaciones pendientes. Cuando la persona entre con ese correo de Google, queda dentro de la empresa.",
            },
          ],
        },
      ]}
    />
  );
}
