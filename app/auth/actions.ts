"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { contextoDe, registrar } from "@/lib/registro";
import { createClient } from "@/lib/supabase/server";

async function origen() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return process.env.NEXT_PUBLIC_SITE_URL!;
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function iniciarSesionConGoogle() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${await origen()}/auth/callback`,
      queryParams: { prompt: "select_account" },
    },
  });

  if (error || !data.url) {
    const contexto = contextoDe(await headers());
    after(() =>
      registrar({
        tipo: "sesion",
        evento: "sesion.fallo",
        nivel: "error",
        mensaje: error?.message ?? "Google no devolvió la URL de inicio de sesión",
        ruta: "/",
        metodo: "POST",
        datos: { paso: "iniciar con Google" },
        contexto,
      }),
    );
    redirect("/?error=oauth");
  }
  redirect(data.url);
}

export async function cerrarSesion() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims as { sub?: string; email?: string } | undefined;
  const { data: perfil } = claims?.sub
    ? await supabase.from("usuarios").select("id_empresa_activa").eq("id", claims.sub).maybeSingle()
    : { data: null };
  await supabase.auth.signOut();
  const contexto = contextoDe(await headers());
  after(() =>
    registrar({
      tipo: "sesion",
      evento: "sesion.cierre",
      mensaje: `Cerró sesión ${claims?.email ?? ""}`.trim(),
      id_usuario: claims?.sub ?? null,
      correo: claims?.email ?? null,
      id_empresa: perfil?.id_empresa_activa ?? null,
      metodo: "POST",
      contexto,
    }),
  );
  redirect("/");
}
