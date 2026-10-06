import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { normalizarDock, type PreferenciasDock } from "@/lib/dock";
import { identidadDeFila, type Identidad } from "@/lib/identidad";
import { paletaValida, type PaletaId } from "@/lib/paletas";

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

  return {
    usuario: {
      id: user.id,
      correo: perfil?.correo ?? user.email ?? "",
      nombre:
        perfil?.nombre ??
        (user.user_metadata?.full_name as string | undefined) ??
        user.email ??
        "Usuario",
      avatar: perfil?.avatar_url ?? (user.user_metadata?.avatar_url as string | undefined),
      esAdminPlataforma: Boolean(perfil?.es_admin_plataforma) && correoEsAdminPlataforma(perfil?.correo ?? user.email),
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
    empresas: lista.map((m) => ({ id: m.empresas!.id, nombre: m.empresas!.nombre, rol: m.rol })),
  };
});
