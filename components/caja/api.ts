import { abrirCaja, cambiarCajaObligatoria, cerrarCaja, estadoCaja, leerTurno, movimientoCaja } from "@/app/acciones/caja";

/** Acceso a datos de la caja (ver components/datos/apis.tsx). */
export const apiCaja = {
  estado: estadoCaja,
  turno: leerTurno,
  abrir: abrirCaja,
  movimiento: movimientoCaja,
  cerrar: cerrarCaja,
  obligatoria: cambiarCajaObligatoria,
  /** Página imprimible del corte de caja. */
  urlCorte: (id: string) => `/cortes/${id}`,
};

export type ApiCaja = typeof apiCaja;
