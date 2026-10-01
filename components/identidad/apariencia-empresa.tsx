"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties, type DragEvent, type ReactNode } from "react";
import { useApi } from "@/components/datos/apis";
import { esImagen, reducirImagen } from "@/components/imagenes/procesar";
import ui from "@/components/ui/controles.module.css";
import { IconoCheck, IconoImagen } from "@/components/ui/iconos";
import { ACENTOS, acentoClaro, acentoValido, LADO_IMAGEN, luminancia, type TipoImagenEmpresa } from "@/lib/identidad";
import { PALETAS, type PaletaId } from "@/lib/paletas";
import { aplicarPaleta } from "@/lib/paletas-cliente";
import { useIdentidad } from "./contexto";
import styles from "./identidad.module.css";

const BASES: Record<PaletaId, { nombre: string; fondo: string; barra: string }> = {
  "rojo-negro": { nombre: "Oscura", fondo: "#121010", barra: "#2c2828" },
  "rojo-blanco": { nombre: "Clara", fondo: "#e9e5de", barra: "#fbfaf7" },
};

/**
 * Taller › Apariencia: logo, fondo del escritorio y tema (base clara u oscura +
 * color de marca). Todo se ve en vivo en el escritorio real mientras se elige;
 * las imágenes se guardan al subirlas, el tema con «Guardar».
 */
