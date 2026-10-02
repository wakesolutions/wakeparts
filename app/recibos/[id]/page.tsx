import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { leerRecibo } from "@/app/acciones/cobros";
import { BarraImpresion } from "@/app/documentos/[id]/barra-impresion";
import { ReciboVista } from "@/components/cobros/recibo-vista";
import { TiraRecibo } from "@/components/impresion/tira";
import { identidadDeFila, papelDe } from "@/lib/identidad";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Recibo", robots: { index: false, follow: false } };

/** Vista imprimible de un recibo de abono (RLS: solo miembros de la empresa). */
export default async function PaginaRecibo(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ papel?: string }>;
}) {
  const [{ id }, { papel: pedido }] = await Promise.all([props.params, props.searchParams]);
  const recibo = await leerRecibo(id);
  if (!recibo) notFound();

  const supabase = await createClient();
  const { data } = await supabase.from("pagos").select("empresas(*)").eq("id", id).maybeSingle();
  const identidad = identidadDeFila((data as { empresas?: Record<string, unknown> | null } | null)?.empresas);
  const papel = papelDe(pedido, identidad.formato);

  return (
    <main className="min-h-dvh px-3 py-6 sm:px-8 print:p-0">
      <BarraImpresion titulo={`Recibo ${recibo.numero}`} papel={papel} />
      {papel === "ticket" ? <TiraRecibo recibo={recibo} identidad={identidad} /> : <ReciboVista recibo={recibo} identidad={identidad} />}
    </main>
  );
}
