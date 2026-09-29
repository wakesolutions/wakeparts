import type { Metadata } from "next";
import Link from "next/link";
import {
  BloqueCai,
  DemoBusqueda,
  EncabezadoPublico,
  Funciones,
  GridDepartamentos,
  JsonLd,
  LlamadoFinal,
  PREGUNTAS,
  PiePublico,
  PreguntasFrecuentes,
  Seccion,
  esquemaPreguntas,
  FUNCIONES,
} from "./_publico/piezas";
import styles from "./_publico/publico.module.css";
import { CAPTURAS } from "./_publico/capturas";
import { Vitrina } from "./_publico/vitrina";
import { Arranque } from "./_components/arranque";
import { DEPARTAMENTOS, DESCRIPCION_SITIO, LEMA, NOMBRE_SITIO, URL_SITIO } from "@/lib/sitio";

const ERRORES: Record<string, string> = {
  auth: "No pudimos completar el inicio de sesión. Intentá de nuevo.",
  oauth: "Google no respondió. Revisá tu conexión e intentá otra vez.",
};

export const metadata: Metadata = {
  // La portada usa el título completo (sin la plantilla «%s · Wake Parts»).
  title: { absolute: `Sistema de facturación con CAI e inventario para repuestos en Honduras · ${NOMBRE_SITIO}` },
  description: DESCRIPCION_SITIO,
  alternates: { canonical: "/" },
};

const ESQUEMA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${URL_SITIO}/#organizacion`,
      name: NOMBRE_SITIO,
      url: URL_SITIO,
      logo: `${URL_SITIO}/icono-512.png`,
      areaServed: { "@type": "Country", name: "Honduras" },
    },
    {
      "@type": "WebSite",
      "@id": `${URL_SITIO}/#sitio`,
      url: URL_SITIO,
      name: NOMBRE_SITIO,
      description: LEMA,
      inLanguage: "es-HN",
      publisher: { "@id": `${URL_SITIO}/#organizacion` },
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${URL_SITIO}/#aplicacion`,
      name: NOMBRE_SITIO,
      url: URL_SITIO,
      description: DESCRIPCION_SITIO,
      applicationCategory: "BusinessApplication",
      applicationSubCategory: "Inventario y facturación para repuestos",
      operatingSystem: "Web, Windows, macOS, Android, iOS",
      inLanguage: "es-HN",
      image: `${URL_SITIO}/opengraph-image`,
      publisher: { "@id": `${URL_SITIO}/#organizacion` },
      featureList: FUNCIONES.map((f) => f.titulo),
      screenshot: CAPTURAS.map((c) => ({
        "@type": "ImageObject",
        url: `${URL_SITIO}${c.src}`,
        caption: c.alt,
        width: c.ancho,
        height: c.alto,
      })),
      areaServed: [
        { "@type": "Country", name: "Honduras" },
        ...DEPARTAMENTOS.map((d) => ({ "@type": "AdministrativeArea", name: d.nombre, containedInPlace: { "@type": "Country", name: "Honduras" } })),
      ],
    },
    esquemaPreguntas(PREGUNTAS),
  ],
};

