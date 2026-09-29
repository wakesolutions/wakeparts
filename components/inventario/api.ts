import { importarProductos, registrarEntrada } from "@/app/acciones/inventario";
import { buscarMostrador } from "@/app/acciones/ventas";

/** Entradas de inventario e importación (ver components/datos/apis.tsx). */
export const apiInventario = {
  /** Busca productos para una entrada (misma búsqueda del mostrador, sin vehículo). */
  buscar: (texto: string) => buscarMostrador({ texto, vehiculo: {} }),
  entrada: registrarEntrada,
  importar: importarProductos,
};

export type ApiInventario = typeof apiInventario;
