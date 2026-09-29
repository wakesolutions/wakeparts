import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  BloqueCai,
  DemoBusqueda,
  EncabezadoPublico,
  Funciones,
  GridDepartamentos,
  JsonLd,
  LlamadoFinal,
  Migas,
  PiePublico,
  PreguntasFrecuentes,
  Seccion,
  esquemaPreguntas,
  preguntasDe,
} from "../../_publico/piezas";
import styles from "../../_publico/publico.module.css";
import { DEPARTAMENTOS, NOMBRE_SITIO, URL_SITIO, departamentoPorSlug } from "@/lib/sitio";

type Params = { params: Promise<{ departamento: string }> };

// Solo los 18 departamentos: cualquier otra ruta es 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return DEPARTAMENTOS.map((d) => ({ departamento: d.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const d = departamentoPorSlug((await params).departamento);
  if (!d) return {};
  const ruta = `/honduras/${d.slug}`;
  const titulo = `Sistema para repuestos y yonkers en ${d.nombre}: inventario y facturación con CAI`;
  const descripcion = `Wake Parts para tiendas de repuestos, yonkers y talleres de ${d.nombre} (${d.ciudades.slice(0, 4).join(", ")}): búsqueda por vehículo, cotizaciones, facturación con CAI del SAR, reportes de ventas e inventario desde Excel.`;
  return {
    title: titulo,
    description: descripcion,
    keywords: [
      `repuestos ${d.nombre}`,
      `repuestos ${d.cabecera}`,
      ...d.ciudades.slice(0, 4).map((c) => `venta de repuestos ${c}`),
      `yonker ${d.nombre}`,
      `sistema de facturación ${d.cabecera}`,
      `facturación con CAI ${d.nombre}`,
      `inventario de repuestos ${d.nombre}`,
    ],
    alternates: { canonical: ruta, languages: { "es-HN": ruta } },
    openGraph: { url: ruta, title: `${titulo} · ${NOMBRE_SITIO}`, description: descripcion },
    twitter: { card: "summary_large_image", title: `${titulo} · ${NOMBRE_SITIO}`, description: descripcion },
    other: { "geo.region": d.iso, "geo.placename": `${d.cabecera}, ${d.nombre}, Honduras` },
  };
}

export default async function PaginaDepartamento({ params }: Params) {
  const d = departamentoPorSlug((await params).departamento);
  if (!d) notFound();
  const url = `${URL_SITIO}/honduras/${d.slug}`;
  const preguntas = preguntasDe(d);
  const area = {
    "@type": "AdministrativeArea",
    name: d.nombre,
    identifier: d.iso,
    containedInPlace: { "@type": "Country", name: "Honduras" },
  };
  const esquema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: NOMBRE_SITIO, item: `${URL_SITIO}/` },
          { "@type": "ListItem", position: 2, name: "Honduras", item: `${URL_SITIO}/honduras` },
          { "@type": "ListItem", position: 3, name: d.nombre, item: url },
        ],
      },
      {
        "@type": "Service",
        "@id": `${url}#servicio`,
        name: `Inventario y facturación con CAI para repuestos en ${d.nombre}`,
        serviceType: "Software de inventario y facturación para repuestos",
        provider: { "@type": "Organization", name: NOMBRE_SITIO, url: URL_SITIO },
        areaServed: [area, ...d.ciudades.map((c) => ({ "@type": "City", name: c, containedInPlace: area }))],
        url,
      },
      esquemaPreguntas(preguntas),
    ],
  };

  return (
    <div className="wp-cabina min-h-dvh">
      <JsonLd datos={esquema} />
      <EncabezadoPublico />
      <main>
        <Seccion
          nivel={1}
          sobretitulo={`${d.iso} · Cabecera: ${d.cabecera}`}
          titulo={
            <>
              Repuestos en
              <br />
              {d.nombre}
              <span className="text-wp-accent">.</span>
            </>
          }
          migas={<Migas items={[{ nombre: "Inicio", href: "/" }, { nombre: "Honduras", href: "/honduras" }, { nombre: d.nombre }]} />}
          bajada={
            <>
              <strong>
                Wake Parts es el sistema de inventario, cotizaciones y facturación con CAI para tiendas de repuestos,
                yonkers y talleres de {d.nombre}.
              </strong>{" "}
              {d.contexto}
            </>
          }
        >
          <div className={styles.dosColumnas}>
            <div>
              <h2 className={styles.sobretitulo}>Dónde se usa en {d.nombre}</h2>
              <ul className={styles.ciudades}>
                {d.ciudades.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              <p className={styles.seccionBajada}>
                En {d.cabecera} y el resto de {d.nombre}, Wake Parts corre en el navegador: el mostrador de la tienda, la
                oficina y el celular del dueño ven el mismo inventario al instante.
              </p>
            </div>
            <DemoBusqueda />
          </div>
        </Seccion>

        <Seccion
          tono="panel"
          sobretitulo="Funciones"
          titulo={
            <>
              Lo que hace por
              <br />
              tu negocio<span className="text-wp-accent">.</span>
            </>
          }
        >
          <Funciones cantidad={6} />
        </Seccion>

        <Seccion
          sobretitulo={`Facturación con CAI en ${d.nombre}`}
          titulo={
            <>
              Tu CAI,
              <br />
              en orden<span className="text-wp-accent">.</span>
            </>
          }
          bajada={`Negocios de ${d.cabecera} y todo ${d.nombre} registran su CAI del SAR y facturan con numeración correlativa, RTN del cliente e ISV 15 %.`}
        >
          <BloqueCai lugar={d.cabecera} />
        </Seccion>

        <Seccion
          tono="panel"
          sobretitulo="Preguntas frecuentes"
          titulo={
            <>
              Preguntas desde
              <br />
              {d.nombre}
              <span className="text-wp-accent">.</span>
            </>
          }
        >
          <PreguntasFrecuentes preguntas={preguntas} />
        </Seccion>

        <Seccion
          sobretitulo="Otros departamentos"
          titulo={
            <>
              También en el
              <br />
              resto del país<span className="text-wp-accent">.</span>
            </>
          }
        >
          <GridDepartamentos excluir={d.slug} />
        </Seccion>

        <LlamadoFinal texto={`Encendé tu tablero en ${d.nombre}.`} />
      </main>
      <PiePublico />
    </div>
  );
}
