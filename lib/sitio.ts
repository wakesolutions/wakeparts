// Datos públicos del sitio (SEO, landing y páginas por departamento).

/** URL pública canónica, sin barra final. `NEXT_PUBLIC_SITE_URL` manda; en Vercel, el dominio de producción. */
export const URL_SITIO = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")
).replace(/\/+$/, "");

export const NOMBRE_SITIO = "Wake Parts";

/** Quien ofrece Wake Parts (responsable de los datos en /privacidad y /terminos). */
export const RESPONSABLE = process.env.NEXT_PUBLIC_RESPONSABLE || "Wake Solutions";

const WHATSAPP = process.env.NEXT_PUBLIC_CONTACTO_WHATSAPP || "+504 8901-5974";
const EMAIL = process.env.NEXT_PUBLIC_CONTACTO_EMAIL || "ventas@wake.solutions";

/** Contacto comercial. Se configura en `.env.local`; los defaults son los valores de producción. */
export const CONTACTO = {
  /** Tal como se muestra: «+504 8901-5974». */
  whatsapp: WHATSAPP,
  /** Enlace de chat: solo dígitos, con código de país. */
  whatsappUrl: `https://wa.me/${WHATSAPP.replace(/\D/g, "")}?text=${encodeURIComponent(
    "Hola, vi la demo de Wake Parts y quiero información para mi negocio.",
  )}`,
  email: EMAIL,
  emailUrl: `mailto:${EMAIL}?subject=${encodeURIComponent("Wake Parts para mi negocio")}`,
} as const;

export const LEMA = "Inventario, facturación con CAI y catálogo para repuestos y yonkers en Honduras";

export const DESCRIPCION_SITIO =
  "Sistema en línea para tiendas de repuestos, yonkers y talleres de Honduras: inventario por vehículo, cotizaciones, facturación con CAI del SAR, reportes de ventas e importación desde Excel. Funciona en la compu y en el celular, en los 18 departamentos.";

export const PALABRAS_CLAVE = [
  "sistema de facturación Honduras",
  "facturación con CAI",
  "facturación SAR Honduras",
  "software para repuestos",
  "sistema para venta de repuestos",
  "inventario de repuestos",
  "sistema para yonker",
  "yonker Honduras",
  "punto de venta Honduras",
  "ERP Honduras",
  "sistema de inventario Honduras",
  "repuestos Tegucigalpa",
  "repuestos San Pedro Sula",
  "catálogo de repuestos por vehículo",
  "cotizaciones para taller",
  "facturación electrónica Honduras",
];

export type Departamento = {
  slug: string;
  nombre: string;
  /** ISO 3166-2 (geo.region). */
  iso: string;
  cabecera: string;
  ciudades: string[];
  /** Párrafo propio del departamento: evita páginas duplicadas y habla de su realidad. */
  contexto: string;
};

