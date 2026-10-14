"use server";

import {
  normalizarLimites,
  normalizarModulosPlan,
  normalizarPermisos,
  PERMISOS_POR_DEFECTO,
  ROLES_CONFIGURABLES,
  type Permiso,
} from "@/lib/permisos";
import { registrar } from "@/lib/registro";
import { adminsPlataforma, obtenerSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

/**
 * Planes, límites, plan de cada empresa y permisos por rol (0023). Solo admin
 * de plataforma: la base lo exige con RLS y esto es el segundo candado (correo
 * en ADMINS_PLATAFORMA). Los talleres no ven nada de esto.
 */

export type Plan = {
  codigo: string;
  nombre: string;
  descripcion: string | null;
  precio_mensual: number | null;
  /** 0024: cobro con n1co. */
  precio_anual: number | null;
  n1co_plan_mensual: number | null;
  n1co_plan_anual: number | null;
  /** Se muestra a los talleres en Taller › Suscripción. */
  publico: boolean;
  /** Solo lo ven y pagan los admins de plataforma (plan de prueba de $0.50). */
  solo_admins: boolean;
  etiqueta: string | null;
  caracteristicas: string[];
  orden: number;
  modulos: string[];
  limites: Record<string, number>;
  predeterminado: boolean;
  activo: boolean;
};

export type UsoEmpresa = {
  id_empresa: string;
  empresa: string;
  plan: string;
  plan_nombre: string | null;
  /** 0024: plan que rige hoy (prueba, gracia o fin de periodo incluidos). */
  plan_efectivo: string | null;
  estado: string | null;
  prueba_hasta: string | null;
  ciclo: string | null;
  periodo_fin: string | null;
  n1co_suscripcion_id: string | null;
  asignado_en: string | null;
  nota: string | null;
  productos: number;
  clientes: number;
  proveedores: number | null;
  puntos_emision: number | null;
  sucursales: number | null;
  usuarios: number;
  facturas_mes: number;
  cotizaciones_mes: number;
  almacenamiento_bytes: number | null;
};

export type DatosPlanes = {
  planes: Plan[];
  empresas: UsoEmpresa[];
  permisos: Record<string, { permisos: Permiso[]; configurado: boolean }>;
  /** Correos de ADMINS_PLATAFORMA (el flag de la base se sincroniza al entrar). */
  admins: string[];
};

type Resultado<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const FALTA_MIGRACION = "Falta ejecutar las migraciones 0023 y 0024 (planes y suscripciones).";
const NO_AUTORIZADO = "Solo los administradores de Wake Parts.";

function mensajeError(error: { code?: string; message?: string }) {
  if (error.code === "42P01" || error.code === "PGRST205" || error.code === "PGRST202") return FALTA_MIGRACION;
  if (error.code === "P0001") return error.message ?? "No se pudo guardar.";
  if (error.code === "23505") return "Ya existe un plan con ese código o con ese ID de n1co.";
  if (error.code === "23503") return "Ese plan tiene empresas asignadas: pasalas a otro plan primero.";
  return "No se pudo guardar. Intentá de nuevo.";
}

async function admin() {
  const sesion = await obtenerSesion();
  return sesion?.usuario.esAdminPlataforma ? sesion : null;
}

export async function cargarPlanes(): Promise<Resultado<{ datos: DatosPlanes }>> {
  const sesion = await admin();
  if (!sesion) return { ok: false, error: NO_AUTORIZADO };
  const supabase = await createClient();
  const correos = adminsPlataforma();
  const [planes, empresas, permisos] = await Promise.all([
    supabase.from("planes").select("*").order("orden"),
    supabase.rpc("uso_planes_empresas"),
    supabase.from("permisos_roles").select("rol, permisos"),
  ]);
  const error = planes.error ?? empresas.error ?? permisos.error;
  if (error) {
    console.error("[cargarPlanes]", error);
    return { ok: false, error: mensajeError(error) };
  }
  const delRol = new Map((permisos.data ?? []).map((f) => [f.rol as string, f.permisos as unknown]));
  return {
    ok: true,
    datos: {
      planes: (planes.data ?? []).map((p) => ({
        ...p,
        precio_mensual: p.precio_mensual === null ? null : Number(p.precio_mensual),
        precio_anual: p.precio_anual == null ? null : Number(p.precio_anual),
        n1co_plan_mensual: p.n1co_plan_mensual ?? null,
        n1co_plan_anual: p.n1co_plan_anual ?? null,
        publico: Boolean(p.publico),
        solo_admins: Boolean(p.solo_admins),
        etiqueta: p.etiqueta ?? null,
        caracteristicas: Array.isArray(p.caracteristicas) ? p.caracteristicas : [],
        modulos: normalizarModulosPlan(p.modulos),
        limites: normalizarLimites((p.limites ?? {}) as Record<string, unknown>),
      })) as Plan[],
      empresas: ((empresas.data ?? []) as UsoEmpresa[]).map((e) => ({
        ...e,
        almacenamiento_bytes: e.almacenamiento_bytes == null ? null : Number(e.almacenamiento_bytes),
      })),
      permisos: Object.fromEntries(
        ROLES_CONFIGURABLES.map(({ rol }) => [
          rol,
          delRol.has(rol)
            ? { permisos: normalizarPermisos(delRol.get(rol)), configurado: true }
            : { permisos: PERMISOS_POR_DEFECTO[rol], configurado: false },
        ]),
      ),
      admins: [...correos],
    },
  };
}

export async function guardarPlan(
  plan: Omit<Plan, "predeterminado" | "activo"> & { nuevo?: boolean },
): Promise<Resultado> {
  const sesion = await admin();
  if (!sesion) return { ok: false, error: NO_AUTORIZADO };
  const codigo = plan.codigo.trim().toLowerCase();
  if (!/^[a-z0-9_]{2,30}$/.test(codigo)) return { ok: false, error: "Código: de 2 a 30 letras minúsculas, números o _." };
  const nombre = plan.nombre.trim().slice(0, 60);
  if (!nombre) return { ok: false, error: "Escribí el nombre del plan." };
  const dinero = (v: number | null) => (v === null || Number.isNaN(Number(v)) ? null : Math.max(0, Math.round(Number(v) * 100) / 100));
  const idN1co = (v: number | null) => (v === null || !Number.isInteger(Number(v)) || Number(v) <= 0 ? null : Number(v));
  const precio = dinero(plan.precio_mensual);
  if (plan.publico && plan.solo_admins) return { ok: false, error: "Un plan es público o solo para admins, no las dos cosas." };

  const fila = {
    codigo,
    nombre,
    descripcion: plan.descripcion?.trim().slice(0, 300) || null,
    precio_mensual: precio,
    precio_anual: dinero(plan.precio_anual),
    n1co_plan_mensual: idN1co(plan.n1co_plan_mensual),
    n1co_plan_anual: idN1co(plan.n1co_plan_anual),
    publico: Boolean(plan.publico),
    solo_admins: Boolean(plan.solo_admins),
    etiqueta: plan.etiqueta?.trim().slice(0, 160) || null,
    caracteristicas: (plan.caracteristicas ?? []).map((c) => c.trim().slice(0, 120)).filter(Boolean).slice(0, 30),
    orden: Math.max(0, Math.min(999, Math.floor(Number(plan.orden) || 0))),
    modulos: normalizarModulosPlan(plan.modulos),
    limites: normalizarLimites(plan.limites),
    actualizado_en: new Date().toISOString(),
    actualizado_por: sesion.usuario.id,
  };
  const supabase = await createClient();
  const { error } = plan.nuevo
    ? await supabase.from("planes").insert(fila)
    : await supabase.from("planes").update(fila).eq("codigo", codigo);
  if (error) {
    console.error("[guardarPlan]", error);
    return { ok: false, error: mensajeError(error) };
  }
  await registrar({
    tipo: "accion",
    evento: plan.nuevo ? "plan.crear" : "plan.editar",
    mensaje: `Plan ${nombre}`,
    id_usuario: sesion.usuario.id,
    correo: sesion.usuario.correo,
    datos: { codigo, modulos: fila.modulos, limites: fila.limites },
  });
  return { ok: true };
}

export async function eliminarPlan(codigo: string): Promise<Resultado> {
  const sesion = await admin();
  if (!sesion) return { ok: false, error: NO_AUTORIZADO };
  const supabase = await createClient();
  const { data: plan } = await supabase.from("planes").select("predeterminado").eq("codigo", codigo).maybeSingle();
  if (plan?.predeterminado) return { ok: false, error: "No se puede eliminar el plan predeterminado." };
  const { error } = await supabase.from("planes").delete().eq("codigo", codigo);
  if (error) return { ok: false, error: mensajeError(error) };
  return { ok: true };
}

/** Plan con el que arrancan las empresas nuevas. */
export async function fijarPredeterminado(codigo: string): Promise<Resultado> {
  const sesion = await admin();
  if (!sesion) return { ok: false, error: NO_AUTORIZADO };
  const supabase = await createClient();
  const quitar = await supabase.from("planes").update({ predeterminado: false }).eq("predeterminado", true).neq("codigo", codigo);
  if (quitar.error) return { ok: false, error: mensajeError(quitar.error) };
  const { error } = await supabase.from("planes").update({ predeterminado: true, activo: true }).eq("codigo", codigo);
  if (error) return { ok: false, error: mensajeError(error) };
  return { ok: true };
}

/**
 * Cambio manual del plan de una empresa (0024):
 * - «cortesia»: el plan elegido sin cobro, hasta que el admin lo cambie.
 * - «prueba»: prueba con el plan elegido por `dias` días desde hoy.
 * - «gratis»: plan Gratis.
 * No toca la suscripción con tarjeta en n1co: si existe, sus renovaciones la
 * vuelven a activar. Para dejar de cobrar, el dueño cancela (o se cancela en n1co).
 */
export async function asignarPlan(
  idEmpresa: string,
  plan: string,
  nota: string,
  modo: "cortesia" | "prueba" | "gratis" = "cortesia",
  dias = 7,
): Promise<Resultado> {
  const sesion = await admin();
  if (!sesion) return { ok: false, error: NO_AUTORIZADO };
  if (!/^[0-9a-f-]{36}$/.test(idEmpresa)) return { ok: false, error: "Empresa no válida." };
  if (!["cortesia", "prueba", "gratis"].includes(modo)) return { ok: false, error: "Modo no válido." };
  const d = Math.floor(Number(dias));
  if (modo === "prueba" && !(d >= 1 && d <= 90)) return { ok: false, error: "La prueba va de 1 a 90 días." };

  const ahora = new Date();
  const fila: Record<string, unknown> = {
    id_empresa: idEmpresa,
    nota: nota.trim().slice(0, 500) || null,
    asignado_en: ahora.toISOString(),
    asignado_por: sesion.usuario.id,
    actualizado_en: ahora.toISOString(),
  };
  if (modo === "cortesia") Object.assign(fila, { plan, estado: "cortesia" });
  if (modo === "gratis") Object.assign(fila, { plan: "gratis", estado: "gratis", prueba_hasta: null });
  if (modo === "prueba")
    Object.assign(fila, {
      plan: "gratis",
      estado: "prueba",
      plan_prueba: plan,
      prueba_hasta: new Date(ahora.getTime() + d * 86_400_000).toISOString(),
      recordatorios: [],
    });

  const supabase = await createClient();
  const { error } = await supabase.from("empresas_planes").upsert(fila, { onConflict: "id_empresa" });
  if (error) {
    console.error("[asignarPlan]", error.code);
    return { ok: false, error: mensajeError(error) };
  }
  await registrar({
    tipo: "accion",
    evento: "plan.asignar",
    mensaje: `${modo} ${plan}`,
    id_usuario: sesion.usuario.id,
    correo: sesion.usuario.correo,
    id_empresa: idEmpresa,
    datos: { plan, modo, dias: modo === "prueba" ? d : null },
  });
  return { ok: true };
}

/** Permisos de un rol. `null` = volver a lo que trae la app. */
export async function guardarPermisosRol(rol: string, permisos: Permiso[] | null): Promise<Resultado> {
  const sesion = await admin();
  if (!sesion) return { ok: false, error: NO_AUTORIZADO };
  if (!ROLES_CONFIGURABLES.some((r) => r.rol === rol)) return { ok: false, error: "Ese rol no se configura." };
  const supabase = await createClient();
  const { error } =
    permisos === null
      ? await supabase.from("permisos_roles").delete().eq("rol", rol)
      : await supabase.from("permisos_roles").upsert(
          {
            rol,
            permisos: normalizarPermisos(permisos),
            actualizado_en: new Date().toISOString(),
            actualizado_por: sesion.usuario.id,
          },
          { onConflict: "rol" },
        );
  if (error) {
    console.error("[guardarPermisosRol]", error);
    return { ok: false, error: mensajeError(error) };
  }
  await registrar({
    tipo: "accion",
    evento: "permisos.rol",
    mensaje: `Permisos de ${rol}`,
    id_usuario: sesion.usuario.id,
    correo: sesion.usuario.correo,
    datos: { rol, permisos },
  });
  return { ok: true };
}
