import { buscarGlobal } from "@/app/acciones/buscador";

/** Búsqueda global del escritorio (la demo inyecta una versión en memoria). */
export type ApiBuscador = {
  buscar: typeof buscarGlobal;
};

export const apiBuscador: ApiBuscador = {
  buscar: buscarGlobal,
};
