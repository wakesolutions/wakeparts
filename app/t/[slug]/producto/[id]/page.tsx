import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/app/_publico/piezas";
import { URL_SITIO } from "@/lib/sitio";
import { leerProducto, leerSitio } from "@/lib/sitio-datos";
import { enlaceWhatsapp, precioConIsv, rutaSitio } from "@/lib/sitio-web";
import { AccionesFicha, Galeria } from "../../_componentes/interactivo";
import { IconoWhatsapp } from "../../_componentes/iconos";
import { metadatosSitio, Precio } from "../../_componentes/piezas";
import styles from "../../_componentes/sitio.module.css";

type Props = { params: Promise<{ slug: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, id } = await params;
  const [sitio, p] = await Promise.all([leerSitio(slug), leerProducto(slug, Number(id))]);
  if (!sitio || !p) return {};
  return metadatosSitio(sitio, {
    titulo: p.nombre,
    descripcion: [p.marca, p.nombre, p.vehiculos.length ? `Le queda a ${p.vehiculos.slice(0, 3).join(", ")}` : ""]
      .filter(Boolean)
      .join(" · "),
    ruta: `/producto/${p.id}`,
  });
}

const CONDICION: Record<string, string> = { nuevo: "Nuevo", usado: "Usado", reconstruido: "Reconstruido" };

/** Ficha pública: fotos, precio (si el taller lo muestra), datos y vehículos a los que le queda. */
export default async function FichaProductoWeb({ params }: Props) {
  const { slug, id } = await params;
  const [sitio, p] = await Promise.all([leerSitio(slug), leerProducto(slug, Number(id))]);
  if (!sitio || !p) notFound();
  const base = rutaSitio(slug);
  const wa = enlaceWhatsapp(sitio.config.whatsapp, `Hola, me interesa: ${p.nombre} (${p.codigo}). ¿Lo tienen disponible?`);

  const datos = [
    ["Código", p.codigo],
    ["Marca", p.marca],
    ["Número de parte", p.numeroParte],
    ["OEM", p.oem],
    ["Condición", CONDICION[p.condicion] ?? p.condicion],
    ["Garantía", p.garantiaDias ? `${p.garantiaDias} días` : null],
  ].filter(([, v]) => v) as [string, string][];

  return (
    <div className={styles.contenedor}>
      <JsonLd
        datos={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: p.nombre,
          sku: p.codigo,
          ...(p.marca ? { brand: { "@type": "Brand", name: p.marca } } : {}),
          ...(p.imagenes[0] ? { image: p.imagenes.map((i) => i.grande) } : {}),
          ...(p.descripcion ? { description: p.descripcion } : {}),
          ...(p.precio != null
            ? {
                offers: {
                  "@type": "Offer",
                  priceCurrency: "HNL",
                  price: precioConIsv(p.precio, p.exento).toFixed(2),
                  availability: "https://schema.org/InStock",
                  url: `${URL_SITIO}${base}/producto/${p.id}`,
                  seller: { "@type": "Organization", name: sitio.nombre },
                },
              }
            : {}),
        }}
      />
      <nav className={styles.migas} aria-label="Ruta">
        <Link href={base}>Inicio</Link> /<Link href={`${base}/catalogo`}>Catálogo</Link> /
        <Link href={`${base}/catalogo?cat=${p.idCategoria}`}>{p.categoria}</Link>
      </nav>

      <div className={styles.ficha}>
        <Galeria imagenes={p.imagenes} nombre={p.nombre} />

        <div className={styles.fichaInfo}>
          <div>
            <p className={styles.tarjetaMarca}>{[p.marca, p.categoria].filter(Boolean).join(" · ")}</p>
            <h1 className={styles.fichaTitulo} style={{ marginTop: "0.5rem" }}>
              {p.nombre}
            </h1>
          </div>
          <Precio producto={p} grande />
          <AccionesFicha slug={slug} producto={p} />
          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer" className={styles.enlaceWhatsapp}>
              <IconoWhatsapp /> Preguntar por WhatsApp
            </a>
          )}
          {p.descripcion && <p className={styles.historiaTexto}>{p.descripcion}</p>}

          <dl className={styles.especificaciones}>
            {datos.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>

          {p.vehiculos.length > 0 ? (
            <div>
              <p className={styles.filtroTitulo}>Le queda a</p>
              <ul className={styles.vehiculos}>
                {p.vehiculos.map((v) => (
                  <li key={v}>{v}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className={styles.textoAyuda}>
              Sin vehículos asignados: sirve para cualquiera o hay que confirmarlo. Preguntanos por tu carro.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
