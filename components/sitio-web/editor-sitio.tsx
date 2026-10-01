"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useApi } from "@/components/datos/apis";
import { Formulario } from "@/components/formulario/formulario";
import idStyles from "@/components/identidad/identidad.module.css";
import { esImagen, reducirImagen } from "@/components/imagenes/procesar";
import ui from "@/components/ui/controles.module.css";
import { IconoBuscar, IconoCerrar, IconoFlechaAbajo, IconoFlechaArriba, IconoImagen, IconoMas } from "@/components/ui/iconos";
import { urlArchivoEmpresa } from "@/lib/identidad";
import type { DefCampo, ResultadoGuardar, Valores } from "@/lib/recursos/tipos";
import { URL_SITIO } from "@/lib/sitio";
import { errorSlug, MAX_DESTACADOS, MAX_FOTOS, rutaSitio, type ConfigSitio } from "@/lib/sitio-web";
import type { EstadoSitio, ProductoElegible } from "./api";
import styles from "./sitio-web.module.css";

type Pestana = "general" | "portada" | "nosotros" | "destacados";

const PESTANAS: { id: Pestana; nombre: string }[] = [
  { id: "general", nombre: "Dirección y contacto" },
  { id: "portada", nombre: "Portada" },
  { id: "nosotros", nombre: "Nosotros" },
  { id: "destacados", nombre: "Destacados" },
];

const URL_HTTPS = { patron: "^https://\\S+$", mensajePatron: "Pegá el enlace completo, empezando con https://" } as const;

const CAMPOS_CONTACTO: readonly DefCampo[] = [
  {
    nombre: "mostrarPrecios",
    etiqueta: "Mostrar precios en el sitio",
    tipo: "booleano",
    ayuda: "Si lo apagás, el sitio dice «Consultá el precio» y la base no entrega los precios.",
    ancho: "completo",
  },
  {
    nombre: "whatsapp",
    etiqueta: "WhatsApp",
    tipo: "texto",
    maxLargo: 20,
    patron: "^[0-9 +\\-]{8,20}$",
    mensajePatron: "Ocho dígitos (o con código de país).",
    placeholder: "9876-5432",
    ayuda: "Para el botón «Escribinos» y «Preguntar por WhatsApp».",
  },
  { nombre: "horario", etiqueta: "Horario", tipo: "texto", maxLargo: 160, placeholder: "Lun–Vie 7:30–17:30 · Sáb 7:30–12:00" },
  {
    nombre: "mapa",
    etiqueta: "Enlace del mapa",
    tipo: "texto",
    maxLargo: 300,
    ...URL_HTTPS,
    placeholder: "https://maps.app.goo.gl/…",
    ayuda: "En Google Maps: Compartir › Copiar vínculo.",
    ancho: "completo",
  },
  { nombre: "facebook", etiqueta: "Facebook", tipo: "texto", maxLargo: 300, ...URL_HTTPS, placeholder: "https://facebook.com/…" },
  { nombre: "instagram", etiqueta: "Instagram", tipo: "texto", maxLargo: 300, ...URL_HTTPS, placeholder: "https://instagram.com/…" },
];

const CAMPOS_PORTADA: readonly DefCampo[] = [
  {
    nombre: "inicioTitulo",
    etiqueta: "Título grande",
    tipo: "texto",
    maxLargo: 90,
    placeholder: "La pieza exacta para tu carro",
    ayuda: "Corto y con fuerza: 3 a 7 palabras. Sin título se usa el nombre del taller.",
    ancho: "completo",
  },
  {
    nombre: "inicioBajada",
    etiqueta: "Bajada",
    tipo: "textoLargo",
    maxLargo: 220,
    placeholder: "Repuestos nuevos y usados para japoneses y americanos…",
    ancho: "completo",
  },
  { nombre: "inicioDestacados", etiqueta: "Mostrar destacados", tipo: "booleano", seccion: "Secciones de la portada" },
  { nombre: "inicioCategorias", etiqueta: "Mostrar categorías", tipo: "booleano" },
  { nombre: "inicioNosotros", etiqueta: "Mostrar la historia", tipo: "booleano" },
];

