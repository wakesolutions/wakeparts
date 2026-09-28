import {
  actualizarCarrito,
  actualizarLinea,
  agregarLinea,
  anularDocumento,
  buscarClientes,
  buscarMostrador,
  carritoDesdeDocumento,
  crearCarrito,
  crearCliente,
  descartarCarrito,
  emitirDocumento,
  leerDocumento,
  listarCarritos,
  listarLineas,
  quitarLinea,
} from "@/app/acciones/ventas";

/** Acceso a datos del mostrador (ver components/datos/apis.tsx). */
export const apiVentas = {
  buscar: buscarMostrador,
  carritos: listarCarritos,
  crearCarrito,
  actualizarCarrito,
  descartarCarrito,
  lineas: listarLineas,
  agregarLinea,
  actualizarLinea,
  quitarLinea,
  clientes: buscarClientes,
  crearCliente,
  emitir: emitirDocumento,
  documento: leerDocumento,
  carritoDesdeDocumento,
  anular: anularDocumento,
  /** Página imprimible del documento. */
  urlImpresion: (id: string) => `/documentos/${id}`,
};

export type ApiVentas = typeof apiVentas;
