import "server-only";
import { unstable_cache } from "next/cache";
import { clienteServicio } from "@/lib/suscripcion-servidor";

/**
 * Planes para la sección «Precios» de la portada. Salen de la tabla `planes`
 * (lo que el admin edita en el módulo Planes), así la landing nunca dice un
 * precio distinto al que se cobra. `planes_publicos()` pide sesión, por eso se
 * lee con la llave secreta y solo columnas publicables.
 */
export type PlanLanding = {
  codigo: string;
  nombre: string;
  etiqueta: string | null;
  precio_mensual: number | null;
  precio_anual: number | null;
  caracteristicas: string[];
};

export const leerPlanesLanding = unstable_cache(
  async (): Promise<PlanLanding[]> => {
    try {
      const { data, error } = await clienteServicio()
        .from("planes")
        .select("codigo, nombre, etiqueta, precio_mensual, precio_anual, caracteristicas")
        .eq("activo", true)
        .eq("publico", true)
        .eq("solo_admins", false)
        .order("orden");
      if (error) return [];
      return (data ?? []).map((p) => ({
        ...p,
        precio_mensual: p.precio_mensual === null ? null : Number(p.precio_mensual),
        precio_anual: p.precio_anual === null ? null : Number(p.precio_anual),
        caracteristicas: p.caracteristicas ?? [],
      }));
    } catch {
      return [];
    }
  },
  ["planes-landing"],
  { revalidate: 600, tags: ["planes"] },
);
