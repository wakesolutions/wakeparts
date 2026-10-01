"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import {
  acentoValido,
  atenuarValido,
  BUCKET_EMPRESAS,
  normalizarFormato,
  urlArchivoEmpresa,
  type FormatoDocumento,
  type TipoImagenEmpresa,
} from "@/lib/identidad";
import { COOKIE_PALETA, paletaValida, type PaletaId } from "@/lib/paletas";
import { registrar } from "@/lib/registro";
import { obtenerSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

type Resultado<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const TIPOS = new Set(["image/webp", "image/jpeg", "image/png"]);
const MAX_BYTES = 8 * 1024 * 1024;
const COLUMNA: Record<TipoImagenEmpresa, "logo_ruta" | "fondo_ruta"> = { logo: "logo_ruta", fondo: "fondo_ruta" };
const FALTA_MIGRACION = "Falta ejecutar la migración 0012 en la base.";

/** Empresa activa si el usuario es dueño o administrador. */
async function empresaEditable() {
  const sesion = await obtenerSesion();
  if (!sesion?.empresa || !["dueno", "admin"].includes(sesion.rol ?? "")) return null;
  return sesion.empresa.id;
}

/** ¿El error es porque la columna todavía no existe (0012 sin ejecutar)? */
function sinMigracion(error: { code?: string; message?: string } | null) {
  return error?.code === "42703" || error?.code === "PGRST204" || /column .* does not exist/i.test(error?.message ?? "");
}

async function borrarArchivo(ruta: string | null | undefined) {
  if (!ruta) return;
  const supabase = await createClient();
  const { error } = await supabase.storage.from(BUCKET_EMPRESAS).remove([ruta]);
  if (error) console.error("[identidad] borrar archivo", error);
}

async function rutaActual(empresa: string, tipo: TipoImagenEmpresa) {
  const supabase = await createClient();
  const { data } = await supabase.from("empresas").select(COLUMNA[tipo]).eq("id", empresa).maybeSingle();
  return ((data as Record<string, string | null> | null)?.[COLUMNA[tipo]] ?? null) as string | null;
}

/** Sube el logo o el fondo (ya reducido a WebP en el navegador) y reemplaza el anterior. */
export async function subirImagenEmpresa(datos: FormData): Promise<Resultado<{ url: string }>> {
  const empresa = await empresaEditable();
  if (!empresa) return { ok: false, error: "Solo el dueño o un administrador pueden cambiar la apariencia." };

  const tipo = datos.get("tipo");
  const archivo = datos.get("archivo");
  if ((tipo !== "logo" && tipo !== "fondo") || !(archivo instanceof File)) return { ok: false, error: "Datos incompletos." };
  if (!TIPOS.has(archivo.type) || archivo.size === 0 || archivo.size > MAX_BYTES) {
    return { ok: false, error: "La imagen debe ser JPG, PNG o WebP de menos de 8 MB." };
  }

  const anterior = await rutaActual(empresa, tipo);
  const ruta = `${empresa}/${tipo}/${randomUUID()}.${archivo.type.split("/")[1].replace("jpeg", "jpg")}`;

  const supabase = await createClient();
  const subida = await supabase.storage
    .from(BUCKET_EMPRESAS)
    .upload(ruta, archivo, { cacheControl: "31536000", upsert: false, contentType: archivo.type });
  if (subida.error) {
    console.error("[subirImagenEmpresa]", subida.error);
    await registrar({
      tipo: "error",
      evento: "identidad.subir",
      nivel: "error",
      mensaje: subida.error.message,
      id_empresa: empresa,
      datos: { tipo },
    });
    return {
      ok: false,
      error: /bucket/i.test(subida.error.message) ? FALTA_MIGRACION : "No se pudo subir la imagen. Intentá de nuevo.",
    };
  }

  const { error } = await supabase.from("empresas").update({ [COLUMNA[tipo]]: ruta }).eq("id", empresa);
  if (error) {
    console.error("[subirImagenEmpresa] guardar", error);
    await borrarArchivo(ruta);
    return { ok: false, error: sinMigracion(error) ? FALTA_MIGRACION : "No se pudo guardar la imagen." };
  }
  await borrarArchivo(anterior);
  return { ok: true, url: urlArchivoEmpresa(ruta)! };
}

/** Quita el logo o vuelve al fondo de Wake Parts. */
export async function quitarImagenEmpresa(tipo: TipoImagenEmpresa): Promise<Resultado> {
  const empresa = await empresaEditable();
  if (!empresa) return { ok: false, error: "Solo el dueño o un administrador pueden cambiar la apariencia." };
  if (tipo !== "logo" && tipo !== "fondo") return { ok: false, error: "Datos incompletos." };

  const anterior = await rutaActual(empresa, tipo);
  const supabase = await createClient();
  const { error } = await supabase.from("empresas").update({ [COLUMNA[tipo]]: null }).eq("id", empresa);
  if (error) return { ok: false, error: sinMigracion(error) ? FALTA_MIGRACION : "No se pudo restablecer." };
  await borrarArchivo(anterior);
  return { ok: true };
}

/** Tema de la empresa: paleta base, color de marca (null = el de la paleta) y atenuación del fondo. */
export async function guardarApariencia(valores: {
  paleta: PaletaId;
  acento: string | null;
  atenuar: number;
}): Promise<Resultado> {
  const empresa = await empresaEditable();
  if (!empresa) return { ok: false, error: "Solo el dueño o un administrador pueden cambiar la apariencia." };

  const paleta = paletaValida(valores.paleta);
  const supabase = await createClient();
  const { error } = await supabase
    .from("empresas")
    .update({ paleta, acento: acentoValido(valores.acento), fondo_atenuar: atenuarValido(valores.atenuar) })
    .eq("id", empresa);
  if (error) {
    console.error("[guardarApariencia]", error);
    return { ok: false, error: sinMigracion(error) ? FALTA_MIGRACION : "No se pudo guardar la apariencia." };
  }
  // La cookie es solo caché de la paleta para pintar sin parpadeo (ver /cookies).
  (await cookies()).set(COOKIE_PALETA, paleta, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return { ok: true };
}

/** Diseño de facturas y cotizaciones. Se normaliza: lo fiscal no se puede ocultar. */
export async function guardarFormatoDocumento(formato: FormatoDocumento): Promise<Resultado> {
  const empresa = await empresaEditable();
  if (!empresa) return { ok: false, error: "Solo el dueño o un administrador pueden cambiar el formato." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("empresas")
    .update({ formato_documento: normalizarFormato(formato) })
    .eq("id", empresa);
  if (error) {
    console.error("[guardarFormatoDocumento]", error);
    return { ok: false, error: sinMigracion(error) ? FALTA_MIGRACION : "No se pudo guardar el formato." };
  }
  return { ok: true };
}
