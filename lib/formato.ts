/** Formatos de números, dinero y fechas para Honduras (servidor y cliente). */

const lempiras = new Intl.NumberFormat("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const porcentaje = new Intl.NumberFormat("es-HN", { maximumFractionDigits: 1 });
const cantidad = new Intl.NumberFormat("es-HN", { maximumFractionDigits: 2 });

/** «L 1,234.50» */
export function moneda(valor: number | string | null | undefined) {
  const n = Number(valor);
  return Number.isFinite(n) ? `L ${lempiras.format(n)}` : "—";
}

/** Solo el número con 2 decimales: «1,234.50» */
export function monto(valor: number | string | null | undefined) {
  const n = Number(valor);
  return Number.isFinite(n) ? lempiras.format(n) : "—";
}

export function pct(valor: number | string | null | undefined) {
  const n = Number(valor);
  return Number.isFinite(n) ? `${porcentaje.format(n)} %` : "—";
}

export function cant(valor: number | string | null | undefined) {
  const n = Number(valor);
  return Number.isFinite(n) ? cantidad.format(n) : "—";
}

const ZONA = "America/Tegucigalpa";
const fechaLarga = new Intl.DateTimeFormat("es-HN", { timeZone: ZONA, day: "2-digit", month: "2-digit", year: "numeric" });
const fechaHora = new Intl.DateTimeFormat("es-HN", {
  timeZone: ZONA,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const fechaHoraSegundos = new Intl.DateTimeFormat("es-HN", {
  timeZone: ZONA,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

export const fecha = (v: string | Date) => fechaLarga.format(new Date(v));
/** Con segundos, hora de Honduras (registro de actividad). */
export const fechaHoraExacta = (v: string | Date) => fechaHoraSegundos.format(new Date(v));
export const fechaYHora = (v: string | Date) => fechaHora.format(new Date(v));
/** Fecha sin hora (AAAA-MM-DD) mostrada tal cual, sin corrimiento de zona. */
export const fechaDia = (v: string) => v.slice(0, 10).split("-").reverse().join("/");

/** Redondeo a centavos (evita 0.1 + 0.2). */
export const centavos = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// ---------------------------------------------------------- en letras -------

const UNIDADES = [
  "", "UN", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE", "DIEZ",
  "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISÉIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE", "VEINTE",
  "VEINTIÚN", "VEINTIDÓS", "VEINTITRÉS", "VEINTICUATRO", "VEINTICINCO", "VEINTISÉIS", "VEINTISIETE", "VEINTIOCHO", "VEINTINUEVE",
];
const DECENAS = ["", "", "", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
const CENTENAS = [
  "", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS",
];

function hastaMil(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "CIEN";
  const c = Math.floor(n / 100);
  const r = n % 100;
  let resto = "";
  if (r < 30) resto = UNIDADES[r];
  else resto = DECENAS[Math.floor(r / 10)] + (r % 10 ? ` Y ${UNIDADES[r % 10]}` : "");
  return [CENTENAS[c], resto].filter(Boolean).join(" ");
}

function entero(n: number): string {
  if (n === 0) return "CERO";
  const millones = Math.floor(n / 1_000_000);
  const miles = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;
  const partes: string[] = [];
  if (millones) partes.push(millones === 1 ? "UN MILLÓN" : `${entero(millones)} MILLONES`);
  if (miles) partes.push(miles === 1 ? "MIL" : `${hastaMil(miles)} MIL`);
  if (resto) partes.push(hastaMil(resto));
  return partes.join(" ");
}

/** «DOS MIL CINCUENTA Y OCHO LEMPIRAS CON 73/100» */
export function enLetras(total: number) {
  const n = centavos(Math.abs(total));
  const lps = Math.floor(n);
  const cts = Math.round((n - lps) * 100);
  // «UN», «VEINTIÚN»: forma corta correcta ante «lempiras».
  const de = lps >= 1_000_000 && lps % 1_000_000 === 0 ? " DE" : "";
  return `${entero(lps)}${de} ${lps === 1 ? "LEMPIRA" : "LEMPIRAS"} CON ${String(cts).padStart(2, "0")}/100`;
}
