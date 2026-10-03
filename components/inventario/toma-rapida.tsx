"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useApi } from "@/components/datos/apis";
import { CampoRelacion } from "@/components/formulario/campo-relacion";
import { procesarFoto } from "@/components/imagenes/procesar";
import ui from "@/components/ui/controles.module.css";
import { IconoCamara, IconoCheck, IconoImagen, IconoMas, IconoMenos, IconoRecargar } from "@/components/ui/iconos";
import { cant, moneda } from "@/lib/formato";
import { reportarError } from "@/lib/registro-cliente";
import { CONDICIONES, productos } from "@/lib/recursos/inventario";
import type { FuenteOpciones, Valores } from "@/lib/recursos/tipos";
import styles from "./toma-rapida.module.css";

/**
 * Toma rápida: alta de productos desde el teléfono, uno tras otro.
 * Foto + lo mínimo (nombre, categoría, precio, existencia, condición). Guarda
 * con la misma definición que Inventario › Productos (`guardar("productos")`),
 * así que valida igual y completa lo demás con sus valores por defecto. La foto
 * se comprime y sube en segundo plano mientras se toma la siguiente.
 */

const CATEGORIA = productos.campos.find((c) => c.nombre === "id_categoria")!.relacion as FuenteOpciones;

/** Valores por defecto de la definición (activo, visible en catálogo, unidad…). */
const BASE: Valores = Object.fromEntries(
  productos.campos.filter((c) => c.porDefecto !== undefined).map((c) => [c.nombre, c.porDefecto]),
);

type EstadoFoto = "subiendo" | "lista" | "error" | "sin";

type Tomado = {
  clave: number;
  id: number;
  nombre: string;
  precio: number;
  existencia: number;
  condicion: string;
  vista: string | null;
  archivo: File | null;
  foto: EstadoFoto;
};

