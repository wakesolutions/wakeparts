import type { Metadata } from "next";
import {
  EncabezadoPublico,
  GridDepartamentos,
  JsonLd,
  LlamadoFinal,
  Migas,
  PiePublico,
  Seccion,
} from "../_publico/piezas";
import { DEPARTAMENTOS, NOMBRE_SITIO, URL_SITIO } from "@/lib/sitio";

export const metadata: Metadata = {
  title: "Sistema para repuestos en los 18 departamentos de Honduras",
  description:
    "Wake Parts funciona en todo Honduras: inventario por vehículo, cotizaciones y facturación con CAI para tiendas de repuestos, yonkers y talleres de Cortés, Francisco Morazán, Atlántida, Olancho y los demás departamentos.",
  alternates: { canonical: "/honduras" },
  openGraph: { url: "/honduras" },
};

const ESQUEMA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: NOMBRE_SITIO, item: `${URL_SITIO}/` },
        { "@type": "ListItem", position: 2, name: "Honduras", item: `${URL_SITIO}/honduras` },
      ],
    },
    {
      "@type": "ItemList",
      name: "Wake Parts por departamento",
      itemListElement: DEPARTAMENTOS.map((d, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: d.nombre,
        url: `${URL_SITIO}/honduras/${d.slug}`,
      })),
    },
  ],
};

export default function Honduras() {
  return (
    <div className="wp-cabina min-h-dvh">
      <JsonLd datos={ESQUEMA} />
      <EncabezadoPublico />
      <main>
        <Seccion
          nivel={1}
          sobretitulo="Honduras · 18 departamentos"
          titulo={
            <>
              Repuestos en
              <br />
              toda Honduras<span className="text-wp-accent">.</span>
            </>
          }
          migas={<Migas items={[{ nombre: "Inicio", href: "/" }, { nombre: "Honduras" }]} />}
          bajada={
            <>
              Desde San Pedro Sula y Tegucigalpa hasta Puerto Lempira y Roatán: Wake Parts es un sistema en línea de
              inventario, cotizaciones y facturación con CAI para tiendas de repuestos, yonkers y talleres. Elegí tu
              departamento.
            </>
          }
        >
          <GridDepartamentos />
        </Seccion>
        <LlamadoFinal />
      </main>
      <PiePublico />
    </div>
  );
}
