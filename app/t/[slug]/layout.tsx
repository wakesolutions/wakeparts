import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";
import { cssAcento } from "@/lib/identidad";
import { leerSitio } from "@/lib/sitio-datos";
import { Encabezado, NavMovil, Pie } from "./_componentes/piezas";
import styles from "./_componentes/sitio.module.css";

/**
 * Sitio público de un taller: /t/<slug>. Se viste con la identidad de la
 * empresa (paleta, color de marca, logo, fondo) en este contenedor, sin tocar
 * <html>. Sin publicar, solo lo ven sus miembros (vista previa).
 */
export default async function LayoutSitio({ children, params }: { children: ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sitio = await leerSitio(slug);
  if (!sitio) notFound();

  return (
    <div
      data-sitio=""
      data-paleta={sitio.paleta}
      className={styles.raiz}
      style={{ colorScheme: sitio.paleta === "rojo-blanco" ? "light" : "dark" } as CSSProperties}
    >
      {sitio.acento && <style>{cssAcento(sitio.acento, "[data-sitio][data-paleta]")}</style>}
      {!sitio.publicado && (
        <p className={styles.previa} role="status">
          Vista previa: tu sitio todavía no está publicado y solo lo ven los de tu taller.{" "}
          <Link href="/inicio">Publicalo desde Sitio web</Link>.
        </p>
      )}
      <Encabezado sitio={sitio} />
      <main className="flex-1">{children}</main>
      <Pie sitio={sitio} />
      <NavMovil sitio={sitio} />
    </div>
  );
}
