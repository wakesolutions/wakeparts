import Link from "next/link";
import type { ReactNode } from "react";
import { IconoBuscar } from "@/components/ui/iconos";
import { CONTACTO, DEPARTAMENTOS, jsonLd, type Departamento } from "@/lib/sitio";
import styles from "./publico.module.css";

/** <script type="application/ld+json"> seguro. */
export function JsonLd({ datos }: { datos: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(datos) }} />;
}

export function EncabezadoPublico() {
  return (
    <header className={`wp-metal ${styles.encabezado}`}>
      <Link href="/" className={styles.marca} aria-label="Wake Parts, inicio">
        Wake<span className="text-wp-accent">Parts</span>
      </Link>
      <nav aria-label="Principal" className={styles.nav}>
        <Link href="/#funciones">Funciones</Link>
        <Link href="/#facturacion-cai">Facturación CAI</Link>
        <Link href="/honduras">Departamentos</Link>
        <Link href="/ayuda">Manual</Link>
        <Link href="/#contacto">Contacto</Link>
      </nav>
      <Link href="/#encender" className={styles.entrar}>
        Entrar
      </Link>
    </header>
  );
}

export function PiePublico() {
  return (
    <footer className={styles.pie}>
      <div className={styles.pieMarca}>
        <p className={styles.marca}>
          Wake<span className="text-wp-accent">Parts</span>
        </p>
        <p>Inventario, cotizaciones y facturación con CAI para repuestos, yonkers y talleres de Honduras.</p>
        <p className={styles.pieLegal}>
          Wake Parts no es una entidad del SAR. Confirmá con tu contador los requisitos fiscales de tu negocio.
        </p>
        <p className={styles.pieContacto}>
          <a href={CONTACTO.whatsappUrl} target="_blank" rel="noopener noreferrer">
            WhatsApp {CONTACTO.whatsapp}
          </a>
          <a href={CONTACTO.emailUrl}>{CONTACTO.email}</a>
        </p>
      </div>
      <nav aria-label="Departamentos" className={styles.pieDepartamentos}>
        <p className={styles.pieTitulo}>En toda Honduras</p>
        <ul>
          {DEPARTAMENTOS.map((d) => (
            <li key={d.slug}>
              <Link href={`/honduras/${d.slug}`}>{d.nombre}</Link>
            </li>
          ))}
        </ul>
      </nav>
      <nav aria-label="Recursos" className={styles.pieRecursos}>
        <p className={styles.pieTitulo}>Recursos</p>
        <ul>
          <li>
            <Link href="/ayuda">Manual del propietario</Link>
          </li>
          <li>
            <Link href="/honduras">Departamentos</Link>
          </li>
          <li>
            <Link href="/#preguntas">Preguntas frecuentes</Link>
          </li>
          <li>
            <Link href="/#encender">Entrar con Google</Link>
          </li>
        </ul>
        <p className={`${styles.pieTitulo} mt-5`}>Legal</p>
        <ul>
          <li>
            <Link href="/terminos">Términos de uso</Link>
          </li>
          <li>
            <Link href="/privacidad">Política de privacidad</Link>
          </li>
          <li>
            <Link href="/cookies">Política de cookies</Link>
          </li>
        </ul>
      </nav>
      <p className={styles.pieFirma}>Hecho en Honduras · {new Date().getFullYear()}</p>
    </footer>
  );
}

// ------------------------------------------------------------- secciones ---

export function Seccion({
  id,
  sobretitulo,
  titulo,
  bajada,
  children,
  tono,
  migas,
  nivel = 2,
}: {
  /** 1 = título principal de la página (un solo h1 por página). */
  nivel?: 1 | 2;
  id?: string;
  /** Ruta de navegación (Migas) sobre el sobretítulo. */
  migas?: ReactNode;
  sobretitulo: string;
  titulo: ReactNode;
  bajada?: ReactNode;
  children: ReactNode;
  tono?: "panel";
}) {
  return (
    <section id={id} className={styles.seccion} data-tono={tono} aria-labelledby={id ? `${id}-titulo` : undefined}>
      <div className={styles.seccionCabecera}>
        {migas}
        <p className={styles.sobretitulo}>{sobretitulo}</p>
        {nivel === 1 ? (
          <h1 className={`wp-grabado ${styles.seccionTitulo}`}>{titulo}</h1>
        ) : (
          <h2 id={id ? `${id}-titulo` : undefined} className={`wp-grabado ${styles.seccionTitulo}`}>
            {titulo}
          </h2>
        )}
        {bajada && <p className={styles.seccionBajada}>{bajada}</p>}
      </div>
      {children}
    </section>
  );
}

