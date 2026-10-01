import {
  atenderPedidoWeb,
  buscarParaDestacar,
  cambiarEstadoPedidoWeb,
  contarPedidosNuevos,
  guardarSitio,
  leerDestacados,
  leerPedidoWeb,
  leerSitioEditor,
  quitarFotoSitio,
  subirFotoSitio,
  type EstadoSitio,
  type PedidoWeb,
  type ProductoElegible,
} from "@/app/acciones/sitio-web";
import type { ConfigSitio } from "@/lib/sitio-web";

export type { EstadoSitio, PedidoWeb, ProductoElegible };

type Resultado<T = object> = ({ ok: true } & T) | { ok: false; error: string };

/** Sitio web del taller y sus pedidos (el sandbox inyecta una versión en memoria). */
export type ApiSitioWeb = {
  leer(): Promise<Resultado<{ sitio: EstadoSitio }>>;
  guardar(cambio: { slug?: string; publicado?: boolean; config?: Partial<ConfigSitio> }): Promise<Resultado<{ sitio: EstadoSitio }>>;
  subirFoto(datos: FormData): Promise<Resultado<{ sitio: EstadoSitio }>>;
  quitarFoto(ruta: string): Promise<Resultado<{ sitio: EstadoSitio }>>;
  buscarProductos(texto: string): Promise<ProductoElegible[]>;
  destacados(ids: number[]): Promise<ProductoElegible[]>;
  pedido(id: string): Promise<PedidoWeb | null>;
  atender(id: string): Promise<Resultado<{ carrito: string }>>;
  cambiarEstado(id: string, estado: "nuevo" | "descartado"): Promise<Resultado>;
  pedidosNuevos(): Promise<number>;
};

export const apiSitioWeb: ApiSitioWeb = {
  leer: leerSitioEditor,
  guardar: guardarSitio,
  subirFoto: subirFotoSitio,
  quitarFoto: quitarFotoSitio,
  buscarProductos: buscarParaDestacar,
  destacados: leerDestacados,
  pedido: leerPedidoWeb,
  atender: atenderPedidoWeb,
  cambiarEstado: cambiarEstadoPedidoWeb,
  pedidosNuevos: contarPedidosNuevos,
};
