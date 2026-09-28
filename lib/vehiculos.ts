/** Tipos del catálogo de vehículos compartidos por el selector y la compatibilidad. */

export type NivelVehiculo = "marca" | "modelo" | "anio" | "especificacion";

export type ItemVehiculo = { id: number; nombre: string; detalle?: string };

export type SugerenciaVehiculo = {
  id_marca: number;
  marca: string;
  id_modelo: number;
  modelo: string;
  id_modelo_anio: number | null;
  anio: number | null;
  anio_desde: number | null;
  anio_hasta: number | null;
};

/** Vehículo elegido (cualquier nivel). Los nombres son para mostrar. */
export type Vehiculo = {
  marca?: { id: number; nombre: string };
  modelo?: { id: number; nombre: string };
  anio?: { id: number; nombre: string };
  motor?: { id: number; nombre: string; detalle?: string };
};

export function textoVehiculo(v: Vehiculo | null | undefined) {
  if (!v?.marca) return "";
  return [v.marca.nombre, v.modelo?.nombre, v.anio?.nombre, v.motor ? `· ${v.motor.nombre}` : ""]
    .filter(Boolean)
    .join(" ");
}

/** Fila de compatibilidad asignada a un producto. */
export type FilaCompat = {
  id: number;
  nivel: 1 | 2 | 3 | 4;
  id_marca: number;
  marca: string;
  id_modelo: number | null;
  modelo: string | null;
  id_modelo_anio: number | null;
  anio: number | null;
  id_especificacion: number | null;
  especificacion: string | null;
};

export const NIVELES: readonly NivelVehiculo[] = ["marca", "modelo", "anio", "especificacion"];

/** «2003–2006, 2008» */
export function rangosDeAnios(anios: number[]) {
  const orden = [...new Set(anios)].sort((a, b) => a - b);
  const partes: string[] = [];
  for (let i = 0; i < orden.length; i++) {
    let j = i;
    while (j + 1 < orden.length && orden[j + 1] === orden[j] + 1) j++;
    partes.push(j > i ? `${orden[i]}–${orden[j]}` : String(orden[i]));
    i = j;
  }
  return partes.join(", ");
}
