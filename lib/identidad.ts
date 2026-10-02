/**
 * Identidad visual de cada empresa (migración 0012): logo, fondo del
 * escritorio, color de marca y formato de facturas y cotizaciones.
 * Compartido entre servidor y cliente: sin dependencias de uno u otro.
 */

// ------------------------------------------------------------------ archivos --

export const BUCKET_EMPRESAS = "empresas";

/** URL pública de un archivo del bucket «empresas» (logo o fondo). */
export function urlArchivoEmpresa(ruta: string | null | undefined): string | null {
  if (!ruta) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET_EMPRESAS}/${ruta}`;
}

export type TipoImagenEmpresa = "logo" | "fondo";

/** Lado mayor al que se reduce cada imagen antes de subirla. */
export const LADO_IMAGEN: Record<TipoImagenEmpresa, number> = { logo: 800, fondo: 2560 };

export const ATENUAR_POR_DEFECTO = 40;

export function atenuarValido(n: unknown): number {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.min(85, Math.max(0, v)) : ATENUAR_POR_DEFECTO;
}

// ------------------------------------------------------------ color de marca --

/** Colores sugeridos. null = el rojo de la paleta (Wake Parts). */
export const ACENTOS: readonly { valor: string | null; nombre: string; muestra: string }[] = [
  { valor: null, nombre: "Rojo Wake Parts", muestra: "#d5121e" },
  { valor: "#e8590c", nombre: "Naranja", muestra: "#e8590c" },
  { valor: "#c98a00", nombre: "Ámbar", muestra: "#c98a00" },
  { valor: "#1f9d55", nombre: "Verde", muestra: "#1f9d55" },
  { valor: "#0e8fa8", nombre: "Turquesa", muestra: "#0e8fa8" },
  { valor: "#1d6fd8", nombre: "Azul", muestra: "#1d6fd8" },
  { valor: "#6d3fd6", nombre: "Morado", muestra: "#6d3fd6" },
  { valor: "#5b6470", nombre: "Grafito", muestra: "#5b6470" },
];

export function acentoValido(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const hex = v.trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(hex) ? hex : null;
}

type Rgb = [number, number, number];

function aRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function aHex([r, g, b]: Rgb) {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;
}

function mezclar(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function rgba([r, g, b]: Rgb, alfa: number) {
  return `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)} / ${alfa})`;
}

/** Luminancia relativa (WCAG), 0–1. */
export function luminancia(hex: string) {
  const [r, g, b] = aRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** ¿El color es tan claro que el texto encima tiene que ser oscuro? */
export function acentoClaro(hex: string) {
  return luminancia(hex) > 0.36;
}

const BLANCO: Rgb = [255, 255, 255];
const NEGRO: Rgb = [0, 0, 0];

/** Todos los tokens de acento derivados de un solo color. */
export function tokensAcento(hex: string): Record<string, string> {
  const c = aRgb(hex);
  return {
    "--wp-accent": hex,
    "--wp-accent-hi": aHex(mezclar(c, BLANCO, 0.18)),
    "--wp-accent-lo": aHex(mezclar(c, NEGRO, 0.45)),
    "--wp-accent-glow": rgba(mezclar(c, BLANCO, 0.15), 0.28),
    "--wp-on-accent": acentoClaro(hex) ? "#1a1514" : "#fff6f2",
    "--wp-bg-glow": rgba(c, 0.07),
    "--wp-sel": rgba(c, 0.16),
    "--wp-stitch": rgba(c, 0.3),
    "--wp-lcd": aHex(mezclar([18, 12, 12], c, 0.1)),
    "--wp-lcd-ink": aHex(mezclar(c, BLANCO, 0.3)),
  };
}

/**
 * Regla CSS con el acento de la empresa. `:root[data-paleta]` pesa más que
 * `[data-paleta="…"]`, así que gana sobre cualquier paleta. El sitio público
 * (/t/<slug>) pasa su propio selector: allí el tema va en un contenedor, no en <html>.
 */
export function cssAcento(hex: string | null, selector = ":root[data-paleta]"): string {
  if (!hex) return "";
  const decl = Object.entries(tokensAcento(hex))
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
  return `${selector}{${decl}}`;
}

// ------------------------------------------------------- formato del documento --

export type FormatoDocumento = {
  /** Clásico: serif sobria. Moderno: la tipografía de la app. Compacto: más filas por hoja. */
  estilo: "clasico" | "moderno" | "compacto";
  /** Marca: títulos y líneas con el color de la empresa. Tinta: solo negro (impresoras sin color). */
  color: "marca" | "tinta";
  logo: "izquierda" | "centro" | "oculto";
  logoTamano: "chico" | "mediano" | "grande";
  tabla: "lineas" | "rayas" | "cuadricula";
  /** Frase bajo el nombre comercial («Repuestos japoneses desde 1998»). */
  lema: string;
  /** Mensaje al pie («Garantía de 30 días en piezas eléctricas»). */
  mensaje: string;
  mostrarVehiculo: boolean;
  mostrarVendedor: boolean;
  mostrarCodigo: boolean;
  /** Papel con que se imprime por defecto: hoja carta o tira de impresora térmica. */
  papel: Papel;
  /** Ancho del rollo térmico en milímetros. */
  ticketAncho: "80" | "58";
  ticketLetra: "normal" | "grande";
  /** El logo en la tira (en blanco y negro). */
  ticketLogo: boolean;
};

export type Papel = "carta" | "ticket";

export const FORMATO_POR_DEFECTO: FormatoDocumento = {
  estilo: "moderno",
  color: "marca",
  logo: "izquierda",
  logoTamano: "mediano",
  tabla: "lineas",
  lema: "",
  mensaje: "",
  mostrarVehiculo: true,
  mostrarVendedor: true,
  mostrarCodigo: true,
  papel: "carta",
  ticketAncho: "80",
  ticketLetra: "normal",
  ticketLogo: true,
};

export const LARGO_LEMA = 80;
export const LARGO_MENSAJE = 280;

function uno<T extends string>(v: unknown, opciones: readonly T[], defecto: T): T {
  return opciones.includes(v as T) ? (v as T) : defecto;
}

function texto(v: unknown, max: number) {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function bool(v: unknown, defecto: boolean) {
  return typeof v === "boolean" ? v : defecto;
}

/** Lee un formato guardado (o basura) y devuelve uno completo y válido. */
export function normalizarFormato(crudo: unknown): FormatoDocumento {
  const o = (crudo && typeof crudo === "object" ? crudo : {}) as Record<string, unknown>;
  const d = FORMATO_POR_DEFECTO;
  return {
    estilo: uno(o.estilo, ["clasico", "moderno", "compacto"] as const, d.estilo),
    color: uno(o.color, ["marca", "tinta"] as const, d.color),
    logo: uno(o.logo, ["izquierda", "centro", "oculto"] as const, d.logo),
    logoTamano: uno(o.logoTamano, ["chico", "mediano", "grande"] as const, d.logoTamano),
    tabla: uno(o.tabla, ["lineas", "rayas", "cuadricula"] as const, d.tabla),
    lema: texto(o.lema, LARGO_LEMA),
    mensaje: texto(o.mensaje, LARGO_MENSAJE),
    mostrarVehiculo: bool(o.mostrarVehiculo, d.mostrarVehiculo),
    mostrarVendedor: bool(o.mostrarVendedor, d.mostrarVendedor),
    mostrarCodigo: bool(o.mostrarCodigo, d.mostrarCodigo),
    papel: uno(o.papel, ["carta", "ticket"] as const, d.papel),
    ticketAncho: uno(o.ticketAncho, ["80", "58"] as const, d.ticketAncho),
    ticketLetra: uno(o.ticketLetra, ["normal", "grande"] as const, d.ticketLetra),
    ticketLogo: bool(o.ticketLogo, d.ticketLogo),
  };
}

/** Papel pedido en la URL (?papel=ticket) o, si no viene, el predeterminado de la empresa. */
export function papelDe(pedido: unknown, formato: FormatoDocumento): Papel {
  return pedido === "ticket" || pedido === "carta" ? pedido : formato.papel;
}

// ------------------------------------------------------------------ conjunto --

/** Lo que el escritorio y los documentos necesitan saber de la marca de la empresa. */
export type Identidad = {
  logo: string | null;
  fondo: string | null;
  atenuar: number;
  acento: string | null;
  formato: FormatoDocumento;
};

export const IDENTIDAD_VACIA: Identidad = {
  logo: null,
  fondo: null,
  atenuar: ATENUAR_POR_DEFECTO,
  acento: null,
  formato: FORMATO_POR_DEFECTO,
};

/** Fila de `empresas` (con o sin la migración 0012) → Identidad. */
export function identidadDeFila(fila: Record<string, unknown> | null | undefined): Identidad {
  if (!fila) return IDENTIDAD_VACIA;
  return {
    logo: urlArchivoEmpresa(fila.logo_ruta as string | null),
    fondo: urlArchivoEmpresa(fila.fondo_ruta as string | null),
    atenuar: fila.fondo_atenuar == null ? ATENUAR_POR_DEFECTO : atenuarValido(fila.fondo_atenuar),
    acento: acentoValido(fila.acento),
    formato: normalizarFormato(fila.formato_documento),
  };
}
