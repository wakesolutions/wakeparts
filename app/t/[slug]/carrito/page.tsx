import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { leerSitio } from "@/lib/sitio-datos";
import { PaginaCarrito } from "../_componentes/interactivo";
import { metadatosSitio } from "../_componentes/piezas";
import styles from "../_componentes/sitio.module.css";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const sitio = await leerSitio((await params).slug);
  if (!sitio) return {};
  return { ...metadatosSitio(sitio, { titulo: "Tu lista", ruta: "/carrito" }), robots: { index: false, follow: false } };
}

/** Tu lista de piezas → pedido web (llega a Ventas › Pedidos web del taller). */
export default async function Carrito({ params }: Props) {
  const { slug } = await params;
  const sitio = await leerSitio(slug);
  if (!sitio) notFound();
  return (
    <div className={styles.contenedor}>
      <PaginaCarrito slug={slug} nombreTaller={sitio.nombre} whatsapp={sitio.config.whatsapp} />
    </div>
  );
}
