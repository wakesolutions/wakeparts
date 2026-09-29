import Link from "next/link";
import type { ReactNode } from "react";
import { EncabezadoPublico, JsonLd, Migas, PiePublico, Seccion } from "./piezas";
import styles from "./publico.module.css";
import { CONTACTO, NOMBRE_SITIO, URL_SITIO } from "@/lib/sitio";

/** Fecha de la última revisión de los textos legales (ISO). */
export const LEGAL_ACTUALIZADO = "2026-09-29";
const LEGAL_ACTUALIZADO_TEXTO = "29 de septiembre de 2026";

export const PAGINAS_LEGALES = [
  { ruta: "/terminos", nombre: "Términos de uso" },
  { ruta: "/privacidad", nombre: "Política de privacidad" },
  { ruta: "/cookies", nombre: "Política de cookies" },
] as const;

type RutaLegal = (typeof PAGINAS_LEGALES)[number]["ruta"];

/** Marco común de /terminos, /privacidad y /cookies: encabezado, h1, resumen, cuerpo, enlaces cruzados y contacto. */
export function PaginaLegal({
  ruta,
  titulo,
  resumen,
  children,
}: {
  ruta: RutaLegal;
  /** Título grande (h1), con saltos de línea si hace falta. */
  titulo: ReactNode;
  resumen: ReactNode;
  children: ReactNode;
}) {
  const nombre = PAGINAS_LEGALES.find((p) => p.ruta === ruta)!.nombre;
  return (
    <div className="wp-cabina min-h-dvh">
      <JsonLd
        datos={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: nombre,
          url: `${URL_SITIO}${ruta}`,
          inLanguage: "es-HN",
          dateModified: LEGAL_ACTUALIZADO,
          publisher: {
            "@type": "Organization",
            name: NOMBRE_SITIO,
            url: URL_SITIO,
          },
        }}
      />
      <EncabezadoPublico />
      <main>
        <Seccion
          nivel={1}
          migas={<Migas items={[{ nombre: "Inicio", href: "/" }, { nombre }]} />}
          sobretitulo={`Actualizada el ${LEGAL_ACTUALIZADO_TEXTO}`}
          titulo={titulo}
          bajada={
            <>
              <strong>Resumen:</strong> {resumen}
            </>
          }
        >
          <div className={styles.legal}>
            {children}

            <h2 className={styles.legalTitulo}>Contacto</h2>
            <p>
              Para cualquier consulta sobre este documento escribinos a{" "}
              <a href={`mailto:${CONTACTO.email}`}>
                <strong>{CONTACTO.email}</strong>
              </a>{" "}
              o al WhatsApp{" "}
              <a href={CONTACTO.whatsappUrl} target="_blank" rel="noopener noreferrer">
                <strong>{CONTACTO.whatsapp}</strong>
              </a>
              .
            </p>

            <nav aria-label="Documentos legales" className={styles.legalOtros}>
              {PAGINAS_LEGALES.filter((p) => p.ruta !== ruta).map((p) => (
                <Link key={p.ruta} href={p.ruta}>
                  {p.nombre} ›
                </Link>
              ))}
            </nav>
          </div>
        </Seccion>
      </main>
      <PiePublico />
    </div>
  );
}
