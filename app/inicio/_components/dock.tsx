"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useApi } from "@/components/datos/apis";
import { useNotificaciones } from "@/components/notificaciones/contexto";
import notif from "@/components/notificaciones/notificaciones.module.css";
import ui from "@/components/ui/controles.module.css";
import { useVentanas, type DefModulo } from "@/components/ventanas/contexto";
import {
  DOCK_VACIO,
  FIJOS_DOCK,
  normalizarDock,
  tonoDeFabrica,
  TONOS_ICONO,
  type PreferenciasDock,
  type TonoIcono,
} from "@/lib/dock";
import { useSesion } from "./sesion-contexto";
import styles from "./escritorio.module.css";

/** Lo que tarda un ícono en «caer» a la guantera antes de salir del dock. */
const CAIDA_MS = 260;

export function Dock() {
  const { modulos, ventanas, enfocada, abrir, restaurar, enfocar, minimizarTodas } = useVentanas();
  const { bandeja } = useNotificaciones();
  const [prefs, cambiarPrefs] = usePreferenciasDock();
  const [guantera, setGuantera] = useState<"ocultos" | "personalizar" | null>(null);
  // Menú del clic derecho: el módulo y dónde queda su ícono dentro del marco del dock.
  const [menu, setMenu] = useState<{ id: string; x: number } | null>(null);
  const marco = useRef<HTMLDivElement>(null);
  // Íconos que se están yendo a la guantera (animación de caída).
  const [cayendo, setCayendo] = useState<string[]>([]);
  const botonGuantera = useRef<HTMLButtonElement>(null);

  const delDock = modulos.filter((m) => m.enDock !== false);
  const abierta = (id: string) => ventanas.some((v) => v.id === id && v.estado !== "minimizada");
  const oculto = (id: string) => prefs.ocultos.includes(id);
  // Un módulo oculto con su ventana abierta se asoma en el dock mientras se usa, como en macOS.
  const fijos = delDock.filter((m) => !oculto(m.id) || abierta(m.id));
  const guardados = delDock.filter((m) => oculto(m.id));
  const tonoDe = (id: string): TonoIcono => prefs.tonos[id] ?? tonoDeFabrica(id);

  function activar(id: string) {
    const modulo = modulos.find((m) => m.id === id);
    if (!modulo?.componente) return minimizarTodas(); // Inicio: mostrar el escritorio
    const v = ventanas.find((x) => x.id === id);
    if (!v) abrir(id);
    else if (v.estado === "minimizada") restaurar(id);
    else enfocar(id);
  }

  function ocultar(id: string, ocultarlo: boolean) {
    if (FIJOS_DOCK.includes(id)) return;
    const quitar = () =>
      cambiarPrefs((p) => ({
        ...p,
        ocultos: ocultarlo ? [...p.ocultos.filter((x) => x !== id), id] : p.ocultos.filter((x) => x !== id),
      }));
    const visible = fijos.some((m) => m.id === id) && !abierta(id);
    if (!ocultarlo || !visible || reducirMovimiento()) return quitar();
    setCayendo((c) => [...c, id]);
    setTimeout(() => {
      quitar();
      setCayendo((c) => c.filter((x) => x !== id));
    }, CAIDA_MS);
  }

  function pintar(id: string, tono: TonoIcono) {
    cambiarPrefs((p) => {
      const tonos = { ...p.tonos };
      if (tono === tonoDeFabrica(id)) delete tonos[id];
      else tonos[id] = tono;
      return { ...p, tonos };
    });
  }

  const cerrarGuantera = useCallback(() => {
    setGuantera(null);
    botonGuantera.current?.focus();
  }, []);

  // Minimizadas sin ícono fijo (ventanas hijas y módulos fuera del dock), como en macOS.
  const mosaicos = ventanas.filter(
    (v) => v.estado === "minimizada" && !v.conPadre && (v.titulo || !fijos.some((m) => m.id === v.id)),
  );
  const moduloDe = (id: string) => {
    const v = ventanas.find((x) => x.id === id);
    return modulos.find((m) => m.id === (v?.padre ?? id)) ?? modulos.find((m) => m.id === id);
  };
  const moduloMenu = menu ? delDock.find((m) => m.id === menu.id) : undefined;
  const nombreDe = (id: string) =>
    ventanas.find((x) => x.id === id)?.titulo ?? modulos.find((m) => m.id === id)?.nombre ?? id;

  return (
    <nav className={styles.dockZona} aria-label="Módulos">
      <div ref={marco} className={styles.dockMarco}>
        {guantera && (
          <Guantera
            modo={guantera}
            modulos={delDock}
            guardados={guardados}
            prefs={prefs}
            tonoDe={tonoDe}
            onModo={setGuantera}
            onAbrir={(id) => {
              setGuantera(null);
              activar(id);
            }}
            onOcultar={ocultar}
            onPintar={pintar}
            onRestablecer={() => cambiarPrefs(() => ({ ...DOCK_VACIO, tonos: {} }))}
            onCerrar={cerrarGuantera}
            boton={botonGuantera}
          />
        )}

        {menu && moduloMenu && (
          <MenuIcono
            modulo={moduloMenu}
            x={menu.x}
            tono={tonoDe(menu.id)}
            onPintar={(t) => pintar(menu.id, t)}
            onOcultar={() => {
              setMenu(null);
              ocultar(menu.id, true);
            }}
            onPersonalizar={() => {
              setMenu(null);
              setGuantera("personalizar");
            }}
            onCerrar={() => setMenu(null)}
          />
        )}

        <ul className={styles.dock} onScroll={() => setMenu(null)}>
          {fijos.map((m, i) => {
            const v = ventanas.find((x) => x.id === m.id);
            const esInicio = !m.componente;
            const activo = esInicio ? enfocada === null : Boolean(v);
            const tareas = bandeja.porModulo[m.id] ?? 0;
            return (
              <li
                key={m.id}
                className={styles.dockItem}
                data-cayendo={cayendo.includes(m.id) || undefined}
                data-visitante={oculto(m.id) || undefined}
              >
                {i === 1 && <span className={styles.separador} aria-hidden="true" />}
                <button
                  type="button"
                  className={styles.app}
                  data-dock={m.id}
                  data-tono={tonoDe(m.id)}
                  aria-current={enfocada === m.id || (esInicio && enfocada === null) ? "page" : undefined}
                  aria-haspopup="menu"
                  onClick={() => activar(m.id)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    const r = e.currentTarget.getBoundingClientRect();
                    const base = marco.current?.getBoundingClientRect().left ?? 0;
                    setGuantera(null);
                    setMenu({ id: m.id, x: r.left + r.width / 2 - base });
                  }}
                  aria-label={tareas ? `${m.nombre}: ${tareas} por atender` : m.nombre}
                >
                  <span className={styles.icono}>{m.icono}</span>
                  {tareas > 0 && (
                    <span key={tareas} className={notif.insigniaDock} aria-hidden="true">
                      {tareas > 99 ? "99+" : tareas}
                    </span>
                  )}
                  {menu?.id !== m.id && (
                    <span className={styles.tooltip}>{tareas ? `${m.nombre} · ${tareas} por atender` : m.nombre}</span>
                  )}
                </button>
                <span className={styles.indicador} data-activo={activo || undefined} aria-hidden="true" />
              </li>
            );
          })}

          {mosaicos.map((v, i) => {
            const modulo = moduloDe(v.id);
            return (
              <li key={v.id} className={`${styles.dockItem} ${styles.mosaicoItem}`}>
                {i === 0 && <span className={styles.separador} aria-hidden="true" />}
                <button
                  type="button"
                  className={`${styles.app} ${styles.mosaico}`}
                  data-dock={v.id}
                  onClick={() => restaurar(v.id)}
                  aria-label={`Restaurar ${nombreDe(v.id)}`}
                >
                  <span className={styles.icono}>{modulo?.icono}</span>
                  <span className={styles.mosaicoTexto} aria-hidden="true">
                    {nombreDe(v.id)}
                  </span>
                  <span className={styles.tooltip}>{nombreDe(v.id)}</span>
                </button>
                <span className={styles.indicador} aria-hidden="true" />
              </li>
            );
          })}

          <li className={`${styles.dockItem} ${styles.guanteraItem}`}>
            <span className={styles.separador} aria-hidden="true" />
            <button
              ref={botonGuantera}
              type="button"
              className={`${styles.app} ${styles.guanteraBoton}`}
              data-dock="guantera"
              aria-expanded={guantera !== null}
              aria-haspopup="dialog"
              aria-label={
                guardados.length ? `Guantera: ${guardados.length} módulos ocultos` : "Guantera: personalizar el dock"
              }
              onClick={() => {
                setMenu(null);
                setGuantera((g) => (g ? null : "ocultos"));
              }}
            >
              <span className={styles.icono}>
                <IconoGuantera abierta={guantera !== null} />
              </span>
              {guardados.length > 0 && (
                <span key={guardados.length} className={styles.guanteraCuenta} aria-hidden="true">
                  {guardados.length}
                </span>
              )}
              {guantera === null && (
                <span className={styles.tooltip}>
                  {guardados.length ? `Guantera · ${guardados.length} ocultos` : "Personalizar el dock"}
                </span>
              )}
            </button>
            <span className={styles.indicador} aria-hidden="true" />
          </li>
        </ul>
      </div>
    </nav>
  );
}

