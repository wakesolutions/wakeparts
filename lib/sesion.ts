import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { normalizarDock, type PreferenciasDock } from "@/lib/dock";
import { identidadDeFila, type Identidad } from "@/lib/identidad";
import { paletaValida, type PaletaId } from "@/lib/paletas";
import { normalizarModulosPlan, normalizarPermisos, permisosEfectivos, type Permiso } from "@/lib/permisos";

export type Rol = "dueno" | "admin" | "vendedor";

export type Sesion = {
  usuario: {
    id: string;
    correo: string;
    nombre: string;
    avatar?: string;
    esAdminPlataforma: boolean;
    /** Dock personalizado (0020). Sin la migración: undefined (el navegador guarda una copia). */
    dock?: PreferenciasDock;
  };
  /** `identidad`: logo, fondo, color de marca y formato de documentos (0012). */
  empresa: { id: string; nombre: string; paleta: PaletaId; identidad: Identidad } | null;
  rol: Rol | null;
  /**
   * Módulos (`modulo:<id>`) y capacidades del usuario: su rol recortado al plan
   * de la empresa (0023). undefined = sin la migración (se usa lo de siempre por rol).
   */
  permisos?: Permiso[];
  /** Plan vigente de la empresa (0024), para el aviso de «mejorá tu plan». undefined = sin la migración. */
  suscripcion?: {
    estado: string;
    planEfectivo: string;
    planNombre: string | null;
    pruebaHasta: string | null;
  };
  empresas: { id: string; nombre: string; rol: Rol }[];
  /** Demo pública (/demo): datos en memoria, sin cuenta. Cambia «Salir» y muestra la franja de la demo. */
  demo?: boolean;
};

type Membresia = {
  rol: Rol;
  empresas: ({ id: string; nombre: string; paleta: string } & Record<string, unknown>) | null;
};

/**
 * Convierte en membresías las invitaciones pendientes del correo del usuario.
 * Se llama al entrar (/inicio, /bienvenida) antes de leer la sesión.
 */
export async function aceptarInvitaciones() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("aceptar_invitaciones");
  return (data as number | null) ?? 0;
}

/**
 * Correos que pueden ser admin de plataforma (catálogo global). La autoridad
 * real es `usuarios.es_admin_plataforma` en la base (RLS); esto es un segundo
 * candado en la app: además del flag, el correo debe estar en ADMINS_PLATAFORMA
 * (separados por coma). Sin la variable, solo el dueño de Wake Parts.
 */
const ADMINS_PLATAFORMA = (process.env.ADMINS_PLATAFORMA ?? "miltonbarrientos2@gmail.com")
  .split(",")
  .map((c) => c.trim().toLowerCase())
  .filter(Boolean);

export function correoEsAdminPlataforma(correo: string | null | undefined) {
  return !!correo && ADMINS_PLATAFORMA.includes(correo.trim().toLowerCase());
}

/** Lista de correos admin de plataforma (para mostrarla en el módulo Planes). */
export function adminsPlataforma(): readonly string[] {
  return ADMINS_PLATAFORMA;
}

/**
 * La variable ADMINS_PLATAFORMA manda: si el flag de la base no coincide con
 * ella, se corrige con la llave secreta (solo servidor). Así agregar o quitar un
 * admin es solo editar la variable; el flag (que usa RLS) se pone solo al entrar.
 */
async function sincronizarFlagAdmin(id: string, debeSer: boolean) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const llave = process.env.SUPABASE_SECRET_KEY;
  if (!url || !llave) return false;
  try {
    const r = await fetch(`${url}/rest/v1/usuarios?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { apikey: llave, Authorization: `Bearer ${llave}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ es_admin_plataforma: debeSer }),
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) console.warn(`[sesion] no se pudo sincronizar el admin de plataforma: ${r.status}`);
    return r.ok;
  } catch {
    return false;
  }
}