const num = (s: string) => {
  const n = Number(String(s).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : NaN;
};

export function TomaRapida() {
  const recursos = useApi("recursos");
  const imagenes = useApi("imagenes");

  const [foto, setFoto] = useState<{ archivo: File; vista: string } | null>(null);
  const [nombre, setNombre] = useState("");
  const [categoria, setCategoria] = useState<string | number | null>(null);
  const [precio, setPrecio] = useState("");
  const [existencia, setExistencia] = useState(1);
  const [condicion, setCondicion] = useState(String(BASE.condicion ?? "nuevo"));
  const [ubicacion, setUbicacion] = useState("");
  const [oem, setOem] = useState("");
  const [masDatos, setMasDatos] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [tomados, setTomados] = useState<Tomado[]>([]);

  const camara = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);
  const raiz = useRef<HTMLFormElement>(null);
  const siguiente = useRef(1);
  // Vistas previas creadas: se liberan al cerrar el módulo.
  const urls = useRef(new Set<string>());

  useEffect(() => {
    const creadas = urls.current;
    return () => creadas.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  function elegirFoto(archivo: File | undefined) {
    if (!archivo) return;
    const vista = URL.createObjectURL(archivo);
    urls.current.add(vista);
    setFoto({ archivo, vista });
  }

  /** Al corregir un campo se apaga su error. */
  function limpiar(campo: string) {
    setErrores((e) => {
      if (!(campo in e)) return e;
      const resto = { ...e };
      delete resto[campo];
      return resto;
    });
  }

  function cambiarTomado(clave: number, cambio: Partial<Tomado>) {
    setTomados((ts) => ts.map((t) => (t.clave === clave ? { ...t, ...cambio } : t)));
  }

  async function subirFoto(clave: number, id: number, archivo: File) {
    cambiarTomado(clave, { foto: "subiendo" });
    try {
      const p = await procesarFoto(archivo);
      const datos = new FormData();
      datos.set("producto", String(id));
      datos.set("archivo", p.grande);
      datos.set("miniatura", p.miniatura);
      datos.set("ancho", String(p.ancho));
      datos.set("alto", String(p.alto));
      const r = await imagenes.subir(datos);
      cambiarTomado(clave, r.ok ? { foto: "lista", archivo: null } : { foto: "error" });
    } catch (e) {
      reportarError(e, { contexto: "toma-rapida:foto" });
      cambiarTomado(clave, { foto: "error" });
    }
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (guardando) return;
    const valorPrecio = precio.trim() ? num(precio) : 0;
    const locales: Record<string, string> = {};
    if (!nombre.trim()) locales.nombre = "Escribí qué pieza es.";
    if (categoria === null || categoria === "") locales.id_categoria = "Elegí una categoría.";
    if (!Number.isFinite(valorPrecio) || valorPrecio < 0) locales.precio = "Revisá el precio.";
    setErrores(locales);
    setAviso(null);
    if (Object.keys(locales).length) return;

    setGuardando(true);
    const r = await recursos
      .guardar("productos", null, {
        ...BASE,
        nombre: nombre.trim(),
        id_categoria: categoria,
        precio: valorPrecio,
        existencia,
        condicion,
        ubicacion: ubicacion.trim() || null,
        oem: oem.trim() || null,
      })
      .catch((err) => {
        reportarError(err, { contexto: "toma-rapida:guardar" });
        return { ok: false as const, error: "No se pudo guardar. Revisá tu conexión e intentá de nuevo." };
      });
    setGuardando(false);

    if (!r.ok) {
      const delServidor = "errores" in r && r.errores ? r.errores : {};
      // Errores de campos que esta pantalla no muestra: se dicen en el aviso.
      const otros = Object.entries(delServidor)
        .filter(([campo]) => !["nombre", "id_categoria", "precio"].includes(campo))
        .map(([campo, texto]) => `${productos.campos.find((c) => c.nombre === campo)?.etiqueta ?? campo}: ${texto}`);
      setErrores(delServidor);
      setAviso([r.error, ...otros].join(" "));
      return;
    }

    const clave = siguiente.current++;
    const id = Number(r.id);
    setTomados((ts) => [
      {
        clave,
        id,
        nombre: nombre.trim(),
        precio: valorPrecio,
        existencia,
        condicion,
        vista: foto?.vista ?? null,
        archivo: foto?.archivo ?? null,
        foto: foto ? "subiendo" : "sin",
      },
      ...ts,
    ]);
    if (foto) void subirFoto(clave, id, foto.archivo);

    // Siguiente pieza: se limpia lo propio de cada una; categoría, condición y
    // ubicación se quedan (se suele tomar por estante o por tipo).
    setFoto(null);
    setNombre("");
    setPrecio("");
    setOem("");
    setExistencia(1);
    setErrores({});
    raiz.current?.closest("[data-desplazable]")?.scrollTo({ top: 0, behavior: "smooth" });
  }

  const conFoto = tomados.filter((t) => t.foto === "lista").length;

  return (
    <div className={styles.toma} data-desplazable>
      <form ref={raiz} className={styles.marco} onSubmit={guardar} noValidate>
        <header className={styles.cabeza}>
          <div>
            <p className={styles.sobretitulo}>Inventario · Toma rápida</p>
            <h2 className={styles.titulo}>Foto, nombre, precio. Siguiente.</h2>
          </div>
          <div className={styles.contador} role="status" aria-label={`${tomados.length} tomados en esta sesión`}>
            <span className={styles.lcd} aria-hidden="true">
              {String(tomados.length).padStart(3, "0")}
            </span>
            <span className={styles.lcdEtiqueta} aria-hidden="true">
              Tomados
            </span>
          </div>
        </header>

        {/* ---------------------------------------------------------- visor -- */}
        <div className={styles.columnaFoto}>
          <div className={styles.visor} data-con-foto={foto ? "" : undefined}>
            {foto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={foto.vista} src={foto.vista} alt="Foto de la pieza" className={styles.vista} />
            ) : (
              <button type="button" className={styles.disparador} onClick={() => camara.current?.click()}>
                <span className={styles.obturador} aria-hidden="true">
                  <IconoCamara tamano={26} />
                </span>
                <span className={styles.disparadorTexto}>Tocá para tomar la foto</span>
                <span className={styles.disparadorAyuda}>De frente, con buena luz, la pieza completa</span>
              </button>
            )}
            <span className={styles.esquinas} aria-hidden="true" />
          </div>
          <div className={styles.accionesFoto}>
            <button type="button" className={ui.boton} onClick={() => camara.current?.click()}>
              <IconoCamara tamano={14} /> {foto ? "Repetir" : "Cámara"}
            </button>
            <button type="button" className={ui.boton} onClick={() => galeria.current?.click()}>
              <IconoImagen tamano={14} /> Galería
            </button>
            {foto && (
              <button type="button" className={`${ui.boton} ${ui.fantasma}`} onClick={() => setFoto(null)}>
                Sin foto
              </button>
            )}
          </div>
          <input
            ref={camara}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => {
              elegirFoto(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <input
            ref={galeria}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              elegirFoto(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>

        {/* ---------------------------------------------------------- datos -- */}
        <div className={styles.columnaDatos}>
          <label className={styles.campo}>
            <span className={styles.etiqueta} data-requerido="">
              Qué pieza es
            </span>
            <input
              className={`${ui.campo} ${styles.nombre}`}
              value={nombre}
              onChange={(e) => {
                setNombre(e.target.value);
                limpiar("nombre");
              }}
              placeholder="Alternador Corolla 2005"
              maxLength={160}
              autoCapitalize="sentences"
              enterKeyHint="next"
              aria-invalid={errores.nombre ? true : undefined}
            />
            {errores.nombre && <span className={styles.error}>{errores.nombre}</span>}
          </label>

          <div className={styles.campo}>
            <span className={styles.etiqueta} data-requerido="" id="toma-categoria">
              Categoría
            </span>
            <CampoRelacion
              id="toma-categoria-campo"
              fuente={CATEGORIA}
              valor={categoria}
              invalido={Boolean(errores.id_categoria)}
              onCambiar={(v) => {
                setCategoria(v);
                limpiar("id_categoria");
              }}
            />
            {errores.id_categoria ? (
              <span className={styles.error}>{errores.id_categoria}</span>
            ) : (
              <span className={styles.ayuda}>Se queda para la siguiente pieza.</span>
            )}
          </div>

          <div className={styles.fila}>
            <label className={styles.campo}>
              <span className={styles.etiqueta}>Precio sin ISV</span>
              <span className={styles.conPrefijo}>
                <span className={styles.prefijo} aria-hidden="true">
                  L
                </span>
                <input
                  className={`${ui.campo} ${styles.cifra}`}
                  value={precio}
                  onChange={(e) => {
                    setPrecio(e.target.value);
                    limpiar("precio");
                  }}
                  placeholder="0.00"
                  inputMode="decimal"
                  enterKeyHint="done"
                  aria-invalid={errores.precio ? true : undefined}
                />
              </span>
              {errores.precio && <span className={styles.error}>{errores.precio}</span>}
            </label>

            <div className={styles.campo}>
              <span className={styles.etiqueta} id="toma-existencia">
                Existencia
              </span>
              <div className={styles.pasos} role="group" aria-labelledby="toma-existencia">
                <button
                  type="button"
                  className={styles.paso}
                  onClick={() => setExistencia((n) => Math.max(0, n - 1))}
                  aria-label="Una menos"
                >
                  <IconoMenos tamano={16} />
                </button>
                <input
                  className={styles.pasosValor}
                  value={existencia}
                  inputMode="numeric"
                  aria-label="Existencia"
                  onChange={(e) => {
                    const n = Number(e.target.value.replace(/\D/g, ""));
                    setExistencia(Number.isFinite(n) ? Math.min(n, 99999) : 0);
                  }}
                  onFocus={(e) => e.target.select()}
                />
                <button
                  type="button"
                  className={styles.paso}
                  onClick={() => setExistencia((n) => Math.min(99999, n + 1))}
                  aria-label="Una más"
                >
                  <IconoMas tamano={16} />
                </button>
              </div>
            </div>
          </div>

          <div className={styles.campo}>
            <span className={styles.etiqueta} id="toma-condicion">
              Condición
            </span>
            <div className={styles.segmentos} role="radiogroup" aria-labelledby="toma-condicion">
              {CONDICIONES.map((c) => (
                <button
                  key={c.valor}
                  type="button"
                  role="radio"
                  aria-checked={condicion === c.valor}
                  className={styles.segmento}
                  onClick={() => setCondicion(String(c.valor))}
                >
                  {c.etiqueta}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            className={styles.mas}
            aria-expanded={masDatos}
            onClick={() => setMasDatos((m) => !m)}
          >
            <span>Ubicación y número OEM</span>
            <span className={styles.masResumen}>
              {[ubicacion.trim().toUpperCase(), oem.trim().toUpperCase()].filter(Boolean).join(" · ") || "Opcional"}
            </span>
          </button>
          {masDatos && (
            <div className={`${styles.fila} ${styles.masCampos}`}>
              <label className={styles.campo}>
                <span className={styles.etiqueta}>Ubicación</span>
                <input
                  className={`${ui.campo} ${ui.campoMono}`}
                  value={ubicacion}
                  onChange={(e) => setUbicacion(e.target.value)}
                  placeholder="ESTANTE A3"
                  maxLength={40}
                  autoCapitalize="characters"
                />
                <span className={styles.ayuda}>Se queda para la siguiente.</span>
              </label>
              <label className={styles.campo}>
                <span className={styles.etiqueta}>N.º OEM</span>
                <input
                  className={`${ui.campo} ${ui.campoMono}`}
                  value={oem}
                  onChange={(e) => setOem(e.target.value)}
                  placeholder="27060-0D020"
                  maxLength={60}
                  autoCapitalize="characters"
                />
              </label>
            </div>
          )}

          {aviso && (
            <p className={styles.aviso} role="alert">
              {aviso}
            </p>
          )}

          <div className={styles.pie}>
            <button type="submit" className={`${ui.boton} ${ui.primario} ${styles.guardar}`} disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar y tomar otra"}
            </button>
          </div>
        </div>

        {/* ------------------------------------------------------- tomados -- */}
        <section className={styles.tomados} aria-label="Tomados en esta sesión">
          <div className={styles.tomadosCabeza}>
            <span className={styles.etiqueta}>Tomados en esta sesión</span>
            {tomados.length > 0 && (
              <span className={styles.tomadosResumen}>
                {conFoto} de {tomados.length} con foto
              </span>
            )}
          </div>
          {tomados.length === 0 ? (
            <p className={styles.vacio}>
              Cada pieza que guardés queda aquí con su marbete. Después le agregás vehículos, costo y más fotos
              desde Inventario › Productos.
            </p>
          ) : (
            <ol className={styles.marbetes}>
              {tomados.map((t) => (
                <li key={t.clave} className={styles.marbete}>
                  <span className={styles.ojal} aria-hidden="true" />
                  <span className={styles.miniatura}>
                    {t.vista ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.vista} alt="" />
                    ) : (
                      <IconoImagen tamano={18} />
                    )}
                  </span>
                  <span className={styles.marbeteTexto}>
                    <span className={styles.marbeteNombre}>{t.nombre}</span>
                    <span className={styles.marbeteDatos}>
                      {t.precio > 0 ? moneda(t.precio) : <em>Sin precio</em>} · {cant(t.existencia)} ·{" "}
                      {CONDICIONES.find((c) => c.valor === t.condicion)?.etiqueta}
                    </span>
                  </span>
                  <EstadoMarbete
                    estado={t.foto}
                    onReintentar={() => t.archivo && void subirFoto(t.clave, t.id, t.archivo)}
                  />
                </li>
              ))}
            </ol>
          )}
        </section>
      </form>
    </div>
  );
}

function EstadoMarbete({ estado, onReintentar }: { estado: EstadoFoto; onReintentar: () => void }) {
  if (estado === "error") {
    return (
      <button type="button" className={`${ui.boton} ${styles.reintentar}`} onClick={onReintentar}>
        <IconoRecargar tamano={13} /> Foto
      </button>
    );
  }
  const texto = { subiendo: "Subiendo foto", lista: "Guardado", sin: "Sin foto" }[estado];
  return (
    <span className={styles.estado} data-estado={estado} title={texto}>
      {estado === "lista" ? <IconoCheck tamano={13} /> : <span className={styles.led} aria-hidden="true" />}
      <span className={styles.estadoTexto}>{texto}</span>
    </span>
  );
}
