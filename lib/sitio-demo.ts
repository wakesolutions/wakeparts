import type { FichaProducto, FiltrosCatalogo, Portada } from "./sitio-datos";
import { SITIO_POR_DEFECTO, type ProductoWeb, type SitioPublico } from "./sitio-web";

/**
 * Sitio de demostración para /t/demo (solo en desarrollo): revisar la UI del
 * catálogo público sin base de datos. Imita lo que devuelven las RPC de 0013.
 */

export const SITIO_DEMO: SitioPublico = {
  id: "demo",
  slug: "demo",
  nombre: "Yonker El Pistón",
  razonSocial: "El Pistón S. de R.L.",
  telefono: "2556-1234",
  correo: "ventas@elpiston.hn",
  direccion: "Barrio Guamilito, 6 calle, 8 avenida NO, San Pedro Sula",
  paleta: "rojo-negro",
  acento: null,
  logo: null,
  fondo: null,
  atenuar: 40,
  // Se muestra como publicado (sin el aviso de vista previa) para revisar y fotografiar el sitio.
  publicado: true,
  esMiembro: false,
  config: {
    ...SITIO_POR_DEFECTO,
    whatsapp: "98765432",
    horario: "Lun–Vie 7:30–17:30 · Sáb 7:30–12:00",
    inicioTitulo: "La pieza exacta para tu carro",
    inicioBajada:
      "Repuestos nuevos y usados para japoneses y americanos. Decinos qué carro tenés y te mostramos lo que le queda.",
    nosotrosTitulo: "Tres generaciones entre motores",
    nosotrosTexto:
      "Don Rigoberto abrió El Pistón en 1998 con un camión y diez motores de Corolla. Hoy somos el yonker de confianza de los talleres de San Pedro Sula.\n\nCada pieza usada se prueba antes de salir y la nueva viene con garantía del fabricante. Si no la tenemos, te la conseguimos.",
    nosotrosDesde: "1998",
    nosotrosPuntos: "Piezas probadas antes de venderlas\nGarantía de 30 días en eléctricos\nEnvíos a todo Honduras\nAsesoría de mecánicos con experiencia",
  },
};

type Demo = ProductoWeb & { vehiculos: string[]; idCategoria: number; descripcion: string };

const CATEGORIAS: Record<number, string> = {
  1: "Suspensión",
  2: "Frenos",
  3: "Lubricantes",
  4: "Filtros",
  5: "Motor",
  6: "Eléctrico",
};

const P = (
  id: number,
  codigo: string,
  nombre: string,
  marca: string,
  idCategoria: number,
  precio: number,
  vehiculos: string[],
  condicion = "nuevo",
): Demo => ({
  id,
  codigo,
  nombre,
  marca,
  categoria: CATEGORIAS[idCategoria],
  idCategoria,
  condicion,
  precio,
  exento: false,
  imagen: null,
  vehiculos,
  descripcion: "",
});

const PRODUCTOS: Demo[] = [
  P(1, "KYB-334082", "Amortiguador delantero", "KYB", 1, 1850, ["TOYOTA HILUX 2005–2015", "TOYOTA FORTUNER 2006–2015"]),
  P(2, "ACT1089", "Pastillas de freno delanteras", "Akebono", 2, 980, ["TOYOTA COROLLA 2009–2013"]),
  P(3, "MOB-5W30", "Aceite sintético 5W-30 · litro", "Mobil", 3, 260, []),
  P(4, "PH4967", "Filtro de aceite", "Fram", 4, 185, ["NISSAN FRONTIER 2005–2019", "NISSAN SENTRA 2007–2012"]),
  P(5, "TRW-JTE451", "Terminal de dirección", "TRW", 1, 640, ["HONDA CIVIC 2006–2011"]),
  P(6, "DEN-234", "Bujía de iridio", "Denso", 5, 310, ["TOYOTA COROLLA 2003–2018", "TOYOTA YARIS 2006–2018"]),
  P(7, "ALT-27060", "Alternador reconstruido", "Denso", 6, 4200, ["TOYOTA HILUX 2.5 L 2005–2015"], "usado"),
  P(8, "BOS-0986", "Disco de freno ventilado", "Bosch", 2, 1350, ["MITSUBISHI L200 2008–2015"]),
  P(9, "CAS-20W50", "Aceite mineral 20W-50 · galón", "Castrol", 3, 780, []),
  P(10, "WIX-46446", "Filtro de aire", "Wix", 4, 420, ["HONDA CR-V 2007–2011"]),
  P(11, "MOT-1KZ", "Motor 1KZ-TE completo", "Toyota", 5, 38500, ["TOYOTA HILUX 3.0 L 1997–2004", "TOYOTA PRADO 1996–2002"], "usado"),
  P(12, "BAT-24F", "Batería 24F 12 V", "LTH", 6, 3100, []),
];

const normal = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function demoPortada(): Portada {
  const cuenta = new Map<number, number>();
  PRODUCTOS.forEach((p) => cuenta.set(p.idCategoria, (cuenta.get(p.idCategoria) ?? 0) + 1));
  return {
    destacados: PRODUCTOS.slice(0, 8),
    categorias: [...cuenta].map(([id, productos]) => ({ id, nombre: CATEGORIAS[id], productos })),
  };
}

export function demoBuscar(f: FiltrosCatalogo): ProductoWeb[] {
  const texto = normal(f.texto ?? "");
  let lista = PRODUCTOS.filter(
    (p) =>
      (!f.categoria || p.idCategoria === f.categoria) &&
      (!texto || normal(`${p.nombre} ${p.codigo} ${p.marca} ${p.categoria}`).includes(texto)),
  );
  if (!f.marca) return lista.map((p) => ({ ...p, grupo: "todos" }));
  // Con vehículo: los primeros «le quedan», uno «puede quedarle», los sin vehículos son generales.
  lista = lista.map((p, i) => ({
    ...p,
    grupo: p.vehiculos.length ? "vehiculo" : "general",
    ajuste: p.vehiculos.length ? (i % 4 === 3 ? "verificar" : f.anio ? "anio" : "modelo") : null,
  }));
  return lista;
}

export function demoProducto(id: number): FichaProducto | null {
  const p = PRODUCTOS.find((x) => x.id === id);
  if (!p) return null;
  return {
    ...p,
    descripcion:
      p.condicion === "usado"
        ? "Pieza usada en buen estado, probada en banco antes de salir. Garantía de 30 días."
        : "Pieza nueva con garantía del fabricante.",
    oem: null,
    numeroParte: p.codigo,
    unidad: "unidad",
    garantiaDias: p.condicion === "usado" ? 30 : 90,
    imagenes: [],
  };
}
