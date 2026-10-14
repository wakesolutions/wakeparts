"use server";

import { RECURSOS_BUSCABLES, type ResultadoBusqueda } from "@/lib/buscador";
import { consultarRecurso } from "@/lib/recursos/servidor";

/**
 * Búsqueda global (Ctrl/⌘ F): una sola ida al servidor que corre en paralelo la
 * búsqueda rápida de cada recurso pedido. Solo acepta los recursos de
 * FUENTES_BUSQUEDA; la validación de columnas y la autorización (RLS, empresa
 * activa) son las de consultarRecurso. Un recurso que falla simplemente no viene.
 */
export async function buscarGlobal(texto: string, recursos: string[], tamano = 5): Promise<ResultadoBusqueda> {
  const busqueda = String(texto ?? "").trim().slice(0, 80);
  if (busqueda.length < 2) return {};
  const pedidos = [...new Set(recursos)].filter((r) => RECURSOS_BUSCABLES.includes(r));
  const n = Math.min(Math.max(1, Math.floor(tamano) || 5), 25);
  const salida: ResultadoBusqueda = {};
  await Promise.all(
    pedidos.map(async (recurso) => {
      const r = await consultarRecurso(recurso, { busqueda, pagina: 0, tamano: n }).catch(() => null);
      if (r?.ok) salida[recurso] = { filas: r.filas, total: r.total };
    }),
  );
  return salida;
}