// ------------------------------------------------------------ preferencias --

/**
 * Preferencias del dock del usuario: las de la base (sesión) o, sin la
 * migración 0020 o en la demo, la copia del navegador. Cada cambio se guarda
 * en el navegador al instante y en la base un momento después.
 */
function usePreferenciasDock() {
  const sesion = useSesion();
  const api = useApi("perfil");
  const clave = `wp:dock:${sesion.usuario.id}`;
  const deLaBase = sesion.usuario.dock;
  const [prefs, setPrefs] = useState<PreferenciasDock>(() => deLaBase ?? { ...DOCK_VACIO, tonos: {} });
  const pendiente = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sin dato de la base: la copia del navegador (después de montar, para no romper la hidratación).
  useEffect(() => {
    if (deLaBase) return;
    try {
      const guardado = localStorage.getItem(clave);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura única del navegador al montar
      if (guardado) setPrefs(normalizarDock(JSON.parse(guardado)));
    } catch {
      // sin almacenamiento
    }
  }, [clave, deLaBase]);

  const cambiar = useCallback(
    (f: (p: PreferenciasDock) => PreferenciasDock) => {
      setPrefs((anterior) => {
        const nuevo = normalizarDock(f(anterior));
        try {
          localStorage.setItem(clave, JSON.stringify(nuevo));
        } catch {
          // sin almacenamiento
        }
        if (pendiente.current) clearTimeout(pendiente.current);
        pendiente.current = setTimeout(() => void api.guardarDock(nuevo).catch(() => {}), 500);
        return nuevo;
      });
    },
    [api, clave],
  );

  return [prefs, cambiar] as const;
}

