"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { useApi } from "@/components/datos/apis";
import ui from "@/components/ui/controles.module.css";
import { IconoAnterior, IconoCamara, IconoEstrella, IconoPapelera, IconoSiguiente } from "@/components/ui/iconos";
import { urlImagen } from "@/lib/imagenes";
import type { ImagenProducto } from "./api";
import { esImagen, procesarFoto } from "./procesar";
import styles from "./galeria-producto.module.css";

type Subida = { id: string; nombre: string; vista: string; error?: string };

const MAX_FOTOS = 12;

/** Fotos de un producto: arrastrar y soltar, la primera es la principal. */
export function GaleriaProducto({
  idProducto,
  editable,
  onCambio,
}: {
  idProducto: number;
  editable: boolean;
  onCambio?: (cantidad: number) => void;
}) {
  const api = useApi("imagenes");
  const [fotos, setFotos] = useState<ImagenProducto[] | null>(null);
  const [subidas, setSubidas] = useState<Subida[]>([]);
  const [encima, setEncima] = useState(false);
  const [ampliada, setAmpliada] = useState<ImagenProducto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const avisar = useRef(onCambio);
  useEffect(() => {
    avisar.current = onCambio;
  });

  useEffect(() => {
    let vivo = true;
    api
      .leer(idProducto)
      .then((f) => vivo && setFotos(f))
      .catch(() => vivo && setError("No se pudieron cargar las fotos."));
    return () => {
      vivo = false;
    };
  }, [api, idProducto]);

  function actualizar(siguiente: ImagenProducto[]) {
    setFotos(siguiente);
    avisar.current?.(siguiente.length);
  }

  async function subir(archivos: File[]) {
    setError(null);
    const libres = MAX_FOTOS - (fotos?.length ?? 0) - subidas.length;
    const validas = archivos.filter(esImagen).slice(0, Math.max(0, libres));
    if (archivos.length && !validas.length) {
      setError(libres <= 0 ? `Máximo ${MAX_FOTOS} fotos por producto.` : "Eso no parece una foto (JPG, PNG, WebP o HEIC).");
      return;
    }
    const nuevas = validas.map((a) => ({ id: crypto.randomUUID(), nombre: a.name, vista: URL.createObjectURL(a) }));
    setSubidas((s) => [...s, ...nuevas]);

    // Una a la vez: el orden de subida es el orden de las fotos.
    let acumuladas = fotos ?? [];
    for (const [i, archivo] of validas.entries()) {
      const marca = nuevas[i];
      try {
        const foto = await procesarFoto(archivo);
        const datos = new FormData();
        datos.set("producto", String(idProducto));
        datos.set("archivo", foto.grande);
        datos.set("miniatura", foto.miniatura);
        datos.set("ancho", String(foto.ancho));
        datos.set("alto", String(foto.alto));
        const r = await api.subir(datos);
        if (!r.ok) throw new Error(r.error);
        acumuladas = [...acumuladas, r.imagen];
        actualizar(acumuladas);
        setSubidas((s) => s.filter((x) => x.id !== marca.id));
        URL.revokeObjectURL(marca.vista);
      } catch (e) {
        const mensaje = e instanceof Error && e.message.length < 120 ? e.message : "No se pudo subir.";
        setSubidas((s) => s.map((x) => (x.id === marca.id ? { ...x, error: mensaje } : x)));
      }
    }
  }

  function soltar(e: DragEvent) {
    e.preventDefault();
    setEncima(false);
    if (editable) void subir([...e.dataTransfer.files]);
  }

  async function eliminar(foto: ImagenProducto) {
    if (!fotos) return;
    const anterior = fotos;
    actualizar(fotos.filter((f) => f.id !== foto.id));
    if (ampliada?.id === foto.id) setAmpliada(null);
    const r = await api.eliminar(foto.id).catch(() => ({ ok: false as const, error: "Sin conexión." }));
    if (!r.ok) {
      actualizar(anterior);
      setError(r.error);
    }
  }

  async function mover(indice: number, destino: number) {
    if (!fotos || destino < 0 || destino >= fotos.length) return;
    const anterior = fotos;
    const siguiente = [...fotos];
    const [f] = siguiente.splice(indice, 1);
    siguiente.splice(destino, 0, f);
    actualizar(siguiente);
    const r = await api.ordenar(idProducto, siguiente.map((x) => x.id)).catch(() => ({ ok: false as const, error: "Sin conexión." }));
    if (!r.ok) {
      actualizar(anterior);
      setError(r.error);
    }
  }

  return (
    <div className={styles.galeria}>
      {editable && (
        <button
          type="button"
          className={styles.zona}
          data-encima={encima || undefined}
          onClick={() => entrada.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setEncima(true);
          }}
          onDragLeave={() => setEncima(false)}
          onDrop={soltar}
        >
          <span className={styles.zonaIcono}>
            <IconoCamara tamano={22} />
          </span>
          <span className={styles.zonaTexto}>
            <strong>Soltá fotos aquí</strong> o hacé clic para elegirlas
          </span>
          <span className={styles.zonaNota}>Se comprimen solas · la primera es la principal · máx. {MAX_FOTOS}</span>
          <input
            ref={entrada}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              void subir([...(e.target.files ?? [])]);
              e.target.value = "";
            }}
          />
        </button>
      )}

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {!fotos ? (
        <div className={styles.cargando} aria-label="Cargando fotos" />
      ) : fotos.length === 0 && subidas.length === 0 ? (
        <p className={styles.vacio}>Todavía no hay fotos. Una buena foto vende más en el catálogo.</p>
      ) : (
        <ul className={styles.grilla}>
          {fotos.map((f, i) => (
            <li key={f.id} className={styles.foto} data-principal={i === 0 || undefined} style={{ animationDelay: `${i * 40}ms` }}>
              <button type="button" className={styles.fotoVer} onClick={() => setAmpliada(f)} aria-label={`Ver foto ${i + 1}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={urlImagen(i === 0 ? f.ruta : (f.ruta_miniatura ?? f.ruta))} alt="" loading="lazy" decoding="async" />
              </button>
              {i === 0 && (
                <span className={styles.principal}>
                  <IconoEstrella tamano={11} /> Principal
                </span>
              )}
              {editable && (
                <div className={styles.fotoAcciones}>
                  <button type="button" aria-label="Mover a la izquierda" disabled={i === 0} onClick={() => mover(i, i - 1)}>
                    <IconoAnterior tamano={13} />
                  </button>
                  {i > 0 && (
                    <button type="button" aria-label="Hacer principal" onClick={() => mover(i, 0)}>
                      <IconoEstrella tamano={13} />
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label="Mover a la derecha"
                    disabled={i === fotos.length - 1}
                    onClick={() => mover(i, i + 1)}
                  >
                    <IconoSiguiente tamano={13} />
                  </button>
                  <button type="button" aria-label="Eliminar foto" data-peligro="" onClick={() => eliminar(f)}>
                    <IconoPapelera tamano={13} />
                  </button>
                </div>
              )}
            </li>
          ))}
          {subidas.map((s) => (
            <li key={s.id} className={styles.foto} data-subiendo={s.error ? undefined : ""} data-error={s.error ? "" : undefined}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.vista} alt="" />
              <span className={styles.progreso}>{s.error ?? "Subiendo…"}</span>
              {s.error && (
                <button
                  type="button"
                  className={`${ui.boton} ${styles.descartar}`}
                  onClick={() => {
                    URL.revokeObjectURL(s.vista);
                    setSubidas((x) => x.filter((y) => y.id !== s.id));
                  }}
                >
                  Descartar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {ampliada && (
        <div className={styles.visor} role="dialog" aria-label="Foto ampliada" onClick={() => setAmpliada(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={urlImagen(ampliada.ruta)} alt="" />
        </div>
      )}
    </div>
  );
}