export const FUNCIONES = [
  {
    titulo: "Búsqueda por vehículo",
    texto:
      "Marca, modelo, año y motor. Primero lo que le queda a ese carro, después lo que hay que verificar y los productos generales. Entiende «balatas», «candelas» y hasta errores como «pastiyas».",
  },
  {
    titulo: "Facturación con CAI",
    texto:
      "Registrás el CAI del SAR y cada factura toma el siguiente número del rango, sin saltos. RTN del cliente o consumidor final, ISV 15 % y total en letras.",
  },
  {
    titulo: "Cotizaciones al instante",
    texto:
      "Un carrito por cliente, descuentos por línea o generales con tope para vendedores, y la cotización se pasa a factura sin volver a digitar.",
  },
  {
    titulo: "Inventario con kardex",
    texto:
      "Existencias con mínimo y alerta, entradas de compra con costo promedio y el historial de cada unidad: quién, cuándo y por qué documento.",
  },
  {
    titulo: "Importá desde Excel",
    texto:
      "Subí tu lista de productos en .xlsx o .csv. Se revisa fila por fila antes de guardar y las categorías se reconocen por nombre.",
  },
  {
    titulo: "Reportes de ventas",
    texto:
      "Ventas por día, lo más vendido, categorías, vendedores y clientes, comparado con el período anterior. Exportable a Excel.",
  },
  {
    titulo: "Hecho para yonkers",
    texto:
      "Piezas nuevas, usadas o reconstruidas con su condición, fotos y los vehículos a los que les quedan. Lo que el cliente pregunta, a la vista.",
  },
  {
    titulo: "Tu equipo, con roles",
    texto:
      "Invitá a tus vendedores con su correo de Google. Dueño, administrador y vendedor, cada uno con lo que le toca. Nadie ve los datos de otra empresa.",
  },
  {
    titulo: "Compu o celular",
    texto:
      "Funciona en el navegador, sin instalar nada. En la compu del mostrador, en la tablet o en el celular cuando andás afuera.",
  },
] as const;

export function Funciones({ cantidad = FUNCIONES.length }: { cantidad?: number }) {
  return (
    <ol className={styles.funciones}>
      {FUNCIONES.slice(0, cantidad).map((f, i) => (
        <li key={f.titulo} className={styles.funcion}>
          <span className={styles.funcionNumero}>{String(i + 1).padStart(2, "0")}</span>
          <h3 className={styles.funcionTitulo}>{f.titulo}</h3>
          <p>{f.texto}</p>
        </li>
      ))}
    </ol>
  );
}

export function BloqueCai({ lugar }: { lugar?: string }) {
  return (
    <div className={styles.cai}>
      <div className={styles.caiVisor} aria-label="Ejemplo de número de factura: 000-001-01-00000158">
        <p className={styles.caiEtiqueta}>Ejemplo de factura {lugar ? `· ${lugar}` : ""}</p>
        <p className={styles.caiNumero}>
          <span>
            000<small>Estab.</small>
          </span>
          <i>-</i>
          <span>
            001<small>Punto</small>
          </span>
          <i>-</i>
          <span>
            01<small>Tipo</small>
          </span>
          <i>-</i>
          <span>
            00000158<small>Correlativo</small>
          </span>
        </p>
        <p className={styles.caiRango}>CAI 35BD6A-0195F4-B34BAA-8B7D13-37F5E8-2D · Rango 000-001-01-00000001 a 00000500</p>
      </div>
      <ul className={styles.caiLista}>
        <li>Numeración correlativa sin saltos, asignada en la base de datos.</li>
        <li>Rango autorizado y fecha límite: no deja facturar fuera de ellos.</li>
        <li>Cliente con RTN o consumidor final; ISV 15 %, exento y total en letras.</li>
        <li>Anular conserva el número y devuelve las existencias.</li>
        <li>Imprimí o guardá en PDF desde el navegador.</li>
      </ul>
    </div>
  );
}