const CAMPOS_NOSOTROS: readonly DefCampo[] = [
  {
    nombre: "nosotrosTitulo",
    etiqueta: "Título",
    tipo: "texto",
    maxLargo: 90,
    placeholder: "Tres generaciones entre motores",
  },
  {
    nombre: "nosotrosDesde",
    etiqueta: "Abrimos en",
    tipo: "texto",
    maxLargo: 4,
    patron: "^(19|20)\\d\\d$",
    mensajePatron: "Un año, por ejemplo 1998.",
    placeholder: "1998",
  },
  {
    nombre: "nosotrosTexto",
    etiqueta: "Su historia",
    tipo: "textoLargo",
    maxLargo: 3000,
    placeholder: "Cómo empezó el negocio, qué los hace distintos, a quién atienden…",
    ayuda: "Dejá una línea en blanco entre párrafos. El primero sale también en la portada.",
    ancho: "completo",
  },
  {
    nombre: "nosotrosPuntos",
    etiqueta: "Por qué elegirlos",
    tipo: "textoLargo",
    maxLargo: 400,
    placeholder: "Piezas probadas antes de venderlas\nGarantía de 30 días en eléctricos\nEnvíos a todo Honduras",
    ayuda: "Hasta 4, uno por línea.",
    ancho: "completo",
  },
];

