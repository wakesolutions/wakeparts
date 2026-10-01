import type { Metadata } from "next";
import Link from "next/link";
import { moneda } from "@/lib/formato";
import { enlaceWhatsapp, precioConIsv, rutaSitio, type ProductoWeb, type SitioPublico } from "@/lib/sitio-web";
import { URL_SITIO } from "@/lib/sitio";
import { BotonAgregar, BotonCarrito, EnlaceNav } from "./interactivo";
import { IconoPieza, IconoWhatsapp } from "./iconos";
import styles from "./sitio.module.css";

/** Metadatos de una página del sitio de un taller. Sin publicar = noindex. */
export function metadatosSitio(sitio: SitioPublico, p: { titulo?: string; descripcion?: string; ruta?: string }): Metadata {
  const titulo = p.titulo ? `${p.titulo} · ${sitio.nombre}` : `${sitio.nombre} · Repuestos`;
  const descripcion =
    p.descripcion ||
    sitio.config.inicioBajada ||
    `Catálogo de repuestos de ${sitio.nombre}. Buscá por tu vehículo y mandá tu pedido en línea.`;
  const url = `${URL_SITIO}${rutaSitio(sitio.slug, p.ruta ?? "")}`;
  return {
    // Título absoluto: es la marca del taller, no la de Wake Parts.
    title: { absolute: titulo },
    description: descripcion,
    alternates: { canonical: url },
    robots: sitio.publicado ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: {
      type: "website",
      siteName: sitio.nombre,
      title: titulo,
      description: descripcion,
      url,
      locale: "es_HN",
      ...(sitio.fondo || sitio.logo ? { images: [{ url: (sitio.fondo ?? sitio.logo)! }] } : {}),
    },
    icons: sitio.logo ? { icon: sitio.logo } : undefined,
  };
}

export function Encabezado({ sitio }: { sitio: SitioPublico }) {
  const base = rutaSitio(sitio.slug);
  return (
    <header className={styles.encabezado}>
      <div className={`${styles.contenedor} ${styles.encabezadoFila}`}>
        <Link href={base} className={styles.marcaSitio} aria-label={`${sitio.nombre}, inicio`}>
          {sitio.logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={sitio.logo} alt="" />
          )}
          <span>{sitio.nombre}</span>
        </Link>
        <nav aria-label="Principal" className={styles.nav}>
          <EnlaceNav href={base} exacto>
            Inicio
          </EnlaceNav>
          <EnlaceNav href={`${base}/catalogo`}>Catálogo</EnlaceNav>
          <EnlaceNav href={`${base}/nosotros`}>Nosotros</EnlaceNav>
          <Link href={`${base}#contacto`}>Contacto</Link>
        </nav>
        <BotonCarrito slug={sitio.slug} />
      </div>
    </header>
  );
}

export function NavMovil({ sitio }: { sitio: SitioPublico }) {
  const base = rutaSitio(sitio.slug);
  return (
    <nav aria-label="Secciones" className={styles.navMovil}>
      <EnlaceNav href={base} exacto>
        Inicio
      </EnlaceNav>
      <EnlaceNav href={`${base}/catalogo`}>Catálogo</EnlaceNav>
      <EnlaceNav href={`${base}/nosotros`}>Nosotros</EnlaceNav>
      <EnlaceNav href={`${base}/carrito`}>Tu lista</EnlaceNav>
    </nav>
  );
}

export function Pie({ sitio }: { sitio: SitioPublico }) {
  const base = rutaSitio(sitio.slug);
  return (
    <footer className={styles.pie}>
      <div className={`${styles.contenedor} ${styles.pieFila}`}>
        <p>
          © {new Date().getFullYear()} {sitio.razonSocial || sitio.nombre}
        </p>
        <nav aria-label="Pie" className={styles.pieEnlaces}>
          <Link href={`${base}/catalogo`}>Catálogo</Link>
          <Link href={`${base}/nosotros`}>Nosotros</Link>
          {sitio.config.facebook && (
            <a href={sitio.config.facebook} target="_blank" rel="noopener noreferrer">
              Facebook
            </a>
          )}
          {sitio.config.instagram && (
            <a href={sitio.config.instagram} target="_blank" rel="noopener noreferrer">
              Instagram
            </a>
          )}
          <Link href="/privacidad">Privacidad</Link>
          <Link href="/">Hecho con Wake Parts</Link>
        </nav>
      </div>
    </footer>
  );
}

