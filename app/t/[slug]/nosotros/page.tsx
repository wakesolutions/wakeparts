import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { urlArchivoEmpresa } from "@/lib/identidad";
import { leerSitio } from "@/lib/sitio-datos";
import { rutaSitio } from "@/lib/sitio-web";
import { Contacto, metadatosSitio } from "../_componentes/piezas";
import styles from "../_componentes/sitio.module.css";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const sitio = await leerSitio((await params).slug);
  if (!sitio) return {};
  return metadatosSitio(sitio, {
    titulo: "Nosotros",
    descripcion: sitio.config.nosotrosTexto.split("\n\n")[0]?.slice(0, 200) || undefined,
    ruta: "/nosotros",
  });
}

/** «Nosotros»: la historia del taller, sus fotos y lo que lo distingue. */
export default async function Nosotros({ params }: Props) {
  const { slug } = await params;
  const sitio = await leerSitio(slug);
  if (!sitio) notFound();
  const c = sitio.config;
  const parrafos = c.nosotrosTexto.split("\n\n").filter(Boolean);
  const puntos = c.nosotrosPuntos.split("\n").filter(Boolean);
  const fotos = c.fotos.map((r) => urlArchivoEmpresa(r)!).filter(Boolean);

  return (
    <>
      <section className={`${styles.seccion} ${styles.contenedor}`} aria-labelledby="titulo-nosotros">
        <div className={styles.historia} style={{ alignItems: "start" }}>
          <div>
            <p className={`${styles.sobretitulo} ${styles.entra}`}>Nosotros</p>
            <h1 id="titulo-nosotros" className={styles.heroTitulo} style={{ fontSize: "clamp(2.8rem, 7vw, 6.5rem)", marginTop: "0.8rem" }}>
              <span className={styles.heroLinea}>
                <span style={{ animationDelay: "100ms" }}>{c.nosotrosTitulo || sitio.nombre}</span>
              </span>
            </h1>
            {c.nosotrosDesde && (
              <p className={`${styles.desde} ${styles.entra}`} style={{ marginTop: "2.4rem", animationDelay: "240ms" }}>
                <span className={styles.desdeAnio}>{c.nosotrosDesde}</span>
                <span className={styles.desdeTexto}>
                  {new Date().getFullYear() - Number(c.nosotrosDesde)} años
                  <br />
                  atendiendo
                </span>
              </p>
            )}
          </div>
          <div className={`${styles.historiaTexto} ${styles.entra}`} style={{ animationDelay: "200ms" }}>
            {parrafos.length ? (
              parrafos.map((p, i) => <p key={i}>{p}</p>)
            ) : (
              <p>
                {sitio.nombre} vende repuestos para tu vehículo. Buscá lo que necesitás en el catálogo o escribinos.
              </p>
            )}
            <Link href={rutaSitio(slug, "/catalogo")} className={styles.enlaceFlecha}>
              Ver el catálogo →
            </Link>
          </div>
        </div>
      </section>

      {fotos.length > 0 && (
        <section className={`${styles.seccion} ${styles.contenedor}`} aria-label="Fotos del taller">
          <div className={styles.fotos} data-cantidad={fotos.length}>
            {fotos.map((f, i) => (
              <figure key={f}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f} alt={`${sitio.nombre}, foto ${i + 1}`} loading={i ? "lazy" : "eager"} />
              </figure>
            ))}
          </div>
        </section>
      )}

      {puntos.length > 0 && (
        <section className={`${styles.seccion} ${styles.contenedor}`} aria-labelledby="titulo-puntos">
          <h2 id="titulo-puntos" className={styles.seccionTitulo} style={{ marginBottom: "2.4rem" }}>
            Por qué elegirnos
          </h2>
          <ul className={styles.puntos}>
            {puntos.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </section>
      )}

      <section id="contacto" className={`${styles.seccion} ${styles.contenedor}`} aria-labelledby="titulo-contacto">
        <h2 id="titulo-contacto" className={styles.seccionTitulo} style={{ marginBottom: "2rem" }}>
          Visitanos
        </h2>
        <Contacto sitio={sitio} />
      </section>
    </>
  );
}