/** Mini mostrador de ejemplo: cómo se ve una búsqueda real. */
export function DemoBusqueda({ vehiculo = "TOYOTA HILUX 2010" }: { vehiculo?: string }) {
  const filas = [
    { tono: "ok", etiqueta: "Motor", nombre: "Filtro de aceite diésel · 2KD-FTV", precio: "L 368.00" },
    { tono: "ok", etiqueta: "Este año", nombre: "Pastillas de freno delanteras · BOSCH", precio: "L 943.00" },
    { tono: "aviso", etiqueta: "Verificar", nombre: "Amortiguador delantero · MONROE", precio: "L 2,472.50" },
    { tono: "", etiqueta: "General", nombre: "Líquido de frenos DOT 4", precio: "L 224.25" },
    { tono: "acento", etiqueta: "Complemento", nombre: "Disco de freno delantero · TRW", precio: "L 1,863.00" },
  ];
  return (
    <figure className={styles.demo} aria-label={`Ejemplo de búsqueda para ${vehiculo}`}>
      <div className={styles.demoPlaca}>
        <span className={styles.demoPlacaBanda}>Vehículo</span>
        <strong>{vehiculo}</strong>
      </div>
      <div className={styles.demoBuscar}>
        <IconoBuscar tamano={15} /> pastiyas hilux
      </div>
      <ul className={styles.demoResultados}>
        {filas.map((f) => (
          <li key={f.nombre}>
            <span className={styles.demoEtiqueta} data-tono={f.tono || undefined}>
              {f.etiqueta}
            </span>
            <span className={styles.demoNombre}>{f.nombre}</span>
            <span className={styles.demoPrecio}>{f.precio}</span>
          </li>
        ))}
      </ul>
      <figcaption className={styles.demoPie}>Precios con ISV · datos de ejemplo</figcaption>
    </figure>
  );
}

