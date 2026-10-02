import {
  anularAbono,
  carteraPendiente,
  creditoCliente,
  estadoDeCuenta,
  leerRecibo,
  registrarAbono,
} from "@/app/acciones/cobros";

/** Acceso a datos de cuentas por cobrar (ver components/datos/apis.tsx). */
export const apiCobros = {
  cartera: carteraPendiente,
  credito: creditoCliente,
  estadoDeCuenta,
  registrarAbono,
  anularAbono,
  recibo: leerRecibo,
  /** Página imprimible del recibo. */
  urlRecibo: (id: string) => `/recibos/${id}`,
};

export type ApiCobros = typeof apiCobros;
