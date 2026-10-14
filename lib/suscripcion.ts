/**
 * Suscripción del taller (0024): tipos y validaciones compartidas por el
 * navegador y el servidor. El cobro lo hace n1co; aquí no hay nada secreto.
 */

import { ERROR_SIN_ACEPTAR } from "@/lib/legal";

export type Ciclo = "mensual" | "anual";
export type EstadoSuscripcion = "prueba" | "activa" | "vencida" | "cancelada" | "gratis" | "cortesia";

export type PlanPublico = {
  codigo: string;
  nombre: string;
  descripcion: string | null;
  etiqueta: string | null;
  precio_mensual: number | null;
  precio_anual: number | null;
  orden: number;
  modulos: string[];
  limites: Record<string, number>;
  caracteristicas: string[];
  mensual_disponible: boolean;
  anual_disponible: boolean;
  solo_admins: boolean;
};

export type MiSuscripcion = {
  estado: EstadoSuscripcion;
  plan: string;
  plan_nombre: string | null;
  plan_efectivo: string;
  plan_efectivo_nombre: string | null;
  plan_prueba: string | null;
  prueba_hasta: string | null;
  ciclo: Ciclo | null;
  periodo_fin: string | null;
  cancelada_en: string | null;
  con_tarjeta: boolean;
};

export type UsoEmpresa = {
  productos: number;
  clientes: number;
  proveedores: number | null;
  puntos_emision: number | null;
  sucursales: number | null;
  usuarios: number;
  facturas_mes: number;
  cotizaciones_mes: number;
  almacenamiento_bytes: number;
};

export type EventoSuscripcion = {
  id: number;
  tipo: string;
  plan: string | null;
  ciclo: Ciclo | null;
  monto: number | null;
  mensaje: string | null;
  creado_en: string;
};

export type DatosSuscripcion = {
  suscripcion: MiSuscripcion | null;
  uso: UsoEmpresa | null;
  planes: PlanPublico[];
  eventos: EventoSuscripcion[];
  /** Solo el dueño paga, cambia o cancela. */
  puedeGestionar: boolean;
  /** Credenciales de n1co presentes en el servidor. */
  cobrosActivos: boolean;
  modo: "sandbox" | "live";
};

export type PeticionPago = {
  plan: string;
  ciclo: Ciclo;
  telefono: string;
  tarjeta?: { numero: string; titular: string; mes: string; anio: string; cvv: string };
  facturacion: { pais: string; estado: string; codigoPostal: string };
  /** Casilla de Términos y Privacidad (obligatoria en un pago nuevo; 0026). */
  aceptaTerminos?: boolean;
  /** Segundo paso tras el 3D Secure: el intento que lo pidió. */
  intento?: string;
  autenticacion?: string;
};

export type ResultadoPago =
  | { ok: true; estado: "exitoso"; mensaje: string }
  | { ok: true; estado: "autenticacion"; intento: string; url: string; mensaje: string }
  | { ok: true; estado: "facturacion"; intento: string; mensaje: string }
  /** Otra petición ya está cobrando este intento: el navegador espera con `estadoPago`. */
  | { ok: true; estado: "procesando"; intento: string; mensaje: string }
  | { ok: false; error: string; campo?: string };

export const soloDigitos = (v: string) => v.replace(/\D/g, "");

/** Algoritmo de Luhn: descarta números mal digitados antes de ir a n1co. */
export function luhn(numero: string) {
  const d = soloDigitos(numero);
  if (d.length < 13 || d.length > 19) return false;
  let suma = 0;
  for (let i = 0; i < d.length; i++) {
    let n = Number(d[d.length - 1 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    suma += n;
  }
  return suma % 10 === 0;
}

export function telefonoE164(v: string) {
  const d = soloDigitos(v);
  // 8 dígitos = Honduras sin código de país.
  const completo = d.length === 8 ? `504${d}` : d;
  const t = `+${completo}`;
  return /^\+[1-9]\d{7,14}$/.test(t) ? t : null;
}

export function formatoTarjeta(v: string) {
  return soloDigitos(v)
    .slice(0, 19)
    .replace(/(\d{4})(?=\d)/g, "$1 ");
}

/** Valida la petición; devuelve el primer error (con su campo) o null. */
export function validarPago(p: PeticionPago): { error: string; campo: string } | null {
  if (p.ciclo !== "mensual" && p.ciclo !== "anual") return { error: "Elegí mensual o anual.", campo: "ciclo" };
  if (!telefonoE164(p.telefono)) return { error: "Escribí un teléfono válido. Ej: 9876 5432", campo: "telefono" };
  const pais = p.facturacion.pais.trim().toUpperCase();
  if (!/^[A-Z]{2,3}$/.test(pais)) return { error: "Elegí el país de facturación.", campo: "pais" };
  if (["US", "USA", "CA", "CAN"].includes(pais)) {
    if (!p.facturacion.estado.trim()) return { error: "Escribí el estado o provincia.", campo: "estado" };
    if (!/^[A-Za-z0-9 -]{3,10}$/.test(p.facturacion.codigoPostal.trim()))
      return { error: "Escribí el código postal.", campo: "codigoPostal" };
  }
  if (p.intento) return null;
  const t = p.tarjeta;
  if (!t) return { error: "Escribí los datos de la tarjeta.", campo: "numero" };
  if (t.titular.trim().length < 3 || t.titular.length > 120)
    return { error: "Escribí el nombre como aparece en la tarjeta.", campo: "titular" };
  if (!luhn(t.numero)) return { error: "Revisá el número de la tarjeta.", campo: "numero" };
  const mes = Number(t.mes);
  const anio = Number(t.anio);
  if (!(mes >= 1 && mes <= 12)) return { error: "Elegí el mes de vencimiento.", campo: "mes" };
  if (!/^\d{4}$/.test(t.anio)) return { error: "Elegí el año de vencimiento.", campo: "anio" };
  if (new Date(anio, mes, 0, 23, 59, 59) < new Date()) return { error: "La tarjeta está vencida.", campo: "mes" };
  if (!/^\d{3,4}$/.test(t.cvv)) return { error: "El código de seguridad tiene 3 o 4 dígitos.", campo: "cvv" };
  if (p.aceptaTerminos !== true) return { error: ERROR_SIN_ACEPTAR, campo: "acepta" };
  return null;
}

export const ETIQUETA_ESTADO: Record<EstadoSuscripcion, string> = {
  prueba: "En prueba",
  activa: "Activa",
  vencida: "Pago pendiente",
  cancelada: "Cancelada",
  gratis: "Plan gratis",
  cortesia: "Cortesía",
};

export function precioDe(plan: Pick<PlanPublico, "precio_mensual" | "precio_anual">, ciclo: Ciclo) {
  return ciclo === "anual" ? plan.precio_anual : plan.precio_mensual;
}

export const usd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);

export function diasHasta(fecha: string | null) {
  if (!fecha) return null;
  return Math.ceil((new Date(fecha).getTime() - Date.now()) / 86_400_000);
}
