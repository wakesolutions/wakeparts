"use server";

import {
  buscarOpciones,
  consultarRecurso,
  eliminarRecurso,
  guardarRecurso,
  leerRegistro,
} from "@/lib/recursos/servidor";
import type { Consulta, Valores } from "@/lib/recursos/tipos";

// Puntos de entrada públicos: toda la validación vive en lib/recursos/servidor.ts
// y la autorización real en RLS.

export async function accionConsultar(recurso: string, consulta: Consulta) {
  return consultarRecurso(recurso, consulta);
}

export async function accionOpciones(
  recurso: string,
  opciones: Parameters<typeof buscarOpciones>[1],
) {
  return buscarOpciones(recurso, opciones);
}

export async function accionLeer(recurso: string, clave: string | number) {
  return leerRegistro(recurso, clave);
}

export async function accionGuardar(recurso: string, clave: string | number | null, valores: Valores) {
  return guardarRecurso(recurso, clave, valores);
}

export async function accionEliminar(recurso: string, clave: string | number) {
  return eliminarRecurso(recurso, clave);
}
