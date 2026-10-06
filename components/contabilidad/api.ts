import {
  aperturaInventario,
  balanza,
  cerrarPeriodo,
  contabilizarPendientes,
  crearAsiento,
  cuentasDetalle,
  diario,
  leerAsiento,
  mayor,
  periodos,
  reabrirPeriodo,
  revertirAsiento,
} from "@/app/acciones/contabilidad";

/** Acceso a datos de la contabilidad (ver components/datos/apis.tsx). */
export const apiContabilidad = {
  diario,
  asiento: leerAsiento,
  cuentas: cuentasDetalle,
  crearAsiento,
  revertir: revertirAsiento,
  balanza,
  mayor,
  periodos,
  cerrarPeriodo,
  reabrirPeriodo,
  contabilizarPendientes,
  aperturaInventario,
};

export type ApiContabilidad = typeof apiContabilidad;