/** Plan vigente de la empresa (0024). undefined si falta la migración. */
async function cargarSuscripcion(
  supabase: Awaited<ReturnType<typeof createClient>>,
  idEmpresa: string,
): Promise<Sesion["suscripcion"]> {
  const { data, error } = await supabase.rpc("mi_suscripcion", { p_empresa: idEmpresa }).maybeSingle();
  if (error || !data) return undefined;
  const d = data as { estado: string; plan_efectivo: string; plan_efectivo_nombre: string | null; prueba_hasta: string | null };
  return {
    estado: d.estado,
    planEfectivo: d.plan_efectivo,
    planNombre: d.plan_efectivo_nombre,
    pruebaHasta: d.prueba_hasta,
  };
}

/** Permisos del rol dentro del plan de la empresa (0023). undefined si falta la migración. */
async function cargarPermisos(
  supabase: Awaited<ReturnType<typeof createClient>>,
  idEmpresa: string,
  rol: Rol,
): Promise<Permiso[] | undefined> {
  const [plan, delRol] = await Promise.all([
    supabase.rpc("mi_plan", { p_empresa: idEmpresa }).maybeSingle(),
    supabase.from("permisos_roles").select("permisos").eq("rol", rol).maybeSingle(),
  ]);
  if (plan.error || delRol.error) return undefined;
  const modulos = plan.data ? normalizarModulosPlan((plan.data as { modulos: unknown }).modulos) : null;
  const configurados = delRol.data ? normalizarPermisos((delRol.data as { permisos: unknown }).permisos) : null;
  return permisosEfectivos(rol, configurados, modulos);
}

/** Usuario autenticado + perfil + empresa activa. null si no hay sesión. */
export const obtenerSesion = cache(async (): Promise<Sesion | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: perfil }, { data: membresias }] = await Promise.all([
    supabase
      .from("usuarios")
      // «*»: `dock` llega con la migración 0020; sin ella la consulta no falla.
      .select("*")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("empresas_usuarios")
      // «*»: las columnas de identidad llegan con la migración 0012.
      .select("rol, empresas(*)")
      .eq("id_usuario", user.id)
      .eq("activo", true)
      .order("creado_en"),
  ]);

  const lista = ((membresias ?? []) as unknown as Membresia[]).filter((m) => m.empresas);
  const activa =
    lista.find((m) => m.empresas!.id === perfil?.id_empresa_activa) ?? lista[0] ?? null;

  const correo = perfil?.correo ?? user.email ?? "";
  const esAdmin = correoEsAdminPlataforma(correo);
  let flagAdmin = Boolean(perfil?.es_admin_plataforma);
  if (perfil && flagAdmin !== esAdmin && (await sincronizarFlagAdmin(user.id, esAdmin))) flagAdmin = esAdmin;

  const [permisos, suscripcion] = activa
    ? await Promise.all([
        cargarPermisos(supabase, activa.empresas!.id, activa.rol),
        cargarSuscripcion(supabase, activa.empresas!.id),
      ])
    : [undefined, undefined];

  return {
    usuario: {
      id: user.id,
      correo,
      nombre:
        perfil?.nombre ??
        (user.user_metadata?.full_name as string | undefined) ??
        user.email ??
        "Usuario",
      avatar: perfil?.avatar_url ?? (user.user_metadata?.avatar_url as string | undefined),
      esAdminPlataforma: flagAdmin && esAdmin,
      dock: perfil && "dock" in perfil ? normalizarDock(perfil.dock) : undefined,
    },
    empresa: activa
      ? {
          id: activa.empresas!.id,
          nombre: activa.empresas!.nombre,
          paleta: paletaValida(activa.empresas!.paleta),
          identidad: identidadDeFila(activa.empresas),
        }
      : null,
    rol: activa?.rol ?? null,
    permisos,
    suscripcion,
    empresas: lista.map((m) => ({ id: m.empresas!.id, nombre: m.empresas!.nombre, rol: m.rol })),
  };
});
