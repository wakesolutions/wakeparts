import {
  cambiarCompatibilidades,
  copiarCompatibilidades,
  leerCompatibilidades,
} from "@/app/acciones/productos";
import { buscarVehiculos, listarAnios, listarMarcas, listarModelos, listarMotores } from "@/app/acciones/vehiculos";
import type { FilaCompat, ItemVehiculo, NivelVehiculo, SugerenciaVehiculo } from "@/lib/vehiculos";

/**
 * Acceso a datos del editor de compatibilidad y del selector de vehículos.
 * La implementación real son Server Actions; el sandbox /dev inyecta una en memoria.
 */
export type ApiCompatibilidad = {
  leer(idProducto: number): Promise<FilaCompat[]>;
  cambiar(idProducto: number, nivel: NivelVehiculo, ids: number[], asignar: boolean): Promise<{ ok: true } | { ok: false; error: string }>;
  copiar(origen: number, destino: number): Promise<{ ok: true } | { ok: false; error: string }>;
};

export type ApiCatalogoVehiculos = {
  marcas(): Promise<ItemVehiculo[]>;
  modelos(idMarca: number): Promise<ItemVehiculo[]>;
  anios(idModelo: number): Promise<ItemVehiculo[]>;
  motores(idModeloAnio: number): Promise<ItemVehiculo[]>;
  buscar(texto: string): Promise<SugerenciaVehiculo[]>;
};

export const apiCompatibilidad: ApiCompatibilidad = {
  leer: leerCompatibilidades,
  cambiar: cambiarCompatibilidades,
  copiar: copiarCompatibilidades,
};

// El catálogo casi no cambia: se cachea por sesión de página.
const cache = new Map<string, Promise<unknown>>();
function conCache<T>(clave: string, cargar: () => Promise<T>): Promise<T> {
  let p = cache.get(clave) as Promise<T> | undefined;
  if (!p) {
    p = cargar();
    p.catch(() => cache.delete(clave));
    cache.set(clave, p);
  }
  return p;
}

export const catalogoVehiculos: ApiCatalogoVehiculos = {
  marcas: () => conCache("marcas", listarMarcas),
  modelos: (id) => conCache(`modelos:${id}`, () => listarModelos(id)),
  anios: (id) => conCache(`anios:${id}`, () => listarAnios(id)),
  motores: (id) => conCache(`motores:${id}`, () => listarMotores(id)),
  buscar: buscarVehiculos,
};
