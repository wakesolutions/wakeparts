import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { leerTurno } from "@/app/acciones/caja";
import { BarraImpresion } from "@/app/documentos/[id]/barra-impresion";
import { CorteVista } from "@/components/caja/corte-vista";
import { identidadDeFila } from "@/lib/identidad";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Corte de caja", robots: { index: false, follow: false } };

/** Vista imprimible del corte de un turno de caja (RLS: solo miembros de la empresa). */
export default async function PaginaCorte(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const turno = await leerTurno(id);
  if (!turno) notFound();

  const supabase = await createClient();
  const { data } = await supabase.from("cajas_turnos").select("empresas(*)").eq("id", id).maybeSingle();
  const identidad = identidadDeFila((data as { empresas?: Record<string, unknown> | null } | null)?.empresas);

  return (
    <main className="min-h-dvh px-3 py-6 sm:px-8 print:p-0">
      <BarraImpresion titulo={`Corte de caja · turno ${turno.numero}`} />
      <CorteVista turno={turno} identidad={identidad} />
    </main>
  );
}