export const DEPARTAMENTOS: readonly Departamento[] = [
  {
    slug: "atlantida",
    nombre: "Atlántida",
    iso: "HN-AT",
    cabecera: "La Ceiba",
    ciudades: ["La Ceiba", "Tela", "El Porvenir", "Jutiapa", "La Masica", "Esparta", "Arizona", "San Francisco"],
    contexto:
      "En el litoral atlántico, entre La Ceiba y Tela, el calor, la humedad y la salinidad castigan frenos, suspensión y sistemas eléctricos. Un mostrador que encuentra rápido la pieza exacta para cada carro vende más y devuelve menos.",
  },
  {
    slug: "choluteca",
    nombre: "Choluteca",
    iso: "HN-CH",
    cabecera: "Choluteca",
    ciudades: ["Choluteca", "San Marcos de Colón", "Pespire", "El Triunfo", "Marcovia", "Namasigüe", "Duyure"],
    contexto:
      "En el sur, con carreteras que llevan a las fronteras con Nicaragua y El Salvador, pasan muchos pickups, camiones y buses. Tener el inventario ordenado por marca, modelo, año y motor evita vender la pieza equivocada con prisa.",
  },
  {
    slug: "colon",
    nombre: "Colón",
    iso: "HN-CL",
    cabecera: "Trujillo",
    ciudades: ["Trujillo", "Tocoa", "Sabá", "Bonito Oriental", "Sonaguera", "Limón"],
    contexto:
      "Entre Tocoa y Trujillo, el trabajo agrícola y las distancias largas hacen que un repuesto que falta cueste días de espera. Con alertas de existencia mínima sabés qué pedir antes de quedarte sin nada.",
  },
  {
    slug: "comayagua",
    nombre: "Comayagua",
    iso: "HN-CM",
    cabecera: "Comayagua",
    ciudades: ["Comayagua", "Siguatepeque", "La Libertad", "Villa de San Antonio", "Taulabé", "Ajuterique", "Lamaní"],
    contexto:
      "A mitad del corredor entre Tegucigalpa y San Pedro Sula, Comayagua y Siguatepeque atienden carros de paso que necesitan la pieza hoy. La búsqueda por vehículo y los atajos de teclado hacen que la cotización salga en segundos.",
  },
  {
    slug: "copan",
    nombre: "Copán",
    iso: "HN-CP",
    cabecera: "Santa Rosa de Copán",
    ciudades: ["Santa Rosa de Copán", "Copán Ruinas", "La Entrada", "Florida", "Santa Rita", "Corquín"],
    contexto:
      "Desde Santa Rosa hasta La Entrada y la frontera con Guatemala, las tiendas de repuestos y los yonkers del occidente atienden desde turismos hasta pickups de finca. Fotos y condición de cada pieza usada ayudan a vender con confianza.",
  },
  {
    slug: "cortes",
    nombre: "Cortés",
    iso: "HN-CR",
    cabecera: "San Pedro Sula",
    ciudades: ["San Pedro Sula", "Puerto Cortés", "Choloma", "Villanueva", "La Lima", "Omoa", "Potrerillos", "Pimienta"],
    contexto:
      "San Pedro Sula es el corazón comercial e industrial del país y Puerto Cortés su principal puerto: aquí se mueve un volumen enorme de repuestos, distribuidoras y yonkers. Varios carritos abiertos a la vez y facturas con CAI en segundos son la diferencia en un mostrador lleno.",
  },
  {
    slug: "el-paraiso",
    nombre: "El Paraíso",
    iso: "HN-EP",
    cabecera: "Yuscarán",
    ciudades: ["Danlí", "Yuscarán", "El Paraíso", "Trojes", "Teupasenti", "Morocelí"],
    contexto:
      "Danlí y los municipios cercanos a Las Manos viven del comercio y del campo, con mucho pickup y moto. Un catálogo que entiende cómo se dice en mostrador («balatas», «candelas») hace que cualquier vendedor encuentre la pieza.",
  },
  {
    slug: "francisco-morazan",
    nombre: "Francisco Morazán",
    iso: "HN-FM",
    cabecera: "Tegucigalpa",
    ciudades: ["Tegucigalpa", "Comayagüela", "Valle de Ángeles", "Santa Lucía", "Talanga", "Guaimaca", "Ojojona", "Sabanagrande"],
    contexto:
      "En la capital, entre Tegucigalpa y Comayagüela, la competencia entre tiendas de repuestos es fuerte y el cliente compara precios. Cotizar al instante, con el total con ISV a la vista, y convertir la cotización en factura sin volver a digitar, cierra más ventas.",
  },
  {
    slug: "gracias-a-dios",
    nombre: "Gracias a Dios",
    iso: "HN-GD",
    cabecera: "Puerto Lempira",
    ciudades: ["Puerto Lempira", "Brus Laguna", "Ahuas", "Wampusirpi", "Villeda Morales", "Juan Francisco Bulnes"],
    contexto:
      "En La Mosquitia, donde muchos repuestos llegan por mar o por aire, cada pieza cuenta. Saber exactamente qué hay, qué se vendió y qué falta evita pedidos de emergencia que salen caros.",
  },
  {
    slug: "intibuca",
    nombre: "Intibucá",
    iso: "HN-IN",
    cabecera: "La Esperanza",
    ciudades: ["La Esperanza", "Intibucá", "Jesús de Otoro", "Yamaranguila", "Camasca"],
    contexto:
      "En La Esperanza e Intibucá, entre montañas y caminos exigentes, los frenos y la suspensión se gastan rápido. Tener cada repuesto asignado a los vehículos que le quedan acelera la venta y reduce devoluciones.",
  },
  {
    slug: "islas-de-la-bahia",
    nombre: "Islas de la Bahía",
    iso: "HN-IB",
    cabecera: "Roatán",
    ciudades: ["Roatán", "Coxen Hole", "French Harbour", "Utila", "Guanaja", "Oak Ridge"],
    contexto:
      "En Roatán, Utila y Guanaja los repuestos llegan en ferry o barco y el aire salino desgasta todo. Controlar existencias y costos de cada compra, con el costo promedio calculado solo, protege el margen.",
  },
  {
    slug: "la-paz",
    nombre: "La Paz",
    iso: "HN-LP",
    cabecera: "La Paz",
    ciudades: ["La Paz", "Marcala", "Santiago de Puringla", "Cane", "San Pedro de Tutule"],
    contexto:
      "Entre La Paz y Marcala, zona cafetalera, los pickups de trabajo son el pan de cada día. Un sistema simple, en español y que funciona en el celular, deja que el negocio facture sin depender de una computadora.",
  },
  {
    slug: "lempira",
    nombre: "Lempira",
    iso: "HN-LE",
    cabecera: "Gracias",
    ciudades: ["Gracias", "Erandique", "Lepaera", "San Rafael", "La Campa", "Candelaria"],
    contexto:
      "Desde Gracias, ciudad colonial, hasta los municipios de montaña, los talleres y tiendas atienden vehículos que trabajan duro. Cotizaciones claras y facturas con CAI dan confianza a clientes y empresas.",
  },
  {
    slug: "ocotepeque",
    nombre: "Ocotepeque",
    iso: "HN-OC",
    cabecera: "Nueva Ocotepeque",
    ciudades: ["Nueva Ocotepeque", "San Marcos", "Sinuapa", "Santa Fe", "Sensenti"],
    contexto:
      "Ocotepeque, frontera con Guatemala y El Salvador, tiene comercio de paso y transporte de carga. Buscar por código OEM o equivalencia, con o sin guiones, permite atender a transportistas que llegan con el número de parte en la mano.",
  },
  {
    slug: "olancho",
    nombre: "Olancho",
    iso: "HN-OL",
    cabecera: "Juticalpa",
    ciudades: ["Juticalpa", "Catacamas", "Campamento", "San Esteban", "Salamá", "Guata"],
    contexto:
      "Olancho es el departamento más grande del país y en Juticalpa y Catacamas manda el pickup de campo. Un inventario que avisa cuando algo baja del mínimo evita perder la venta por no tener la pieza.",
  },
  {
    slug: "santa-barbara",
    nombre: "Santa Bárbara",
    iso: "HN-SB",
    cabecera: "Santa Bárbara",
    ciudades: ["Santa Bárbara", "Quimistán", "Trinidad", "Macuelizo", "San Nicolás", "Las Vegas"],
    contexto:
      "Entre Santa Bárbara, Quimistán y Trinidad, los negocios de repuestos atienden a toda una región rural. Importar el inventario desde Excel en minutos deja listo el mostrador sin digitar pieza por pieza.",
  },
  {
    slug: "valle",
    nombre: "Valle",
    iso: "HN-VA",
    cabecera: "Nacaome",
    ciudades: ["Nacaome", "San Lorenzo", "Amapala", "Goascorán", "Langue"],
    contexto:
      "Con San Lorenzo como puerto del Pacífico y El Amatillo como paso hacia El Salvador, Valle mueve carga y transporte. Reportes de ventas por día, producto y vendedor ayudan a saber qué se mueve y qué no.",
  },
  {
    slug: "yoro",
    nombre: "Yoro",
    iso: "HN-YO",
    cabecera: "Yoro",
    ciudades: ["El Progreso", "Yoro", "Olanchito", "Santa Rita", "Morazán", "El Negrito"],
    contexto:
      "El Progreso, a un paso de San Pedro Sula, y Olanchito concentran mucho comercio de repuestos. Varios vendedores trabajando a la vez, cada uno con su tope de descuento, mantienen el control sin frenar el mostrador.",
  },
];

export function departamentoPorSlug(slug: string) {
  return DEPARTAMENTOS.find((d) => d.slug === slug);
}

export const urlAbsoluta = (ruta: string) => `${URL_SITIO}${ruta.startsWith("/") ? ruta : `/${ruta}`}`;

/** JSON-LD seguro para <script> (sin cierre de etiquetas). */
export const jsonLd = (dato: unknown) => JSON.stringify(dato).replace(/</g, "\\u003c");