export default async function Portada({ searchParams }: PageProps<"/">) {
  const { error } = await searchParams;
  const mensaje = typeof error === "string" ? ERRORES[error] : undefined;

  return (
    <div className="wp-cabina min-h-dvh">
      <JsonLd datos={ESQUEMA} />
      <EncabezadoPublico />

      <main>
        <div className="mx-auto grid max-w-[1440px] grid-cols-1 items-center gap-10 px-4 py-10 sm:px-8 lg:min-h-[calc(100dvh-52px)] lg:grid-cols-12 lg:gap-0 lg:px-14">
          <section className="lg:col-span-7">
            <p
              className="wp-entra mb-6 font-mono text-[0.7rem] tracking-[0.3em] text-wp-ink-3 uppercase"
              style={{ animationDelay: "100ms" }}
            >
              ERP · Repuestos &amp; Yonkers · Honduras
            </p>

            <h1>
              <span
                className="wp-grabado block text-[clamp(5.5rem,17vw,15.5rem)] leading-[0.8] font-extrabold tracking-[-0.035em] uppercase"
                style={{ fontVariationSettings: '"wdth" 58' }}
              >
                <span className="wp-linea">
                  <span style={{ animationDelay: "220ms" }}>Wake</span>
                </span>
                <span className="wp-linea">
                  <span style={{ animationDelay: "320ms" }}>
                    Parts<span className="text-wp-accent">.</span>
                  </span>
                </span>
              </span>
              <span
                className="wp-entra mt-8 block max-w-[30ch] text-2xl leading-tight font-bold text-balance sm:text-3xl"
                style={{ animationDelay: "480ms", fontVariationSettings: '"wdth" 80' }}
              >
                Inventario y facturación con CAI para repuestos en Honduras
              </span>
            </h1>

            <p
              className="wp-entra mt-5 max-w-[46ch] text-lg leading-relaxed text-wp-ink-2 text-pretty"
              style={{ animationDelay: "580ms" }}
            >
              Buscá la pieza exacta por vehículo, cotizá en segundos y facturá con tu CAI del SAR. Para tiendas de
              repuestos, yonkers y talleres, en la compu o en el celular.
            </p>

            <dl
              className="wp-entra mt-10 hidden flex-wrap gap-x-10 gap-y-4 font-mono text-[0.7rem] tracking-[0.2em] uppercase sm:flex"
              style={{ animationDelay: "720ms" }}
            >
              {[
                ["Inventario", "Piezas por vehículo"],
                ["Facturación", "CAI · SAR"],
                ["Cobertura", "18 departamentos"],
              ].map(([t, d]) => (
                <div key={t}>
                  <dt className="text-wp-accent">{t}</dt>
                  <dd className="mt-1 text-wp-ink-3">{d}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section id="encender" aria-label="Entrar" className="flex scroll-mt-20 flex-col items-center lg:col-span-5 lg:-ml-10">
            <Arranque error={mensaje} />
            <p className="wp-entra mt-8 text-sm text-wp-ink-3" style={{ animationDelay: "1300ms" }}>
              El acceso es solo con tu cuenta de Google.
            </p>
            <Link
              href="/ayuda"
              className="wp-entra mt-3 font-mono text-[0.68rem] tracking-[0.2em] text-wp-ink-3 uppercase underline decoration-wp-accent/60 underline-offset-4 transition-colors hover:text-wp-ink"
              style={{ animationDelay: "1400ms" }}
            >
              Leé el manual del propietario
            </Link>
          </section>
        </div>

        <Seccion
          id="por-dentro"
          sobretitulo="Capturas reales · datos de ejemplo"
          titulo={
            <>
              Así se ve
              <br />
              por dentro<span className="text-wp-accent">.</span>
            </>
          }
          bajada="Esto es lo que vas a usar desde el primer día: el mostrador, la factura con CAI, el reporte de ventas, la compatibilidad por vehículo y la vista en el celular."
        >
          <Vitrina />
        </Seccion>

        <Seccion
          id="funciones"
          sobretitulo="Funciones"
          titulo={
            <>
              Todo el mostrador
              <br />
              en un tablero<span className="text-wp-accent">.</span>
            </>
          }
          bajada="Hecho para cómo se venden repuestos en Honduras: el cliente llega con el carro, el vendedor busca, cotiza y factura. Sin cuadernos ni hojas sueltas."
        >
          <Funciones />
        </Seccion>

        <Seccion
          id="por-vehiculo"
          tono="panel"
          sobretitulo="Búsqueda por vehículo"
          titulo={
            <>
              La pieza exacta,
              <br />
              no la parecida<span className="text-wp-accent">.</span>
            </>
          }
        >
          <div className={styles.dosColumnas}>
            <ul className={styles.lista}>
              <li>
                <strong>Elegí el vehículo del cliente</strong>
                Marca, modelo, año y motor de un catálogo con miles de versiones. Escribís «hilux 2010» y listo.
              </li>
              <li>
                <strong>Lo que le queda, primero</strong>
                Arriba lo que calza con ese motor o ese año; en ámbar lo que hay que verificar; aparte los productos
                generales como aceites y líquidos.
              </li>
              <li>
                <strong>Habla como el mostrador</strong>
                Busca por nombre, código, OEM o equivalencia, con o sin guiones, y entiende «balatas», «candelas» o
                «fricciones». Hasta perdona errores de dedo.
              </li>
              <li>
                <strong>Vende el complemento</strong>
                Si lleva aceite, te sugiere el filtro. Si lleva pastillas, el líquido de frenos.
              </li>
            </ul>
            <DemoBusqueda />
          </div>
        </Seccion>

        <Seccion
          id="facturacion-cai"
          sobretitulo="Facturación con CAI del SAR"
          titulo={
            <>
              Facturas con CAI,
              <br />
              sin saltos<span className="text-wp-accent">.</span>
            </>
          }
          bajada="Registrás el CAI que te autorizó el SAR y Wake Parts lleva la numeración: correlativa, dentro del rango y antes de la fecha límite. Cotizaciones y facturas salen listas para imprimir o guardar en PDF."
        >
          <BloqueCai />
        </Seccion>

        <Seccion
          id="departamentos"
          tono="panel"
          sobretitulo="Cobertura nacional"
          titulo={
            <>
              De Ocotepeque
              <br />a La Mosquitia<span className="text-wp-accent">.</span>
            </>
          }
          bajada="Wake Parts funciona en línea en los 18 departamentos de Honduras. Mirá cómo le sirve a los negocios de repuestos de tu zona."
        >
          <GridDepartamentos />
        </Seccion>

        <Seccion
          id="preguntas"
          sobretitulo="Preguntas frecuentes"
          titulo={
            <>
              Lo que siempre
              <br />
              nos preguntan<span className="text-wp-accent">.</span>
            </>
          }
        >
          <PreguntasFrecuentes preguntas={PREGUNTAS} />
        </Seccion>

        <LlamadoFinal />
      </main>

      <PiePublico />
    </div>
  );
}