/** Precio con ISV o «Consultá el precio» (el taller decide; la base ya lo oculta). */
export function Precio({ producto, grande = false }: { producto: Pick<ProductoWeb, "precio" | "exento">; grande?: boolean }) {
  if (producto.precio == null) return <span className={styles.consultar}>Consultá el precio</span>;
  return (
    <span className={grande ? styles.fichaPrecio : styles.precio}>
      {moneda(precioConIsv(producto.precio, producto.exento))}
      <span className={styles.precioNota}>{producto.exento ? "Exento de ISV" : "ISV incluido"}</span>
    </span>
  );
}

const SELLO_AJUSTE: Record<string, { texto: string; tono: string }> = {
  motor: { texto: "Motor exacto", tono: "ajuste" },
  anio: { texto: "Le queda", tono: "ajuste" },
  modelo: { texto: "Le queda", tono: "ajuste" },
  marca: { texto: "Toda la marca", tono: "ajuste" },
  verificar: { texto: "Confirmá año o motor", tono: "verificar" },
};

export function TarjetaProducto({ slug, producto }: { slug: string; producto: ProductoWeb }) {
  const sello = producto.ajuste ? SELLO_AJUSTE[producto.ajuste] : producto.condicion === "usado" ? { texto: "Usado", tono: "" } : null;
  return (
    <article className={styles.tarjeta}>
      <div className={styles.tarjetaImagen}>
        {producto.imagen ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={producto.imagen} alt="" loading="lazy" />
        ) : (
          <IconoPieza tamano={56} />
        )}
        {sello && (
          <span className={styles.sello} data-tono={sello.tono || undefined}>
            {sello.texto}
          </span>
        )}
      </div>
      <div className={styles.tarjetaCuerpo}>
        <span className={styles.tarjetaMarca}>{[producto.marca, producto.categoria].filter(Boolean).join(" · ")}</span>
        <Link href={rutaSitio(slug, `/producto/${producto.id}`)} className={`${styles.tarjetaNombre} ${styles.tarjetaEnlace}`}>
          {producto.nombre}
        </Link>
      </div>
      <div className={styles.tarjetaPie}>
        <Precio producto={producto} />
        <BotonAgregar slug={slug} producto={producto} />
      </div>
    </article>
  );
}

/** Dirección, horario, teléfono y WhatsApp. */
export function Contacto({ sitio }: { sitio: SitioPublico }) {
  const wa = enlaceWhatsapp(sitio.config.whatsapp, `Hola ${sitio.nombre}, vi su catálogo en línea.`);
  const datos = [
    sitio.direccion && {
      etiqueta: "Dirección",
      valor: sitio.config.mapa ? (
        <a href={sitio.config.mapa} target="_blank" rel="noopener noreferrer">
          {sitio.direccion} ↗
        </a>
      ) : (
        sitio.direccion
      ),
    },
    sitio.config.horario && { etiqueta: "Horario", valor: sitio.config.horario },
    sitio.telefono && { etiqueta: "Teléfono", valor: <a href={`tel:${sitio.telefono.replace(/\D/g, "")}`}>{sitio.telefono}</a> },
    wa && {
      etiqueta: "WhatsApp",
      valor: (
        <a href={wa} target="_blank" rel="noopener noreferrer" className={styles.enlaceWhatsapp}>
          <IconoWhatsapp /> Escribinos
        </a>
      ),
    },
    sitio.correo && { etiqueta: "Correo", valor: <a href={`mailto:${sitio.correo}`}>{sitio.correo}</a> },
  ].filter(Boolean) as { etiqueta: string; valor: React.ReactNode }[];

  if (!datos.length) return null;
  return (
    <div className={styles.contacto}>
      {datos.map((d) => (
        <div key={d.etiqueta} className={styles.contactoDato}>
          <span className={styles.contactoEtiqueta}>{d.etiqueta}</span>
          <span className={styles.contactoValor}>{d.valor}</span>
        </div>
      ))}
    </div>
  );
}