const reducirMovimiento = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Cierra al tocar fuera o con Escape. */
function useCerrarFuera(ref: React.RefObject<HTMLElement | null>, onCerrar: () => void, ignorar?: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const fuera = (e: PointerEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || ignorar?.current?.contains(t)) return;
      onCerrar();
    };
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("pointerdown", fuera);
      document.removeEventListener("keydown", tecla);
    };
  }, [ref, onCerrar, ignorar]);
}

// ---------------------------------------------------------------- guantera --

/**
 * La guantera: popover sobre el dock con los módulos guardados (se abren de
 * un toque) y el modo Personalizar (qué va en el dock y de qué color).
 */
function Guantera({
  modo,
  modulos,
  guardados,
  prefs,
  tonoDe,
  onModo,
  onAbrir,
  onOcultar,
  onPintar,
  onRestablecer,
  onCerrar,
  boton,
}: {
  modo: "ocultos" | "personalizar";
  modulos: DefModulo[];
  guardados: DefModulo[];
  prefs: PreferenciasDock;
  tonoDe: (id: string) => TonoIcono;
  onModo: (m: "ocultos" | "personalizar") => void;
  onAbrir: (id: string) => void;
  onOcultar: (id: string, ocultar: boolean) => void;
  onPintar: (id: string, tono: TonoIcono) => void;
  onRestablecer: () => void;
  onCerrar: () => void;
  boton: React.RefObject<HTMLButtonElement | null>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useCerrarFuera(ref, onCerrar, boton);

  // Al abrir o cambiar de modo, el foco entra a la guantera.
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("[data-primero]")?.focus();
  }, [modo]);

  const personalizado = prefs.ocultos.length > 0 || Object.keys(prefs.tonos).length > 0;

  return (
    <div ref={ref} className={styles.guantera} role="dialog" aria-label="Guantera del dock" data-modo={modo}>
      <header className={styles.guanteraCabeza}>
        <div>
          <span className={styles.guanteraEtiqueta}>Guantera</span>
          <h2 className={styles.guanteraTitulo}>{modo === "ocultos" ? "Módulos guardados" : "Personalizar el dock"}</h2>
        </div>
        <span className={styles.guanteraContador} aria-hidden="true">
          {String(guardados.length).padStart(2, "0")}
        </span>
      </header>

      {modo === "ocultos" ? (
        guardados.length ? (
          <ul className={styles.guanteraRejilla}>
            {guardados.map((m, i) => (
              <li key={m.id} style={{ animationDelay: `${40 + i * 30}ms` }}>
                <button
                  type="button"
                  className={styles.guanteraModulo}
                  data-primero={i === 0 || undefined}
                  onClick={() => onAbrir(m.id)}
                >
                  <Pastilla tono={tonoDe(m.id)}>{m.icono}</Pastilla>
                  <span>{m.nombre}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.guanteraVacia}>
            Todo está en el dock. Guardá aquí los módulos que no usás a diario: tocá <strong>Personalizar</strong> o hacé
            clic derecho sobre un ícono.
          </p>
        )
      ) : (
        <ul className={styles.guanteraLista}>
          {modulos.map((m, i) => {
            const fijo = FIJOS_DOCK.includes(m.id);
            const enDock = !prefs.ocultos.includes(m.id);
            return (
              <li key={m.id} className={styles.guanteraFila} style={{ animationDelay: `${i * 22}ms` }}>
                <Pastilla tono={tonoDe(m.id)}>{m.icono}</Pastilla>
                <span className={styles.guanteraNombre}>{m.nombre}</span>
                <Esmaltes
                  nombre={m.nombre}
                  tono={tonoDe(m.id)}
                  onPintar={(t) => onPintar(m.id, t)}
                  primero={i === 0}
                />
                <button
                  type="button"
                  role="switch"
                  aria-checked={enDock}
                  aria-label={`${m.nombre} en el dock`}
                  className={styles.interruptor}
                  disabled={fijo}
                  title={fijo ? "Siempre en el dock" : undefined}
                  onClick={() => onOcultar(m.id, enDock)}
                >
                  <span className={styles.interruptorPalanca} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <footer className={styles.guanteraPie}>
        {modo === "ocultos" ? (
          <button
            type="button"
            className={`${ui.boton} ${ui.fantasma}`}
            data-primero={guardados.length === 0 || undefined}
            onClick={() => onModo("personalizar")}
          >
            Personalizar
          </button>
        ) : (
          <>
            <button type="button" className={`${ui.boton} ${ui.fantasma}`} disabled={!personalizado} onClick={onRestablecer}>
              Restablecer
            </button>
            <button type="button" className={`${ui.boton} ${ui.primario}`} onClick={() => onModo("ocultos")}>
              Listo
            </button>
          </>
        )}
      </footer>
    </div>
  );
}

/** Menú del clic derecho sobre un ícono: esmalte, quitar del dock o personalizar todo. */
function MenuIcono({
  modulo,
  x,
  tono,
  onPintar,
  onOcultar,
  onPersonalizar,
  onCerrar,
}: {
  modulo: DefModulo;
  /** Centro del ícono, en px desde el borde izquierdo del marco del dock. */
  x: number;
  tono: TonoIcono;
  onPintar: (t: TonoIcono) => void;
  onOcultar: () => void;
  onPersonalizar: () => void;
  onCerrar: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useCerrarFuera(ref, onCerrar);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("[data-primero]")?.focus();
  }, []);
  const fijo = FIJOS_DOCK.includes(modulo.id);
  return (
    <div
      ref={ref}
      className={styles.menuIcono}
      role="menu"
      aria-label={`Opciones de ${modulo.nombre}`}
      style={{ "--x": `${x}px` } as React.CSSProperties}
    >
      <span className={styles.guanteraEtiqueta}>{modulo.nombre}</span>
      <Esmaltes nombre={modulo.nombre} tono={tono} onPintar={onPintar} primero />
      <div className={styles.menuAcciones}>
        {!fijo && (
          <button type="button" role="menuitem" onClick={onOcultar}>
            Guardar en la guantera
          </button>
        )}
        <button type="button" role="menuitem" onClick={onPersonalizar}>
          Personalizar el dock…
        </button>
      </div>
    </div>
  );
}

/** Seis esmaltes de tablero para un ícono. */
function Esmaltes({
  nombre,
  tono,
  onPintar,
  primero,
}: {
  nombre: string;
  tono: TonoIcono;
  onPintar: (t: TonoIcono) => void;
  primero?: boolean;
}) {
  return (
    <div className={styles.esmaltes} role="radiogroup" aria-label={`Color de ${nombre}`}>
      {TONOS_ICONO.map((t) => (
        <button
          key={t.valor}
          type="button"
          role="radio"
          aria-checked={tono === t.valor}
          aria-label={t.etiqueta}
          title={t.etiqueta}
          data-tono={t.valor}
          data-primero={(primero && tono === t.valor) || undefined}
          className={styles.esmalte}
          onClick={() => onPintar(t.valor)}
        />
      ))}
    </div>
  );
}

/** Ícono de módulo en miniatura con su esmalte. */
function Pastilla({ tono, children }: { tono: TonoIcono; children: ReactNode }) {
  return (
    <span className={styles.pastilla} data-tono={tono} aria-hidden="true">
      <span className={styles.icono}>{children}</span>
    </span>
  );
}

/** Guantera de tablero: tapa con cerradura; al abrirse, la tapa baja. */
function IconoGuantera({ abierta }: { abierta: boolean }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" data-abierta={abierta || undefined}>
      <rect x="7" y="12" width="34" height="26" rx="5" fill="currentColor" opacity="0.35" />
      <g className={styles.guanteraTapa}>
        <rect x="7" y="12" width="34" height="20" rx="5" fill="currentColor" />
        <rect x="19" y="24" width="10" height="4" rx="2" fill="var(--wp-accent)" />
      </g>
      <path d="M13 34h22" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}
