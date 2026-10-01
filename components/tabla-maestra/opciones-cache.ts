"use client";

import { useEffect, useState } from "react";
import { useApi } from "@/components/datos/apis";
import type { ApiRecursos } from "@/components/datos/api-recursos";
import type { FuenteOpciones, Opcion } from "@/lib/recursos/tipos";

const cache = new Map<string, Promise<Opcion[]>>();

/** Opciones completas de una fuente (para filtros). Se cachean por sesión de página. */
export function cargarOpcionesFuente(fuente: FuenteOpciones, opciones: ApiRecursos["opciones"]): Promise<Opcion[]> {
  const clave = `${fuente.recurso}|${fuente.valor}|${String(fuente.etiqueta)}|${JSON.stringify(fuente.fijo ?? null)}`;
  let p = cache.get(clave);
  if (!p) {
    p = opciones(fuente.recurso, { valor: fuente.valor, etiqueta: fuente.etiqueta, fijo: fuente.fijo, limite: 500 });
    p.catch(() => cache.delete(clave));
    cache.set(clave, p);
  }
  return p;
}

/** Olvida las opciones cacheadas de un recurso (tras crear/editar/eliminar). */
export function invalidarOpciones(recurso: string) {
  for (const k of cache.keys()) if (k.startsWith(`${recurso}|`)) cache.delete(k);
}

export function useOpcionesFuente(fuente: FuenteOpciones | undefined) {
  const api = useApi("recursos");
  const [opciones, setOpciones] = useState<Opcion[] | null>(null);
  useEffect(() => {
    if (!fuente) return;
    let vivo = true;
    cargarOpcionesFuente(fuente, api.opciones).then((o) => vivo && setOpciones(o));
    return () => {
      vivo = false;
    };
  }, [api, fuente]);
  return opciones;
}
