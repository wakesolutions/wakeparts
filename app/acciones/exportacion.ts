"use server";

import { aplanar, FUENTES_EXPORTACION, type DatosExportacion } from "@/lib/exportacion";
import { registrar } from "@/lib/registro";
import { obtenerSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import type { Resultado } from "@/lib/ventas";

const PAGINA = 1000;
const TOPE_FILAS = 200_000;

/**
 * Todos los datos propios de la empresa activa, por tema, para armar el .zip
 * en el navegador. Solo dueño/admin. Lee con la sesión del usuario: RLS
 * garantiza que solo salen datos de su empresa.
 */
export async function datosExportacion(): Promise<Resultado<{ datos: DatosExportacion }>> {
  const sesion = await obtenerSesion();
  if (!sesion?.empresa) return { ok: false, error: "No hay una empresa activa." };
  if (sesion.rol !== "dueno" && sesion.rol !== "admin") {
    return { ok: false, error: "Solo el dueño o un administrador pueden exportar los datos." };
  }
  const empresa = sesion.empresa.id;
  const supabase = await createClient();
  const hojas: DatosExportacion["hojas"] = [];

  for (const f of FUENTES_EXPORTACION) {
    const filas: Record<string, unknown>[] = [];
    for (let desde = 0; desde < TOPE_FILAS; desde += PAGINA) {
      let q = supabase.from(f.fuente).select(f.seleccion ?? "*");
      q = f.porId ? q.eq("id", empresa) : q.eq("id_empresa", empresa);
      if (f.orden) q = q.order(f.orden);
      const { data, error } = await q.range(desde, desde + PAGINA - 1);
      if (error) {
        console.error("[exportacion]", f.fuente, error);
        return { ok: false, error: `No se pudo leer «${f.archivo}». Intentá de nuevo.` };
      }
      filas.push(...((data ?? []) as unknown as Record<string, unknown>[]).map(aplanar));
      if (!data || data.length < PAGINA) break;
    }
    hojas.push({ archivo: f.archivo, filas });
  }

  await registrar({
    tipo: "accion",
    evento: "empresa.exportar",
    mensaje: "Exportó todos los datos de la empresa",
    id_usuario: sesion.usuario.id,
    correo: sesion.usuario.correo,
    id_empresa: empresa,
    datos: { hojas: hojas.length, filas: hojas.reduce((s, h) => s + h.filas.length, 0) },
  });

  return { ok: true, datos: { empresa: sesion.empresa.nombre, generado: new Date().toISOString(), hojas } };
}
