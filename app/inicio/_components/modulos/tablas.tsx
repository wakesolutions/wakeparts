"use client";

import { useState, type ReactNode } from "react";
import { MantenimientoRecurso } from "@/components/mantenimiento/mantenimiento-recurso";
import { obtenerRecurso } from "@/lib/recursos";
import { puedeEscribir, useSesion } from "../sesion-contexto";
import styles from "./modulos.module.css";

export type SeccionTablas = {
  titulo: string;
  nota?: string;
  items: readonly ItemTablas[];
};

/**
 * Un ítem es una tabla (`recurso` de lib/recursos) o una vista propia (`id` +
 * `titulo` + `contenido`), p. ej. un tablero de reportes.
 */
export type ItemTablas = {
  recurso?: string;
  id?: string;
  titulo?: string;
  descripcion: string;
  /** Contenido propio en vez del mantenimiento genérico (p. ej. con pestañas extra). */
  contenido?: (ctx: { editable: boolean }) => ReactNode;
  /** Solo para algunos roles. */
  visible?: (sesion: ReturnType<typeof useSesion>) => boolean;
};

const claveDe = (i: ItemTablas) => i.recurso ?? i.id!;
const tituloDe = (i: ItemTablas) => (i.recurso ? obtenerRecurso(i.recurso).nombrePlural : i.titulo ?? i.id!);

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
  const visibles = secciones
    .map((s) => ({ ...s, items: s.items.filter((i) => !i.visible || i.visible(sesion)) }))
    .filter((s) => s.items.length);
  const todos = visibles.flatMap((s) => s.items);
  const clave = `wp:${id}:seccion`;
  const [actual, setActual] = useState<string>(() => {
    try {
      const guardado = localStorage.getItem(clave);
      if (todos.some((i) => claveDe(i) === guardado)) return guardado!;
    } catch {
      // sin almacenamiento
    }
    return inicial;
  });
  const item = todos.find((i) => claveDe(i) === actual) ?? todos[0];
  const def = item.recurso ? obtenerRecurso(item.recurso) : null;
  const editable = def ? puedeEscribir(sesion, def.escritura) : false;

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
        {visibles.map((s) => (
          <div key={s.titulo} className={styles.seccion}>
            <p className={styles.seccionTitulo}>{s.titulo}</p>
            <ul>
              {s.items.map((i, n) => (
                <li key={claveDe(i)}>
                  <button
                    type="button"
                    className={styles.item}
                    aria-current={claveDe(item) === claveDe(i) ? "page" : undefined}
                    onClick={() => elegir(claveDe(i))}
                  >
                    <span className={styles.itemNumero}>{String(n + 1).padStart(2, "0")}</span>
                    {tituloDe(i)}
                  </button>
                </li>
              ))}
            </ul>
            {s.nota && <p className={styles.seccionNota}>{s.nota}</p>}
          </div>
        ))}
      </nav>

      <div className={styles.principal}>
        <header className={styles.cabecera} key={claveDe(item)}>
          <div>
            <h3 className={styles.cabeceraTitulo}>{tituloDe(item)}</h3>
            <p className={styles.cabeceraDescripcion}>{item.descripcion}</p>
          </div>
          {def && !editable && <span className={styles.soloLectura}>Solo lectura</span>}
        </header>
        <div className={styles.cuerpo}>
          {item.contenido ? (
            <div key={claveDe(item)} className={styles.cuerpoPropio}>
              {item.contenido({ editable })}
            </div>
          ) : (
            <MantenimientoRecurso
              key={claveDe(item)}
              recurso={item.recurso!}
              puedeEditar={editable}
              editaGlobales={sesion.usuario.esAdminPlataforma}
            />
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
              recurso: "categorias_globales",
              descripcion:
                "Árbol general de categorías (hasta 3 niveles) para todas las empresas. Los sinónimos alimentan la búsqueda del mostrador.",
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
