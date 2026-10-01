/**
 * Sitio web público de cada empresa (migración 0013): /t/<slug>.
 * Configuración compartida entre servidor y cliente.
 */

import { urlArchivoEmpresa } from "./identidad";

// ------------------------------------------------------------------- dirección --

/** Palabras que no pueden ser dirección de un taller (rutas, marcas, confusiones). */
const RESERVADAS = new Set([
  "admin", "api", "app", "ayuda", "carrito", "catalogo", "cookies", "dev", "inicio", "login",
  "nosotros", "privacidad", "producto", "soporte", "terminos", "wake", "wakeparts", "wake-parts",
]);

/** «Yonker El Pistón» → «yonker-el-piston». */
export function sugerirSlug(nombre: string) {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

export function errorSlug(slug: string): string | null {
  if (slug.length < 3 || slug.length > 40) return "Entre 3 y 40 caracteres.";
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return "Solo minúsculas, números y guiones (sin tildes ni espacios).";
  if (RESERVADAS.has(slug)) return "Esa dirección está reservada. Probá con otra.";
  return null;
}

// -------------------------------------------------------------- configuración --

export type ConfigSitio = {
  mostrarPrecios: boolean;
  /** Solo dígitos; se le agrega 504 si son 8. */
  whatsapp: string;
  horario: string;
  /** Enlace de Google Maps u otro mapa. */
  mapa: string;
  facebook: string;
  instagram: string;

  inicioTitulo: string;
  inicioBajada: string;
  inicioDestacados: boolean;
  inicioCategorias: boolean;
  inicioNosotros: boolean;

  nosotrosTitulo: string;
  nosotrosTexto: string;
  /** Año en que abrió el negocio. */
  nosotrosDesde: string;
  /** Hasta 4 puntos fuertes, uno por línea. */
  nosotrosPuntos: string;

  /** Rutas en Storage (bucket empresas, carpeta <empresa>/sitio/). Hasta 6. */
  fotos: string[];
  /** Ids de productos destacados en la portada, en orden. Hasta 8. */
  destacados: number[];
};

export const MAX_FOTOS = 6;
export const MAX_DESTACADOS = 8;

export const SITIO_POR_DEFECTO: ConfigSitio = {
  mostrarPrecios: true,
  whatsapp: "",
  horario: "",
  mapa: "",
  facebook: "",
  instagram: "",
  inicioTitulo: "",
  inicioBajada: "",
  inicioDestacados: true,
  inicioCategorias: true,
  inicioNosotros: true,
  nosotrosTitulo: "",
  nosotrosTexto: "",
  nosotrosDesde: "",
  nosotrosPuntos: "",
  fotos: [],
  destacados: [],
};

function texto(v: unknown, max: number, multilinea = false) {
  if (typeof v !== "string") return "";
  const limpio = multilinea
    ? v.replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n")
    : v.replace(/\s+/g, " ");
  return limpio.trim().slice(0, max);
}

function url(v: unknown) {
  const t = texto(v, 300);
  return /^https:\/\/[^\s]+$/i.test(t) ? t : "";
}

function bool(v: unknown, defecto: boolean) {
  return typeof v === "boolean" ? v : defecto;
}

export function normalizarSitio(crudo: unknown): ConfigSitio {
  const o = (crudo && typeof crudo === "object" ? crudo : {}) as Record<string, unknown>;
  const d = SITIO_POR_DEFECTO;
  const anio = texto(o.nosotrosDesde, 4);
  return {
    mostrarPrecios: bool(o.mostrarPrecios, d.mostrarPrecios),
    whatsapp: (typeof o.whatsapp === "string" ? o.whatsapp : "").replace(/\D/g, "").slice(0, 15),
    horario: texto(o.horario, 160),
    mapa: url(o.mapa),
    facebook: url(o.facebook),
    instagram: url(o.instagram),
    inicioTitulo: texto(o.inicioTitulo, 90),
    inicioBajada: texto(o.inicioBajada, 220),
    inicioDestacados: bool(o.inicioDestacados, d.inicioDestacados),
    inicioCategorias: bool(o.inicioCategorias, d.inicioCategorias),
    inicioNosotros: bool(o.inicioNosotros, d.inicioNosotros),
    nosotrosTitulo: texto(o.nosotrosTitulo, 90),
    nosotrosTexto: texto(o.nosotrosTexto, 3000, true),
    nosotrosDesde: /^(19|20)\d\d$/.test(anio) ? anio : "",
    nosotrosPuntos: texto(o.nosotrosPuntos, 400, true)
      .split("\n")
      .map((l) => l.trim().slice(0, 90))
      .filter(Boolean)
      .slice(0, 4)
      .join("\n"),
    fotos: (Array.isArray(o.fotos) ? o.fotos : [])
      .filter((r): r is string => typeof r === "string" && /^[0-9a-f-]{36}\/sitio\/[\w.-]+$/.test(r))
      .slice(0, MAX_FOTOS),
    destacados: [
      ...new Set((Array.isArray(o.destacados) ? o.destacados : []).map(Number).filter((n) => Number.isSafeInteger(n) && n > 0)),
    ].slice(0, MAX_DESTACADOS),
  };
}

/** Enlace de WhatsApp con un mensaje ya escrito. */
export function enlaceWhatsapp(numero: string, mensaje?: string) {
  if (!numero) return null;
  const completo = numero.length === 8 ? `504${numero}` : numero;
  return `https://wa.me/${completo}${mensaje ? `?text=${encodeURIComponent(mensaje)}` : ""}`;
}

// ------------------------------------------------------------ datos públicos --

/** Lo que devuelve sitio_publico(): datos de la empresa que el sitio puede mostrar. */
export type SitioPublico = {
  id: string;
  slug: string;
  nombre: string;
  razonSocial: string | null;
  telefono: string | null;
  correo: string | null;
  direccion: string | null;
  paleta: string;
  acento: string | null;
  logo: string | null;
  fondo: string | null;
  atenuar: number;
  config: ConfigSitio;
  publicado: boolean;
  esMiembro: boolean;
};

export function sitioDeFila(f: Record<string, unknown>): SitioPublico {
  return {
    id: String(f.id),
    slug: String(f.slug),
    nombre: String(f.nombre),
    razonSocial: (f.razon_social as string | null) ?? null,
    telefono: (f.telefono as string | null) ?? null,
    correo: (f.correo as string | null) ?? null,
    direccion: (f.direccion as string | null) ?? null,
    paleta: String(f.paleta ?? "rojo-negro"),
    acento: (f.acento as string | null) ?? null,
    logo: urlArchivoEmpresa(f.logo_ruta as string | null),
    fondo: urlArchivoEmpresa(f.fondo_ruta as string | null),
    atenuar: Number(f.fondo_atenuar ?? 40),
    config: normalizarSitio(f.sitio),
    publicado: Boolean(f.publicado),
    esMiembro: Boolean(f.es_miembro),
  };
}

/** Producto tal como lo ve el público (sin costo ni existencia; precio null si el taller lo oculta). */
export type ProductoWeb = {
  id: number;
  codigo: string;
  nombre: string;
  marca: string | null;
  categoria: string;
  condicion: string;
  precio: number | null;
  exento: boolean;
  imagen: string | null;
  grupo?: string | null;
  ajuste?: string | null;
};

/** Precio que ve el cliente: con ISV 15 % salvo exentos (docs/negocio.md §3.5). */
export function precioConIsv(precio: number, exento: boolean) {
  return Math.round(precio * (exento ? 1 : 1.15) * 100) / 100;
}

export function rutaSitio(slug: string, sub = "") {
  return `/t/${slug}${sub}`;
}
