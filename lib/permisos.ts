/**
 * Planes y permisos por rol (0023). Compartido por servidor y navegador.
 *
 * - El **plan** de la empresa decide qué módulos existen para ella y sus límites
 *   (los límites los aplica la base con triggers).
 * - El **rol** decide qué módulos y capacidades tiene cada persona dentro de lo
 *   que permite el plan. El dueño siempre tiene todo lo del plan.
 * - Lo edita solo el admin de plataforma (módulo Planes). Los talleres no ven
 *   el nombre de su plan.
 *
 * Ojo: esto controla el escritorio (qué módulos aparecen). La base sigue
 * exigiendo dueño/admin para escribir en lo administrativo (RLS): darle Compras
 * a un vendedor se lo muestra, pero no puede registrar compras.
 */

import type { Rol } from "@/lib/sesion";

export type Permiso = string;

/** Módulos que se controlan por plan y rol. `admin`: la base solo deja escribir a dueño/admin. */
export const MODULOS_CONTROLADOS: readonly { id: string; nombre: string; admin?: boolean }[] = [
  { id: "cotizar", nombre: "Cotizar y facturar" },
  { id: "caja", nombre: "Caja" },
  { id: "inventario", nombre: "Inventario" },
  { id: "toma", nombre: "Toma rápida" },
  { id: "compras", nombre: "Compras", admin: true },
  { id: "ventas", nombre: "Ventas" },
  { id: "notas", nombre: "Notas de crédito/débito", admin: true },
  { id: "contabilidad", nombre: "Contabilidad", admin: true },
  { id: "sitio", nombre: "Sitio web", admin: true },
  { id: "mantenimiento", nombre: "Mantenimiento" },
  { id: "usuarios", nombre: "Usuarios", admin: true },
  { id: "actividad", nombre: "Actividad", admin: true },
  { id: "taller", nombre: "Taller" },
];

/** Módulos que siempre están (no dependen del plan ni del rol). */
export const MODULOS_SIEMPRE = ["inicio", "mi-usuario"];

/** Capacidades sueltas (además de los módulos). */
export const CAPACIDADES: readonly { clave: Permiso; nombre: string; detalle: string }[] = [
  { clave: "ver_margen", nombre: "Ver costo y margen", detalle: "En el mostrador, al cotizar y facturar." },
];

export const LIMITES: readonly { clave: string; nombre: string; detalle?: string }[] = [
  { clave: "sucursales", nombre: "Sucursales", detalle: "Establecimientos distintos de los puntos de emisión" },
  { clave: "productos", nombre: "Productos activos" },
  { clave: "clientes", nombre: "Clientes activos" },
  { clave: "proveedores", nombre: "Proveedores activos" },
  { clave: "usuarios", nombre: "Usuarios", detalle: "Miembros activos + invitaciones pendientes" },
  { clave: "puntos_emision", nombre: "Puntos de emisión" },
  { clave: "fotos_por_producto", nombre: "Fotos por producto" },
  { clave: "facturas_mes", nombre: "Facturas por mes" },
  { clave: "cotizaciones_mes", nombre: "Cotizaciones por mes" },
  { clave: "almacenamiento_mb", nombre: "Almacenamiento (MB)", detalle: "Fotos, logo, fondo y fotos del sitio" },
];

const modulo = (id: string): Permiso => `modulo:${id}`;
const TODOS_LOS_MODULOS = MODULOS_CONTROLADOS.map((m) => modulo(m.id));

/** Lo que trae la app si el admin no configuró el rol (igual que antes de 0023). */
export const PERMISOS_POR_DEFECTO: Record<Rol, Permiso[]> = {
  dueno: [...TODOS_LOS_MODULOS, ...CAPACIDADES.map((c) => c.clave)],
  admin: [...TODOS_LOS_MODULOS, "ver_margen"],
  vendedor: ["cotizar", "caja", "inventario", "ventas", "mantenimiento", "taller"].map(modulo),
};

/** Roles que el admin de plataforma puede configurar (el dueño siempre tiene todo). */
export const ROLES_CONFIGURABLES: readonly { rol: Exclude<Rol, "dueno">; nombre: string }[] = [
  { rol: "admin", nombre: "Administrador" },
  { rol: "vendedor", nombre: "Vendedor" },
];

/**
 * Permisos efectivos: los del rol (configurados o por defecto), recortados a los
 * módulos del plan. `modulosPlan` null = sin plan (todo).
 */
export function permisosEfectivos(
  rol: Rol | null,
  configurados: Permiso[] | null | undefined,
  modulosPlan: string[] | null | undefined,
): Permiso[] {
  if (!rol) return [];
  const base = rol === "dueno" ? PERMISOS_POR_DEFECTO.dueno : configurados ?? PERMISOS_POR_DEFECTO[rol];
  if (!modulosPlan) return [...base];
  return base.filter((p) => !p.startsWith("modulo:") || modulosPlan.includes(p.slice(7)));
}

/** ¿La sesión tiene este permiso? Sin `permisos` (sin la migración 0023), lo de siempre por rol. */
export function puede(sesion: { rol: Rol | null; permisos?: Permiso[] }, permiso: Permiso): boolean {
  const lista = sesion.permisos ?? (sesion.rol ? PERMISOS_POR_DEFECTO[sesion.rol] : []);
  return lista.includes(permiso);
}

/** ¿Ve este módulo del escritorio? */
export function veModulo(sesion: { rol: Rol | null; permisos?: Permiso[] }, id: string): boolean {
  if (MODULOS_SIEMPRE.includes(id)) return true;
  return puede(sesion, modulo(id));
}

/** Normaliza un objeto de límites: solo claves conocidas y enteros ≥ 0; vacío = sin límite. */
export function normalizarLimites(entrada: Record<string, unknown>): Record<string, number> {
  const salida: Record<string, number> = {};
  for (const { clave } of LIMITES) {
    const v = entrada[clave];
    if (v === null || v === undefined || v === "") continue;
    const n = Math.floor(Number(v));
    if (Number.isFinite(n) && n >= 0) salida[clave] = Math.min(n, 10_000_000);
  }
  return salida;
}

/** Filtra una lista de permisos a los conocidos. */
export function normalizarPermisos(lista: unknown): Permiso[] {
  if (!Array.isArray(lista)) return [];
  const validos = new Set<Permiso>([...TODOS_LOS_MODULOS, ...CAPACIDADES.map((c) => c.clave)]);
  return [...new Set(lista.filter((p): p is string => typeof p === "string" && validos.has(p)))];
}

/** Filtra una lista de módulos de plan a los conocidos (+ los de siempre). */
export function normalizarModulosPlan(lista: unknown): string[] {
  if (!Array.isArray(lista)) return [...MODULOS_SIEMPRE];
  const validos = new Set(MODULOS_CONTROLADOS.map((m) => m.id));
  return [...new Set([...MODULOS_SIEMPRE, ...lista.filter((m): m is string => typeof m === "string" && validos.has(m))])];
}
