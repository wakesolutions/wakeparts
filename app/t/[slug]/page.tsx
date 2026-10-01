import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/app/_publico/piezas";
import { URL_SITIO } from "@/lib/sitio";
import { leerPortada, leerSitio } from "@/lib/sitio-datos";
import { rutaSitio } from "@/lib/sitio-web";
import { Buscador } from "./_componentes/interactivo";
import { Contacto, metadatosSitio, TarjetaProducto } from "./_componentes/piezas";
import styles from "./_componentes/sitio.module.css";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const sitio = await leerSitio((await params).slug);
  return sitio ? metadatosSitio(sitio, {}) : {};
}

/** Portada: el taller, «¿qué carro tenés?», destacados, categorías, historia y contacto. */
export default async function PortadaSitio({ params }: Props) {
  const { slug } = await params;
  const sitio = await leerSitio(slug);
  if (!sitio) notFound();
  const { config: c } = sitio;
  const portada = await leerPortada(slug);
  const base = rutaSitio(slug);
  const titulo = c.inicioTitulo || sitio.nombre;
  const palabras = titulo.split(" ");
  // Título en dos líneas que suben una tras otra.
  const corte = Math.ceil(palabras.length / 2);
  const lineas = palabras.length > 2 ? [palabras.slice(0, corte).join(" "), palabras.slice(corte).join(" ")] : [titulo];
  const primerParrafo = c.nosotrosTexto.split("\n\n")[0];

  return (
    <>
      <JsonLd
        datos={{
          "@context": "https://schema.org",
          "@type": "AutoPartsStore",
          name: sitio.nombre,
          url: `${URL_SITIO}${base}`,
          ...(sitio.logo ? { logo: sitio.logo } : {}),
          ...(sitio.telefono ? { telephone: sitio.telefono } : {}),
          ...(sitio.correo ? { email: sitio.correo } : {}),
          ...(sitio.direccion ? { address: { "@type": "PostalAddress", streetAddress: sitio.direccion, addressCountry: "HN" } } : {}),
          ...(c.horario ? { openingHours: c.horario } : {}),
        }}
      />

      <section className={styles.hero} aria-labelledby="titulo-portada">
        {sitio.fondo ? (
          <div
            className={styles.heroFondo}
            aria-hidden="true"
            style={{
              backgroundImage: [
                `linear-gradient(0deg, var(--wp-bg) 2%, transparent 45%)`,
                `linear-gradient(90deg, color-mix(in oklab, var(--wp-bg) ${Math.min(92, sitio.atenuar + 30)}%, transparent), transparent 75%)`,
                `linear-gradient(color-mix(in oklab, var(--wp-bg) ${sitio.atenuar}%, transparent), color-mix(in oklab, var(--wp-bg) ${sitio.atenuar}%, transparent))`,
                `url("${sitio.fondo}")`,
              ].join(", "),
            }}
          />
        ) : (
          <div className={styles.heroFondo} data-sin-foto="" aria-hidden="true" />
        )}
        <div className={`${styles.contenedor} ${styles.heroContenido}`}>
          <p className={`${styles.sobretitulo} ${styles.entra}`}>
            {c.inicioTitulo ? sitio.nombre : "Repuestos"}
            {c.nosotrosDesde && ` · Desde ${c.nosotrosDesde}`}
          </p>
          <h1 id="titulo-portada" className={styles.heroTitulo}>
            {lineas.map((l, i) => (
              <span key={l} className={styles.heroLinea}>
                <span style={{ animationDelay: `${120 + i * 90}ms` }}>{l}</span>
              </span>
            ))}
          </h1>
          {c.inicioBajada && (
            <p className={`${styles.heroBajada} ${styles.entra}`} style={{ animationDelay: "320ms" }}>
              {c.inicioBajada}
            </p>
          )}
          <div className={styles.entra} style={{ animationDelay: "420ms" }}>
            <Buscador slug={slug} />
          </div>
          {(c.horario || sitio.telefono) && (
            <dl className={`${styles.datosRapidos} ${styles.entra}`} style={{ animationDelay: "520ms" }}>
              {c.horario && (
                <div>
                  <dt>Horario</dt>
                  <dd>{c.horario}</dd>
                </div>
              )}
              {sitio.telefono && (
                <div>
                  <dt>Llamanos</dt>
                  <dd>
                    <a href={`tel:${sitio.telefono.replace(/\D/g, "")}`}>{sitio.telefono}</a>
                  </dd>
                </div>
              )}
            </dl>
          )}
        </div>
      </section>

      {c.inicioDestacados && portada.destacados.length > 0 && (
        <section className={`${styles.seccion} ${styles.contenedor}`} aria-labelledby="titulo-destacados">
          <div className={styles.seccionCabecera}>
            <div>
              <p className={styles.sobretitulo}>Destacados</p>
              <h2 id="titulo-destacados" className={styles.seccionTitulo}>
                Lo que más sale
              </h2>
            </div>
            <Link href={`${base}/catalogo`} className={styles.enlaceFlecha}>
              Ver todo el catálogo →
            </Link>
          </div>
          <div className={styles.grilla}>
            {portada.destacados.map((p) => (
              <TarjetaProducto key={p.id} slug={slug} producto={p} />
            ))}
          </div>
        </section>
      )}

      {c.inicioCategorias && portada.categorias.length > 0 && (
        <section className={`${styles.seccion} ${styles.contenedor}`} aria-labelledby="titulo-categorias">
          <div className={styles.seccionCabecera}>
            <div>
              <p className={styles.sobretitulo}>Categorías</p>
              <h2 id="titulo-categorias" className={styles.seccionTitulo}>
                Buscá por tipo de pieza
              </h2>
            </div>
          </div>
          <nav className={styles.categorias} aria-label="Categorías">
            {portada.categorias.map((cat) => (
              <Link key={cat.id} href={`${base}/catalogo?cat=${cat.id}`} className={styles.categoria}>
                <span className={styles.categoriaNombre}>{cat.nombre}</span>
                <span className={styles.categoriaCuenta}>{cat.productos}</span>
              </Link>
            ))}
          </nav>
        </section>
      )}

      {c.inicioNosotros && (c.nosotrosTexto || c.nosotrosDesde) && (
        <section className={`${styles.seccion} ${styles.contenedor}`} aria-labelledby="titulo-historia">
          <div className={styles.historia}>
            <div>
              <p className={styles.sobretitulo}>Nosotros</p>
              <h2 id="titulo-historia" className={styles.seccionTitulo}>
                {c.nosotrosTitulo || `Conocé ${sitio.nombre}`}
              </h2>
              {c.nosotrosDesde && (
                <p className={styles.desde} style={{ marginTop: "2rem" }}>
                  <span className={styles.desdeAnio}>{c.nosotrosDesde}</span>
                  <span className={styles.desdeTexto}>Desde</span>
                </p>
              )}
            </div>
            <div className={styles.historiaTexto}>
              {primerParrafo && <p>{primerParrafo}</p>}
              <Link href={`${base}/nosotros`} className={styles.enlaceFlecha}>
                Nuestra historia →
              </Link>
            </div>
          </div>
        </section>
      )}

      <section id="contacto" className={`${styles.seccion} ${styles.contenedor}`} aria-labelledby="titulo-contacto">
        <div className={styles.seccionCabecera}>
          <div>
            <p className={styles.sobretitulo}>Contacto</p>
            <h2 id="titulo-contacto" className={styles.seccionTitulo}>
              Visitanos o escribinos
            </h2>
          </div>
        </div>
        <Contacto sitio={sitio} />
      </section>
    </>
  );
}
