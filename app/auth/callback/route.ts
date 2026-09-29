import { after, NextResponse, type NextRequest } from "next/server";
import { contextoDe, registrar } from "@/lib/registro";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const flowId = searchParams.get("sb_flow_id");
  const contexto = contextoDe(request.headers);

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(
      code,
      flowId ? { flowId } : undefined,
    );
    if (!error) {
      const usuario = data.user;
      // Empresa activa: así el dueño ve los inicios de sesión de su equipo.
      const { data: perfil } = usuario
        ? await supabase.from("usuarios").select("id_empresa_activa").eq("id", usuario.id).maybeSingle()
        : { data: null };
      after(() =>
        registrar({
          tipo: "sesion",
          evento: "sesion.inicio",
          mensaje: `Inició sesión ${usuario?.email ?? ""}`.trim(),
          id_usuario: usuario?.id ?? null,
          correo: usuario?.email ?? null,
          id_empresa: perfil?.id_empresa_activa ?? null,
          ruta: "/auth/callback",
          metodo: "GET",
          datos: {
            proveedor: usuario?.app_metadata?.provider ?? "google",
            primera_vez: usuario?.created_at === usuario?.last_sign_in_at,
          },
          contexto,
        }),
      );
      return NextResponse.redirect(`${origin}/inicio`);
    }
    after(() =>
      registrar({
        tipo: "sesion",
        evento: "sesion.fallo",
        nivel: "aviso",
        mensaje: error.message,
        ruta: "/auth/callback",
        metodo: "GET",
        datos: { codigo: error.code ?? null, estado: error.status ?? null },
        contexto,
      }),
    );
  } else {
    // Google devolvió un error (p. ej. la persona canceló) o llegaron sin código.
    after(() =>
      registrar({
        tipo: "sesion",
        evento: "sesion.fallo",
        nivel: "aviso",
        mensaje: searchParams.get("error_description") ?? searchParams.get("error") ?? "Sin código de autorización",
        ruta: "/auth/callback",
        metodo: "GET",
        datos: { error: searchParams.get("error") },
        contexto,
      }),
    );
  }

  return NextResponse.redirect(`${origin}/?error=auth`);
}