/** Módulo Sitio web: dirección, publicación, textos, fotos y destacados del sitio público del taller. */
export function EditorSitio() {
  const api = useApi("sitioWeb");
  const [sitio, setSitio] = useState<EstadoSitio | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pestana, setPestana] = useState<Pestana>("general");
  const [aviso, setAviso] = useState<{ texto: string; error?: boolean } | null>(null);
  const [publicando, setPublicando] = useState(false);

  useEffect(() => {
    let vivo = true;
    api
      .leer()
      .then((r) => vivo && (r.ok ? setSitio(r.sitio) : setError(r.error)))
      .catch(() => vivo && setError("Sin conexión. Intentá de nuevo."));
    return () => {
      vivo = false;
    };
  }, [api]);

  if (error) return <p className={`${styles.hoja} ${styles.aviso}`}>{error}</p>;
  if (!sitio) return <div className={styles.hoja} aria-label="Cargando" />;

  const urlPublica = sitio.slug ? `${URL_SITIO.replace(/^https?:\/\//, "")}${rutaSitio(sitio.slug)}` : null;

  async function publicar(publicado: boolean) {
    setPublicando(true);
    const r = await api.guardar({ publicado }).catch(() => ({ ok: false as const, error: "Sin conexión." }));
    setPublicando(false);
    if (!r.ok) return setAviso({ texto: r.error, error: true });
    setSitio(r.sitio);
    setAviso({ texto: publicado ? "Tu sitio ya está en internet." : "Sitio despublicado: ahora solo lo ve tu taller." });
  }

  /** Guarda solo los campos de una pestaña: no pisa fotos ni destacados con valores viejos. */
  const guardarCampos = (campos: readonly DefCampo[]) => async (valores: Valores): Promise<ResultadoGuardar> => {
    const config = Object.fromEntries(campos.map((c) => [c.nombre, valores[c.nombre]])) as Partial<ConfigSitio>;
    const r = await api.guardar({ config });
    if (!r.ok) return r;
    setSitio(r.sitio);
    return { ok: true, id: "sitio" };
  };

  return (
    <div className={styles.hoja}>
      <header className={styles.estado}>
        <div>
          <p className={styles.estadoEtiqueta}>
            <span className={styles.led} data-encendido={sitio.publicado || undefined} />
            {sitio.publicado ? "Publicado" : "Sin publicar"}
          </p>
          <h3 className={styles.estadoTitulo}>
            {sitio.publicado ? "Tu taller está en internet" : sitio.slug ? "Listo para publicar" : "Tu sitio web"}
          </h3>
          {urlPublica ? (
            <span className={styles.url}>
              {urlPublica.replace(sitio.slug!, "")}
              <strong>{sitio.slug}</strong>
            </span>
          ) : (
            <span className={styles.url}>Elegí la dirección abajo para empezar.</span>
          )}
        </div>
        <div className={styles.acciones}>
          {sitio.slug && (
            <a href={rutaSitio(sitio.slug)} target="_blank" rel="noopener" className={ui.boton}>
              {sitio.publicado ? "Ver mi sitio ↗" : "Vista previa ↗"}
            </a>
          )}
          {sitio.slug && (
            <button
              type="button"
              className={`${ui.boton} ${sitio.publicado ? ui.fantasma : ui.primario}`}
              disabled={publicando}
              onClick={() => publicar(!sitio.publicado)}
            >
              {publicando ? "Un momento…" : sitio.publicado ? "Despublicar" : "Publicar sitio"}
            </button>
          )}
        </div>
      </header>
      {aviso && (
        <p className={`${idStyles.mensaje} ${aviso.error ? idStyles.mensajeError : ""}`} role="status" style={{ marginTop: "0.8rem" }}>
          {aviso.texto}
        </p>
      )}

      <div className={idStyles.pestanas} role="tablist" aria-label="Secciones del sitio">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={pestana === p.id}
            className={idStyles.pestana}
            onClick={() => setPestana(p.id)}
          >
            {p.nombre}
          </button>
        ))}
      </div>

      <div className={idStyles.panel} role="tabpanel" key={pestana}>
        {pestana === "general" && (
          <div className={idStyles.apariencia}>
            <Seccion titulo="Dirección" texto="Así te encuentran. Usá el nombre del taller, sin tildes ni espacios.">
              <Direccion sitio={sitio} onGuardado={setSitio} />
            </Seccion>
            <Seccion titulo="Contacto y precios" texto="La dirección, el teléfono y el correo salen de Taller › Datos.">
              <Formulario
                campos={CAMPOS_CONTACTO}
                valoresIniciales={sitio.config}
                textoGuardar="Guardar"
                onGuardar={guardarCampos(CAMPOS_CONTACTO)}
              />
            </Seccion>
          </div>
        )}

        {pestana === "portada" && (
          <div className={idStyles.apariencia}>
            <Seccion
              titulo="Lo primero que ven"
              texto="El fondo y el logo de la portada son los de Taller › Apariencia. Debajo del título va el buscador por vehículo."
            >
              <Formulario
                campos={CAMPOS_PORTADA}
                valoresIniciales={sitio.config}
                textoGuardar="Guardar"
                onGuardar={guardarCampos(CAMPOS_PORTADA)}
              />
            </Seccion>
          </div>
        )}

        {pestana === "nosotros" && (
          <div className={idStyles.apariencia}>
            <Seccion titulo="Su historia" texto="La página «Nosotros»: quiénes son, desde cuándo y por qué confiar en ustedes.">
              <Formulario
                campos={CAMPOS_NOSOTROS}
                valoresIniciales={sitio.config}
                textoGuardar="Guardar"
                onGuardar={guardarCampos(CAMPOS_NOSOTROS)}
              />
            </Seccion>
            <Seccion titulo="Fotos" texto={`Del local, el equipo, la bodega. Hasta ${MAX_FOTOS}; la primera sale más grande.`}>
              <Fotos sitio={sitio} onCambio={setSitio} />
            </Seccion>
          </div>
        )}

        {pestana === "destacados" && (
          <div className={idStyles.apariencia}>
            <Seccion
              titulo="Destacados de la portada"
              texto={`Hasta ${MAX_DESTACADOS}, en el orden que elijas. Sin elegir, salen los últimos productos con foto.`}
            >
              <Destacados sitio={sitio} onCambio={setSitio} />
            </Seccion>
          </div>
        )}
      </div>
    </div>
  );
}

function Seccion({ titulo, texto, children }: { titulo: string; texto: string; children: ReactNode }) {
  return (
    <section className={idStyles.seccion}>
      <div>
        <h4 className={idStyles.seccionTitulo}>{titulo}</h4>
        <p className={idStyles.seccionTexto}>{texto}</p>
      </div>
      <div className={idStyles.seccionCuerpo}>{children}</div>
    </section>
  );
}

