import { cant, moneda, pct } from "@/lib/formato";
import type { FormatoReporte, PeriodoId } from "./tipos";

export const PERIODOS: readonly { id: PeriodoId; etiqueta: string }[] = [
  { id: "hoy", etiqueta: "Hoy" },
  { id: "7d", etiqueta: "7 días" },
  { id: "30d", etiqueta: "30 días" },
  { id: "mes", etiqueta: "Este mes" },
  { id: "mes_anterior", etiqueta: "Mes pasado" },
  { id: "anio", etiqueta: "Este año" },
];

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Fecha de hoy en Honduras como Date UTC a medianoche (para sumar días sin husos). */
export function hoyHonduras(): Date {
  const [a, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Tegucigalpa" })
    .format(new Date())
    .split("-")
    .map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}

export function sumarDias(fecha: string, dias: number) {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return iso(d);
}

export function diasEntre(desde: string, hasta: string) {
  return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000) + 1;
}

export function rangoDe(periodo: PeriodoId): { desde: string; hasta: string } {
  const hoy = hoyHonduras();
  const h = iso(hoy);
  const a = hoy.getUTCFullYear();
  const m = hoy.getUTCMonth();
  switch (periodo) {
    case "hoy":
      return { desde: h, hasta: h };
    case "7d":
      return { desde: sumarDias(h, -6), hasta: h };
    case "30d":
      return { desde: sumarDias(h, -29), hasta: h };
    case "mes":
      return { desde: iso(new Date(Date.UTC(a, m, 1))), hasta: h };
    case "mes_anterior":
      return { desde: iso(new Date(Date.UTC(a, m - 1, 1))), hasta: iso(new Date(Date.UTC(a, m, 0))) };
    case "anio":
      return { desde: iso(new Date(Date.UTC(a, 0, 1))), hasta: h };
  }
}

const fechaCorta = new Intl.DateTimeFormat("es-HN", { day: "numeric", month: "short", timeZone: "UTC" });
const mesCorto = new Intl.DateTimeFormat("es-HN", { month: "short", year: "2-digit", timeZone: "UTC" });

export const diaCorto = (f: string) => fechaCorta.format(new Date(`${f}T00:00:00Z`)).replace(".", "");
export const mesDe = (f: string) => mesCorto.format(new Date(`${f}T00:00:00Z`)).replace(".", "");

export function textoRango(desde: string, hasta: string) {
  return desde === hasta ? diaCorto(desde) : `${diaCorto(desde)} – ${diaCorto(hasta)}`;
}

export function formatear(valor: unknown, formato: FormatoReporte): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  switch (formato) {
    case "moneda":
      return moneda(Number(valor));
    case "entero":
      return Math.round(Number(valor)).toLocaleString("es-HN");
    case "cantidad":
      return cant(Number(valor));
    case "porcentaje":
      return pct(Number(valor));
    default:
      return String(valor);
  }
}

/** Formato compacto para ejes: L 12.5 k, L 1.2 M. */
export function compacto(valor: number, formato: FormatoReporte) {
  const abs = Math.abs(valor);
  const texto =
    abs >= 1_000_000 ? `${(valor / 1_000_000).toFixed(1)} M` : abs >= 10_000 ? `${Math.round(valor / 1000)} k` : abs >= 1000 ? `${(valor / 1000).toFixed(1)} k` : String(Math.round(valor));
  return formato === "moneda" ? `L ${texto}` : texto;
}
