import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buscarCatalogo, leerPortada, leerSitio, type FiltrosCatalogo } from "@/lib/sitio-datos";
import { rutaSitio, type ProductoWeb } from "@/lib/sitio-web";
import { Buscador } from "../_componentes/interactivo";
import { metadatosSitio, TarjetaProducto } from "../_componentes/piezas";
import styles from "../_componentes/sitio.module.css";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const entero = (v: string | string[] | undefined) => {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return Number.isSafeInteger(n) && n > 0 ? n : undefined;
};

function filtrosDe(sp: Record<string, string | string[] | undefined>): FiltrosCatalogo {
  const q = sp.q;
  return {
    texto: (Array.isArray(q) ? q[0] : q)?.slice(0, 120) ?? "",
    marca: entero(sp.marca),
    modelo: entero(sp.modelo),
    anio: entero(sp.anio),
    motor: entero(sp.motor),
    categoria: entero(sp.cat),
  };
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const sitio = await leerSitio((await params).slug);
  if (!sitio) return {};
  const f = filtrosDe(await searchParams);
  const meta = metadatosSitio(sitio, {
    titulo: "Catálogo",
    descripcion: `Buscá repuestos por vehículo en ${sitio.nombre}: lo que le queda a tu carro, con existencia.`,
    ruta: "/catalogo",
  });
  // Las búsquedas filtradas no se indexan (contenido repetido).
  return f.texto || f.marca || f.categoria ? { ...meta, robots: { index: false, follow: true } } : meta;
}

type Bloque = { clave: string; titulo: string; nota?: string; productos: ProductoWeb[] };

/** Mismo orden que el mostrador: le queda › puede quedarle › generales › el resto. */
function agrupar(lista: ProductoWeb[], conVehiculo: boolean): Bloque[] {
  if (!conVehiculo) return [{ clave: "todos", titulo: "", productos: lista.filter((p) => p.grupo !== "complemento") }];
  const bloques: Bloque[] = [
    { clave: "exacto", titulo: "Le queda a tu carro", productos: [] },
    { clave: "verificar", titulo: "Puede quedarle", nota: "Sirve para alguna versión: confirmá año o motor al pedir.", productos: [] },
    { clave: "general", titulo: "Para cualquier vehículo", nota: "Aceites, químicos y accesorios.", productos: [] },
  ];
  for (const p of lista) {
    if (p.grupo === "vehiculo") bloques[p.ajuste === "verificar" ? 1 : 0].productos.push(p);
    else if (p.grupo === "general") bloques[2].productos.push(p);
  }
  return bloques.filter((b) => b.productos.length);
}

export default async function Catalogo({ params, searchParams }: Props) {
  const { slug } = await params;
  const sitio = await leerSitio(slug);
  if (!sitio) notFound();
  const f = filtrosDe(await searchParams);
  const [resultados, portada] = await Promise.all([buscarCatalogo(slug, f), leerPortada(slug)]);
  const bloques = agrupar(resultados, Boolean(f.marca));
  const total = bloques.reduce((s, b) => s + b.productos.length, 0);
  const categoria = portada.categorias.find((c) => c.id === f.categoria);
  const base = rutaSitio(slug, "/catalogo");

  const conservar = (cat?: number) => {
    const p = new URLSearchParams();
    if (f.texto) p.set("q", f.texto);
    for (const [k, v] of [["marca", f.marca], ["modelo", f.modelo], ["anio", f.anio], ["motor", f.motor]] as const) {
      if (v) p.set(k, String(v));
    }
    if (cat) p.set("cat", String(cat));
    return p.size ? `${base}?${p}` : base;
  };

  const titulo = f.texto ? `«${f.texto}»` : (categoria?.nombre ?? "Catálogo");

  return (
    <div className={`${styles.contenedor} ${styles.catalogo}`}>
      <aside className={styles.filtros} aria-label="Filtros">
        <div>
          <p className={styles.filtroTitulo}>Categorías</p>
          <ul className={styles.listaCategorias}>
            <li>
              <Link href={conservar()} aria-current={!f.categoria}>
                Todas
              </Link>
            </li>
            {portada.categorias.map((c) => (
              <li key={c.id}>
                <Link href={conservar(c.id)} aria-current={f.categoria === c.id}>
                  {c.nombre} <small>{c.productos}</small>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <section aria-labelledby="titulo-catalogo">
        <div className={styles.resultadosCabecera}>
          <h1 id="titulo-catalogo" className={styles.catalogoTitulo}>
            {titulo}
          </h1>
          <Buscador
            slug={slug}
            compacto
            texto={f.texto}
            categoria={f.categoria}
            inicial={{ marca: f.marca, modelo: f.modelo, anio: f.anio, motor: f.motor }}
          />
          <p className={styles.resumen} role="status">
            {total === 0 ? "Sin resultados" : `${total} ${total === 1 ? "pieza" : "piezas"}`}
            {f.marca && total > 0 && " para tu vehículo"}
          </p>
        </div>

        {total === 0 ? (
          <div className={styles.vacio}>
            <p className={styles.vacioTitulo}>No la encontramos en línea</p>
            <p>
              No todo está publicado. Probá con menos palabras o sin el vehículo, o escribinos: puede que la tengamos o te
              la consigamos.
            </p>
            <Link href={`${rutaSitio(slug)}#contacto`} className={styles.botonSecundario}>
              Contactar a {sitio.nombre}
            </Link>
          </div>
        ) : (
          bloques.map((b) => (
            <div key={b.clave} className={styles.bloque}>
              {b.titulo && (
                <h2 className={styles.bloqueTitulo}>
                  {b.titulo} {b.nota && <span className={styles.bloqueNota}>{b.nota}</span>}
                </h2>
              )}
              <div className={styles.grilla}>
                {b.productos.map((p) => (
                  <TarjetaProducto key={p.id} slug={slug} producto={p} />
                ))}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