export function AparienciaEmpresa({
  nombreEmpresa,
  paletaGuardada,
}: {
  nombreEmpresa: string;
  paletaGuardada: PaletaId;
}) {
  const api = useApi("identidad");
  const router = useRouter();
  const { identidad, guardada, previsualizar, descartar, confirmar } = useIdentidad();
  const [paleta, setPaleta] = useState<PaletaId>(paletaGuardada);
  const [paletaBase, setPaletaBase] = useState<PaletaId>(paletaGuardada);
  const [subiendo, setSubiendo] = useState<TipoImagenEmpresa | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ texto: string; error?: boolean } | null>(null);

  const cambios =
    identidad.acento !== guardada.acento || identidad.atenuar !== guardada.atenuar || paleta !== paletaBase;

  // Al cerrar Taller sin guardar, el escritorio vuelve a lo guardado.
  const pendiente = useRef({ paletaBase, descartar });
  useEffect(() => {
    pendiente.current = { paletaBase, descartar };
  });
  useEffect(
    () => () => {
      pendiente.current.descartar();
      aplicarPaleta(pendiente.current.paletaBase);
    },
    [],
  );

  function elegirPaleta(id: PaletaId) {
    setPaleta(id);
    aplicarPaleta(id);
  }

  async function subir(tipo: TipoImagenEmpresa, archivo: File | undefined) {
    if (!archivo) return;
    if (!esImagen(archivo)) {
      setMensaje({ texto: "Elegí una imagen JPG, PNG o WebP.", error: true });
      return;
    }
    setSubiendo(tipo);
    setMensaje(null);
    try {
      const reducida = await reducirImagen(archivo, LADO_IMAGEN[tipo], tipo === "fondo" ? 0.82 : 0.9);
      const datos = new FormData();
      datos.set("tipo", tipo);
      datos.set("archivo", reducida);
      const r = await api.subir(datos);
      if (!r.ok) {
        setMensaje({ texto: r.error, error: true });
      } else {
        confirmar({ [tipo]: r.url });
        setMensaje({ texto: tipo === "logo" ? "Logo actualizado." : "Fondo actualizado para todo el equipo." });
        router.refresh();
      }
    } catch {
      setMensaje({ texto: "No se pudo leer la imagen. Probá con otra.", error: true });
    } finally {
      setSubiendo(null);
    }
  }

  async function quitar(tipo: TipoImagenEmpresa) {
    setSubiendo(tipo);
    setMensaje(null);
    const r = await api.quitar(tipo).catch(() => ({ ok: false as const, error: "Sin conexión. Intentá de nuevo." }));
    setSubiendo(null);
    if (!r.ok) return setMensaje({ texto: r.error, error: true });
    confirmar({ [tipo]: null });
    setMensaje({ texto: tipo === "logo" ? "Logo quitado." : "Volviste al fondo de Wake Parts." });
    router.refresh();
  }

  async function guardar() {
    setGuardando(true);
    setMensaje(null);
    const r = await api
      .guardarApariencia({ paleta, acento: identidad.acento, atenuar: identidad.atenuar })
      .catch(() => ({ ok: false as const, error: "Sin conexión. Intentá de nuevo." }));
    setGuardando(false);
    if (!r.ok) return setMensaje({ texto: r.error, error: true });
    confirmar({ acento: identidad.acento, atenuar: identidad.atenuar });
    setPaletaBase(paleta);
    setMensaje({ texto: "Listo: todo tu equipo ve el tema nuevo." });
    router.refresh();
  }

  function deshacer() {
    descartar();
    setPaleta(paletaBase);
    aplicarPaleta(paletaBase);
    setMensaje(null);
  }

  const acento = identidad.acento;
  const propio = acento && !ACENTOS.some((a) => a.valor === acento) ? acento : null;

  return (
    <div className={styles.apariencia}>
      <Seccion
        titulo="Logo"
        texto="Sale en la barra de menú, en el escritorio de todos y en tus facturas. Un PNG con fondo transparente queda mejor."
      >
        <div className={styles.fila} style={{ alignItems: "flex-end", gap: "1rem" }}>
          <ZonaImagen
            className={`${styles.soltar} ${subiendo === "logo" ? styles.ocupado : ""}`}
            etiqueta={identidad.logo ? "Cambiar el logo" : "Subir el logo"}
            onArchivo={(a) => subir("logo", a)}
          >
            {identidad.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={identidad.logo} alt={`Logo de ${nombreEmpresa}`} />
            ) : (
              <span className={styles.soltarTexto}>
                <IconoImagen tamano={22} />
                {subiendo === "logo" ? "Subiendo…" : "Soltá aquí tu logo"}
              </span>
            )}
          </ZonaImagen>
          <div className={styles.fila}>
            <BotonArchivo onArchivo={(a) => subir("logo", a)} ocupado={subiendo === "logo"}>
              {identidad.logo ? "Cambiar logo" : "Subir logo"}
            </BotonArchivo>
            {identidad.logo && (
              <button
                type="button"
                className={`${ui.boton} ${ui.fantasma}`}
                disabled={subiendo !== null}
                onClick={() => quitar("logo")}
              >
                Quitar
              </button>
            )}
          </div>
        </div>
      </Seccion>

      <Seccion
        titulo="Fondo del escritorio"
        texto="Lo ven todos los empleados al entrar. Una foto horizontal de al menos 1920 px: tu local, tu equipo, tu taller."
      >
        <div className={styles.contenedorMaqueta}>
          <ZonaImagen
            className={`${styles.maqueta} ${subiendo === "fondo" ? styles.ocupado : ""}`}
            etiqueta="Elegir fondo del escritorio"
            onArchivo={(a) => subir("fondo", a)}
          >
            <Maqueta nombreEmpresa={nombreEmpresa} />
          </ZonaImagen>
        </div>
        <div className={styles.fila}>
          <BotonArchivo onArchivo={(a) => subir("fondo", a)} ocupado={subiendo === "fondo"}>
            {identidad.fondo ? "Cambiar fondo" : "Elegir imagen"}
          </BotonArchivo>
          {identidad.fondo && (
            <button
              type="button"
              className={`${ui.boton} ${ui.fantasma}`}
              disabled={subiendo !== null}
              onClick={() => quitar("fondo")}
            >
              Restablecer el de Wake Parts
            </button>
          )}
        </div>
        {identidad.fondo && (
          <label className={styles.deslizador}>
            Velo
            <input
              type="range"
              min={0}
              max={85}
              step={5}
              value={identidad.atenuar}
              onChange={(e) => previsualizar({ atenuar: Number(e.target.value) })}
              className={styles.rango}
              style={{ "--lleno": `${(identidad.atenuar / 85) * 100}%` } as CSSProperties}
              aria-describedby="velo-ayuda"
            />
            <output>{identidad.atenuar}%</output>
          </label>
        )}
        {identidad.fondo && (
          <p id="velo-ayuda" className={styles.nota}>
            Más velo = el texto y las ventanas se leen mejor sobre la foto.
          </p>
        )}
      </Seccion>

      <Seccion
        titulo="Tema"
        texto="La base y el color de tu marca. El color reemplaza al rojo en botones, íconos del dock, enlaces y facturas."
      >
        <div className={styles.bases} role="radiogroup" aria-label="Base del tema">
          {PALETAS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={paleta === p.id}
              className={styles.base}
              onClick={() => elegirPaleta(p.id)}
            >
              <span
                className={styles.baseMuestra}
                style={{ background: BASES[p.id].fondo, "--barra": BASES[p.id].barra } as CSSProperties}
              />
              <span>{BASES[p.id].nombre}</span>
            </button>
          ))}
        </div>

        <div className={styles.colores} role="radiogroup" aria-label="Color de marca">
          {ACENTOS.map((a) => {
            const activo = acento === a.valor;
            return (
              <button
                key={a.nombre}
                type="button"
                role="radio"
                aria-checked={activo}
                aria-label={a.nombre}
                title={a.nombre}
                className={styles.color}
                style={{ "--c": a.muestra, "--sobre": acentoClaro(a.muestra) ? "#1a1514" : "#fff6f2" } as CSSProperties}
                onClick={() => previsualizar({ acento: a.valor })}
              >
                {activo && <IconoCheck tamano={14} />}
              </button>
            );
          })}
          <label
            className={`${styles.color} ${propio ? "" : styles.colorPropio}`}
            title="Otro color"
            style={propio ? ({ "--c": propio, "--sobre": acentoClaro(propio) ? "#1a1514" : "#fff6f2" } as CSSProperties) : undefined}
          >
            {propio && <IconoCheck tamano={14} />}
            <input
              type="color"
              aria-label="Otro color de marca"
              value={acento ?? "#d5121e"}
              onChange={(e) => previsualizar({ acento: acentoValido(e.target.value) })}
            />
          </label>
        </div>
        {acento && paleta === "rojo-blanco" && luminancia(acento) > 0.45 && (
          <p className={`${styles.nota} ${styles.notaAviso}`}>
            Ese color es muy claro para la base clara: los textos en color se van a leer poco.
          </p>
        )}
      </Seccion>

      {(cambios || mensaje) && (
        <div className={styles.guardar} role="status">
          {mensaje ? (
            <p className={`${styles.mensaje} ${mensaje.error ? styles.mensajeError : ""}`}>{mensaje.texto}</p>
          ) : (
            <p className={styles.guardarTexto}>Estás viendo el tema sin guardar. Solo vos lo ves por ahora.</p>
          )}
          {cambios && (
            <div className={styles.fila}>
              <button type="button" className={`${ui.boton} ${ui.fantasma}`} onClick={deshacer} disabled={guardando}>
                Descartar
              </button>
              <button type="button" className={`${ui.boton} ${ui.primario}`} onClick={guardar} disabled={guardando}>
                {guardando ? "Guardando…" : "Guardar tema"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Seccion({ titulo, texto, children }: { titulo: string; texto: string; children: ReactNode }) {
  return (
    <section className={styles.seccion}>
      <div>
        <h4 className={styles.seccionTitulo}>{titulo}</h4>
        <p className={styles.seccionTexto}>{texto}</p>
      </div>
      <div className={styles.seccionCuerpo}>{children}</div>
    </section>
  );
}

/** Miniatura del escritorio con el fondo, el velo, el color y el logo actuales. */
function Maqueta({ nombreEmpresa }: { nombreEmpresa: string }) {
  const { identidad } = useIdentidad();
  const { fondo, atenuar, logo } = identidad;
  return (
    <>
      {fondo && (
        <span
          className={styles.maquetaFondo}
          style={{
            backgroundImage: [
              `linear-gradient(90deg, color-mix(in oklab, var(--wp-bg) ${Math.min(92, atenuar + 30)}%, transparent), transparent 70%)`,
              `linear-gradient(color-mix(in oklab, var(--wp-bg) ${atenuar}%, transparent), color-mix(in oklab, var(--wp-bg) ${atenuar}%, transparent))`,
              `url("${fondo}")`,
            ].join(", "),
          }}
        />
      )}
      <span className={styles.maquetaBarra}>
        {logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" />
        )}
        {nombreEmpresa}
      </span>
      <span className={styles.maquetaSaludo}>
        {logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" />
        )}
        <span className={styles.maquetaEtiqueta}>Buenos días · {nombreEmpresa}</span>
        <span className={styles.maquetaNombre}>Ana</span>
      </span>
      <span className={styles.maquetaVentana} />
      <span className={styles.maquetaDock} aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
      </span>
      {!fondo && <span className="sr-only">Fondo de Wake Parts. Tocá para elegir una imagen.</span>}
    </>
  );
}

/** Botón que abre el selector de archivos. */
function BotonArchivo({
  onArchivo,
  ocupado,
  children,
}: {
  onArchivo: (a: File | undefined) => void;
  ocupado: boolean;
  children: ReactNode;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className={ui.boton} disabled={ocupado} onClick={() => entrada.current?.click()}>
        <IconoImagen tamano={14} /> {ocupado ? "Subiendo…" : children}
      </button>
      <input
        ref={entrada}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(e) => {
          onArchivo(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </>
  );
}

/** Área que se puede tocar (abre el selector) o donde se puede soltar una imagen. */
function ZonaImagen({
  className,
  etiqueta,
  onArchivo,
  children,
}: {
  className: string;
  etiqueta: string;
  onArchivo: (a: File | undefined) => void;
  children: ReactNode;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [encima, setEncima] = useState(false);

  function soltar(e: DragEvent) {
    e.preventDefault();
    setEncima(false);
    onArchivo(e.dataTransfer.files?.[0]);
  }

  return (
    <>
      <button
        type="button"
        className={className}
        aria-label={etiqueta}
        data-encima={encima || undefined}
        onClick={() => entrada.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setEncima(true);
        }}
        onDragLeave={() => setEncima(false)}
        onDrop={soltar}
      >
        {children}
      </button>
      <input
        ref={entrada}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(e) => {
          onArchivo(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </>
  );
}