function Direccion({ sitio, onGuardado }: { sitio: EstadoSitio; onGuardado: (s: EstadoSitio) => void }) {
  const api = useApi("sitioWeb");
  const [slug, setSlug] = useState(sitio.slug ?? sitio.sugerencia);
  const [estado, setEstado] = useState<{ texto: string; error?: boolean } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const problema = errorSlug(slug);
  const sinCambios = slug === sitio.slug;

  async function guardar() {
    setGuardando(true);
    const r = await api.guardar({ slug }).catch(() => ({ ok: false as const, error: "Sin conexión." }));
    setGuardando(false);
    if (!r.ok) return setEstado({ texto: r.error, error: true });
    onGuardado(r.sitio);
    setEstado({ texto: "Dirección guardada." });
  }

  return (
    <>
      <div className={styles.direccion}>
        <span className={styles.prefijo}>{URL_SITIO.replace(/^https?:\/\//, "")}/t/</span>
        <input
          value={slug}
          onChange={(e) => {
            setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"));
            setEstado(null);
          }}
          maxLength={40}
          aria-label="Dirección del sitio"
          aria-invalid={Boolean(problema) || undefined}
          spellCheck={false}
        />
      </div>
      <div className={idStyles.fila}>
        <button
          type="button"
          className={`${ui.boton} ${ui.primario}`}
          disabled={guardando || Boolean(problema) || sinCambios}
          onClick={guardar}
        >
          {guardando ? "Guardando…" : sitio.slug ? "Cambiar dirección" : "Guardar dirección"}
        </button>
        {sitio.slug && !sinCambios && (
          <span className={styles.nota}>Si ya compartiste el enlace viejo, dejará de funcionar.</span>
        )}
      </div>
      {(problema || estado) && (
        <p className={problema || estado?.error ? styles.aviso : styles.nota} role="status">
          {problema ?? estado?.texto}
        </p>
      )}
    </>
  );
}

function Fotos({ sitio, onCambio }: { sitio: EstadoSitio; onCambio: (s: EstadoSitio) => void }) {
  const api = useApi("sitioWeb");
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const llenas = sitio.config.fotos.length >= MAX_FOTOS;

  async function subir(archivo: File | undefined) {
    if (!archivo) return;
    if (!esImagen(archivo)) return setError("Elegí una imagen JPG, PNG o WebP.");
    setSubiendo(true);
    setError(null);
    try {
      const datos = new FormData();
      datos.set("archivo", await reducirImagen(archivo, 1800, 0.82));
      const r = await api.subirFoto(datos);
      if (r.ok) onCambio(r.sitio);
      else setError(r.error);
    } catch {
      setError("No se pudo leer la imagen. Probá con otra.");
    } finally {
      setSubiendo(false);
    }
  }

  async function quitar(ruta: string) {
    const r = await api.quitarFoto(ruta);
    if (r.ok) onCambio(r.sitio);
    else setError(r.error);
  }

  return (
    <>
      {sitio.config.fotos.length > 0 && (
        <div className={styles.fotos}>
          {sitio.config.fotos.map((ruta, i) => (
            <div key={ruta} className={styles.foto}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={urlArchivoEmpresa(ruta)!} alt={`Foto ${i + 1}`} />
              {i === 0 && <span className={styles.portadaFoto}>Principal</span>}
              <button type="button" aria-label={`Quitar foto ${i + 1}`} onClick={() => quitar(ruta)}>
                <IconoCerrar tamano={12} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className={idStyles.fila}>
        <label className={`${ui.boton} ${subiendo || llenas ? idStyles.ocupado : ""}`}>
          <IconoImagen tamano={14} /> {subiendo ? "Subiendo…" : llenas ? "Ya tenés 6 fotos" : "Agregar foto"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            disabled={subiendo || llenas}
            onChange={(e) => {
              subir(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {error && (
        <p className={styles.aviso} role="alert">
          {error}
        </p>
      )}
    </>
  );
}

function Destacados({ sitio, onCambio }: { sitio: EstadoSitio; onCambio: (s: EstadoSitio) => void }) {
  const api = useApi("sitioWeb");
  const [elegidos, setElegidos] = useState<ProductoElegible[]>([]);
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState<ProductoElegible[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const ids = elegidos.map((e) => e.id);
  const sinCambios = JSON.stringify(ids) === JSON.stringify(sitio.config.destacados);

  useEffect(() => {
    let vivo = true;
    api.destacados(sitio.config.destacados).then((d) => vivo && setElegidos(d));
    return () => {
      vivo = false;
    };
    // Solo al abrir: después manda la lista local.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  useEffect(() => {
    if (!texto.trim()) return;
    let vivo = true;
    const t = setTimeout(() => api.buscarProductos(texto).then((r) => vivo && setResultados(r)), 220);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [api, texto]);

  function mover(i: number, d: -1 | 1) {
    const copia = [...elegidos];
    [copia[i], copia[i + d]] = [copia[i + d], copia[i]];
    setElegidos(copia);
  }

  async function guardar() {
    setGuardando(true);
    const r = await api.guardar({ config: { destacados: ids } }).catch(() => ({ ok: false as const, error: "Sin conexión." }));
    setGuardando(false);
    if (!r.ok) return setAviso(r.error);
    onCambio(r.sitio);
    setAviso("Destacados guardados.");
  }

  return (
    <>
      {elegidos.length > 0 ? (
        <ol className={styles.listaProductos}>
          {elegidos.map((p, i) => (
            <li key={p.id} className={styles.filaProducto}>
              <span className={styles.posicion}>{String(i + 1).padStart(2, "0")}</span>
              <span>
                {p.nombre}
                <small className={p.publicable ? undefined : styles.noPublicable}>
                  {p.codigo}
                  {!p.publicable && " · No se ve en el sitio (oculto o sin existencia)"}
                </small>
              </span>
              <span className={styles.filaBotones}>
                <button type="button" className={`${ui.boton} ${ui.icono} ${ui.fantasma}`} disabled={i === 0} onClick={() => mover(i, -1)} aria-label="Subir">
                  <IconoFlechaArriba tamano={13} />
                </button>
                <button
                  type="button"
                  className={`${ui.boton} ${ui.icono} ${ui.fantasma}`}
                  disabled={i === elegidos.length - 1}
                  onClick={() => mover(i, 1)}
                  aria-label="Bajar"
                >
                  <IconoFlechaAbajo tamano={13} />
                </button>
                <button
                  type="button"
                  className={`${ui.boton} ${ui.icono} ${ui.fantasma}`}
                  onClick={() => setElegidos(elegidos.filter((e) => e.id !== p.id))}
                  aria-label={`Quitar ${p.nombre}`}
                >
                  <IconoCerrar tamano={12} />
                </button>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className={styles.nota}>Todavía no elegiste. Buscá productos abajo.</p>
      )}

      {elegidos.length < MAX_DESTACADOS && (
        <>
          <label className={styles.direccion} style={{ maxWidth: "none" }}>
            <span className={styles.prefijo}>
              <IconoBuscar tamano={14} />
            </span>
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Buscar producto para destacar"
              aria-label="Buscar producto para destacar"
              style={{ fontFamily: "inherit" }}
            />
          </label>
          {texto.trim() && resultados.length > 0 && (
            <ul className={styles.listaProductos}>
              {resultados
                .filter((r) => !ids.includes(r.id))
                .slice(0, 8)
                .map((r) => (
                  <li key={r.id} className={styles.filaProducto}>
                    <span />
                    <span>
                      {r.nombre}
                      <small className={r.publicable ? undefined : styles.noPublicable}>
                        {r.codigo}
                        {!r.publicable && " · Sin existencia: no se verá"}
                      </small>
                    </span>
                    <button type="button" className={`${ui.boton} ${ui.fantasma}`} onClick={() => setElegidos([...elegidos, r])}>
                      <IconoMas tamano={13} /> Destacar
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </>
      )}

      <div className={idStyles.fila}>
        <button type="button" className={`${ui.boton} ${ui.primario}`} disabled={guardando || sinCambios} onClick={guardar}>
          {guardando ? "Guardando…" : "Guardar destacados"}
        </button>
        {aviso && <span className={styles.nota}>{aviso}</span>}
      </div>
    </>
  );
}