export function GridDepartamentos({ excluir }: { excluir?: string }) {
  return (
    <ul className={styles.departamentos}>
      {DEPARTAMENTOS.filter((d) => d.slug !== excluir).map((d) => (
        <li key={d.slug}>
          <Link href={`/honduras/${d.slug}`} className={styles.departamento}>
            <span className={styles.departamentoIso}>{d.iso}</span>
            <span className={styles.departamentoNombre}>{d.nombre}</span>
            <span className={styles.departamentoCabecera}>{d.ciudades.slice(0, 3).join(" · ")}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export type Pregunta = { p: string; r: string };

export const PREGUNTAS: Pregunta[] = [
  {
    p: "¿Wake Parts sirve para facturar con CAI en Honduras?",
    r: "Sí. Registrás el CAI que te autorizó el SAR, con su rango y fecha límite, y cada factura toma el siguiente número del rango sin saltos, con el formato 000-001-01-00000001. Incluye RTN del cliente o consumidor final, ISV 15 % y total en letras. Revisá con tu contador los requisitos de tu régimen.",
  },
  {
    p: "¿Tengo que instalar algo?",
    r: "No. Wake Parts funciona en el navegador de la computadora, la tablet o el celular. Entrás con tu cuenta de Google y listo.",
  },
  {
    p: "¿Sirve para un yonker o solo para tiendas de repuestos?",
    r: "Para los dos, y para talleres. Manejás piezas nuevas, usadas y reconstruidas con su condición, fotos y los vehículos a los que les quedan, además de servicios de mano de obra.",
  },
  {
    p: "¿Puedo pasar mi inventario que tengo en Excel?",
    r: "Sí. Descargás la plantilla o subís tu propio archivo .xlsx o .csv; Wake Parts reconoce las columnas, revisa cada fila antes de guardar y te dice qué corregir.",
  },
  {
    p: "¿Cómo encuentra el repuesto correcto para cada carro?",
    r: "Cada producto se asigna a una marca, modelo, año o motor del catálogo de vehículos. Al elegir el vehículo del cliente, la búsqueda muestra primero lo que le queda y aparte lo que hay que verificar y los productos generales.",
  },
  {
    p: "¿Otras empresas pueden ver mis precios o clientes?",
    r: "No. Cada empresa tiene sus datos separados y la base de datos lo hace cumplir. Dentro de tu empresa, cada persona tiene un rol: dueño, administrador o vendedor.",
  },
  {
    p: "¿Funciona en mi departamento?",
    r: "Sí, en los 18 departamentos de Honduras, desde Ocotepeque hasta Gracias a Dios. Solo necesitás internet.",
  },
  {
    p: "¿Cuánto cuesta Wake Parts?",
    r: `Lo que ves es una demo que podés usar gratis. Para tu negocio, el precio lo definimos juntos según lo que necesités: sucursales, usuarios, ajustes a la medida y acompañamiento. Incluye soporte 24/7. Escribinos al WhatsApp ${CONTACTO.whatsapp} o a ${CONTACTO.email}.`,
  },
  {
    p: "¿Cómo empiezo?",
    r: "Entrá con Google, registrá tu negocio y, si querés practicar, marcá «Cargar productos de ejemplo». Un recorrido guiado te enseña a cotizar y facturar en dos minutos.",
  },
];

export function PreguntasFrecuentes({ preguntas }: { preguntas: Pregunta[] }) {
  return (
    <div className={styles.preguntas}>
      {preguntas.map((q, i) => (
        <details key={q.p} className={styles.pregunta} open={i === 0}>
          <summary>
            <span>{q.p}</span>
            <span className={styles.preguntaIcono} aria-hidden="true" />
          </summary>
          <p>{q.r}</p>
        </details>
      ))}
    </div>
  );
}

export const esquemaPreguntas = (preguntas: Pregunta[]) => ({
  "@type": "FAQPage",
  mainEntity: preguntas.map((q) => ({
    "@type": "Question",
    name: q.p,
    acceptedAnswer: { "@type": "Answer", text: q.r },
  })),
});

export function LlamadoFinal({ texto = "Encendé tu tablero hoy." }: { texto?: string }) {
  return (
    <section className={styles.llamado} aria-labelledby="llamado-titulo">
      <h2 id="llamado-titulo" className={`wp-grabado ${styles.llamadoTitulo}`}>
        {texto}
      </h2>
      <p>Entrá con tu cuenta de Google, registrá tu negocio y practicá con productos de ejemplo.</p>
      <Link href="/#encender" className={styles.llamadoBoton}>
        Empezar ahora
      </Link>
    </section>
  );
}

/** Aclara que el sitio es una demo y da el contacto comercial. Va con id="contacto" (enlace del encabezado). */
export function BloqueDemo() {
  const puntos = [
    {
      titulo: "Precio a tu medida",
      texto:
        "Lo definimos entre nosotros según el tamaño de tu negocio, tus sucursales y lo que necesitás. Sin tarifas de catálogo.",
    },
    {
      titulo: "Soporte 24/7",
      texto: "Si algo se traba un domingo en la noche, hay alguien del otro lado, por WhatsApp o por correo.",
    },
    {
      titulo: "Ajustes para tu negocio",
      texto:
        "Formatos de factura, reportes, campos, flujos o integraciones: lo adaptamos a cómo trabajás vos, no al revés.",
    },
  ];
  return (
    <div className={styles.dosColumnas}>
      <ul className={styles.lista}>
        {puntos.map((p) => (
          <li key={p.titulo}>
            <strong>{p.titulo}</strong>
            {p.texto}
          </li>
        ))}
      </ul>
      <div className={styles.contacto}>
        <p className={styles.contactoEtiqueta}>Hablemos</p>
        <a href={CONTACTO.whatsappUrl} target="_blank" rel="noopener noreferrer" className={styles.contactoCanal}>
          <span>WhatsApp</span>
          <strong>{CONTACTO.whatsapp}</strong>
        </a>
        <a href={CONTACTO.emailUrl} className={styles.contactoCanal}>
          <span>Correo</span>
          <strong>{CONTACTO.email}</strong>
        </a>
        <p className={styles.contactoNota}>
          Contanos qué vendés y cuántos atienden el mostrador; te respondemos con una propuesta.
        </p>
      </div>
    </div>
  );
}

export function Migas({ items }: { items: { nombre: string; href?: string }[] }) {
  return (
    <nav aria-label="Ruta" className={styles.migas}>
      <ol>
        {items.map((it, i) => (
          <li key={it.nombre}>
            {it.href && i < items.length - 1 ? <Link href={it.href}>{it.nombre}</Link> : <span aria-current="page">{it.nombre}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export const preguntasDe = (d: Departamento): Pregunta[] => [
  {
    p: `¿Wake Parts funciona en ${d.ciudades[0]} y el resto de ${d.nombre}?`,
    r: `Sí. Wake Parts funciona en línea en todo ${d.nombre}: ${d.ciudades.slice(0, 5).join(", ")} y los demás municipios. Solo necesitás internet y una cuenta de Google.`,
  },
  {
    p: `¿Puedo facturar con CAI desde ${d.cabecera}?`,
    r: "Sí. Registrás el CAI que te autorizó el SAR y las facturas salen con numeración correlativa, RTN del cliente o consumidor final e ISV 15 %. Confirmá con tu contador los requisitos de tu régimen.",
  },
  {
    p: `Tengo un yonker en ${d.nombre}, ¿me sirve?`,
    r: "Sí. Registrás piezas usadas o reconstruidas con su condición, fotos y los vehículos a los que les quedan, y el cliente encuentra lo que busca por marca, modelo, año o motor.",
  },
  {
    p: "¿Puedo cargar mi inventario desde Excel?",
    r: "Sí. Subís tu archivo .xlsx o .csv, Wake Parts revisa cada fila antes de guardar y te dice qué corregir.",
  },
];

export { DEPARTAMENTOS };
