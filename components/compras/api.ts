import {
  anularCompra,
  anularPagoProveedor,
  buscarProveedores,
  carteraProveedores,
  crearProveedor,
  estadoProveedor,
  leerCompra,
  leerPagoProveedor,
  registrarCompra,
  registrarPagoProveedor,
} from "@/app/acciones/compras";
import { estadoCaja } from "@/app/acciones/caja";

/** Acceso a datos de compras y cuentas por pagar (ver components/datos/apis.tsx). */
export const apiCompras = {
  proveedores: buscarProveedores,
  crearProveedor,
  registrar: registrarCompra,
  compra: leerCompra,
  anular: anularCompra,
  cartera: carteraProveedores,
  estadoProveedor,
  pagar: registrarPagoProveedor,
  pago: leerPagoProveedor,
  anularPago: anularPagoProveedor,
  /** ¿Hay caja abierta en mi punto? (para «Sale de la caja»). */
  cajaAbierta: async () => {
    const e = await estadoCaja();
    return e.turno ? { punto: e.punto?.nombre ?? "", turno: e.turno.numero } : null;
  },
};

export type ApiCompras = typeof apiCompras;
