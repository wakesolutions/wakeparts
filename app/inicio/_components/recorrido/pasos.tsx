import type { ReactNode } from "react";
import type { Ventana } from "@/components/ventanas/contexto";
import type { Sesion } from "@/lib/sesion";

export type ContextoPaso = {
  ventanas: Ventana[];
  sesion: Sesion;
  abrir: (id: string) => void;
  minimizarTodas: () => void;
};

export type Paso = {
  id: string;
  titulo: string;
  texto: ReactNode;
  /** Selector del elemento a iluminar. Sin objetivo (o si no está en pantalla) la tarjeta va al centro. */
  objetivo?: string;
  /** Deja la pantalla lista antes de mostrar el paso (abrir o minimizar ventanas). */
  preparar?: (c: ContextoPaso) => void;
  /** Si el usuario hizo lo que pide el paso, se avanza solo. */
  listo?: (c: ContextoPaso) => boolean;
  /** Pasos que solo aplican a algunos roles. */
  aplica?: (c: Pick<ContextoPaso, "sesion">) => boolean;
};

const abierta = (c: ContextoPaso, id: string) => c.ventanas.some((v) => v.id === id && v.estado !== "minimizada");
const administra = ({ sesion }: Pick<ContextoPaso, "sesion">) => sesion.rol === "dueno" || sesion.rol === "admin";
const enMostrador = (c: ContextoPaso) => {
  if (!abierta(c, "cotizar")) c.abrir("cotizar");
};

const K = ({ children }: { children: ReactNode }) => <kbd>{children}</kbd>;

/** Recorrido de bienvenida: las operaciones básicas, en el orden en que se hacen en mostrador. */
export const PASOS: Paso[] = [
  {
    id: "bienvenida",
    titulo: "Bienvenido a tu tablero",
    texto: (
      <>
        En dos minutos te muestro lo básico: atender a un cliente, cotizar, facturar y dónde está tu inventario.
        Podés tocar lo que te señale mientras avanzamos.
      </>
    ),
    preparar: (c) => c.minimizarTodas(),
  },
  {
    id: "dock-cotizar",
    titulo: "Cada módulo es una app",
    texto: (
      <>
        El dock de abajo tiene los módulos. Empecemos por el mostrador: <strong>tocá Cotizar y facturar</strong>.
      </>
    ),
    objetivo: '[data-dock="cotizar"]',
    listo: (c) => abierta(c, "cotizar"),
  },
  {
    id: "carritos",
    titulo: "Un carrito por cliente",
    texto: (
      <>
        Cada cliente que atendés es un carrito. Con <strong>+</strong> abrís otro; quedan guardados aunque cierres o
        cambies de computadora.
      </>
    ),
    objetivo: '[data-recorrido="carritos"]',
    preparar: enMostrador,
  },
  {
    id: "vehiculo",
    titulo: "Primero, el vehículo",
    texto: (
      <>
        Tocá la placa (o <K>F4</K>) y escribí como habla el cliente: <em>hilux 2010</em>. Así la búsqueda sabe qué le
        queda.
      </>
    ),
    objetivo: '[data-recorrido="vehiculo"]',
    preparar: enMostrador,
  },
  {
    id: "buscar",
    titulo: "Buscá como sea",
    texto: (
      <>
        Nombre, código, OEM o equivalencia, con errores y todo: <em>pastiyas</em> encuentra pastillas. <K>F2</K> o{" "}
        <K>/</K> te traen aquí desde cualquier parte.
      </>
    ),
    objetivo: '[data-recorrido="buscar"]',
    preparar: enMostrador,
  },
  {
    id: "resultados",
    titulo: "Lo que le queda, primero",
    texto: (
      <>
        Verde: le queda. Ámbar: verificá año o motor. Después los productos generales y complementos sugeridos. Tocá{" "}
        <strong>+</strong> o <K>Enter</K> para agregar al carrito.
      </>
    ),
    objetivo: '[data-recorrido="resultados"]',
    preparar: enMostrador,
  },
  {
    id: "ticket",
    titulo: "El carrito",
    texto: (
      <>
        Cambiá cantidades, precio o descuento por línea. <strong>Línea libre</strong> sirve para mano de obra o una
        pieza sin registrar. Abajo, el descuento general y el total con ISV.
      </>
    ),
    objetivo: '[data-recorrido="ticket"]',
    preparar: enMostrador,
  },
  {
    id: "cliente",
    titulo: "¿A nombre de quién?",
    texto: (
      <>
        Tocá aquí para buscar o crear el cliente. Con RTN sale en la factura; si no, queda como consumidor final.
      </>
    ),
    objetivo: '[data-recorrido="cliente"]',
    preparar: enMostrador,
  },
  {
    id: "emitir",
    titulo: "Cotizar o facturar",
    texto: (
      <>
        <strong>Cotizar</strong> guarda una cotización válida 15 días. <strong>Facturar</strong> (<K>F9</K>) usa el
        siguiente número de tu CAI y descuenta existencias. Sin CAI registrado solo se puede cotizar.
      </>
    ),
    objetivo: '[data-recorrido="emitir"]',
    preparar: enMostrador,
  },
  {
    id: "minimizar",
    titulo: "Volver al escritorio",
    texto: (
      <>
        Las ventanas abren en grande. El botón <strong>ámbar</strong> la minimiza al dock; el verde la vuelve
        flotante. <strong>Tocá el ámbar</strong>.
      </>
    ),
    objetivo: 'section[role="dialog"][data-activa] [data-luz="minimizar"]',
    preparar: enMostrador,
    listo: (c) => c.ventanas.some((v) => v.id === "cotizar" && v.estado === "minimizada"),
  },
  {
    id: "dock-inventario",
    titulo: "Inventario",
    texto: (
      <>
        Tus productos con fotos, los vehículos a los que les quedan, existencias mínimas y el kardex de cada
        movimiento.
      </>
    ),
    objetivo: '[data-dock="inventario"]',
    preparar: (c) => c.minimizarTodas(),
  },
  {
    id: "dock-ventas",
    titulo: "Ventas",
    texto: (
      <>
        Las cotizaciones y facturas emitidas (para reimprimir, pasar a carrito o anular), tus clientes y el{" "}
        <strong>CAI</strong>: registralo aquí antes de facturar.
      </>
    ),
    objetivo: '[data-dock="ventas"]',
    preparar: (c) => c.minimizarTodas(),
  },
  {
    id: "dock-usuarios",
    titulo: "Tu equipo",
    texto: <>Invitá a tus vendedores con su correo de Google y dales un rol. A quien se va, se le desactiva.</>,
    objetivo: '[data-dock="usuarios"]',
    preparar: (c) => c.minimizarTodas(),
    aplica: administra,
  },
  {
    id: "dock-taller",
    titulo: "Tu taller",
    texto: (
      <>
        Los datos que salen en tus facturas, el tope de descuento de los vendedores y el botón de{" "}
        <strong>datos de ejemplo</strong> para practicar.
      </>
    ),
    objetivo: '[data-dock="taller"]',
    preparar: (c) => c.minimizarTodas(),
  },
  {
    id: "manual",
    titulo: "Todo está en el manual",
    texto: (
      <>
        Si te perdés, el <strong>manual</strong> explica cada módulo. Y este recorrido se repite desde{" "}
        <em>Mi usuario</em> (tu nombre, aquí al lado).
      </>
    ),
    objetivo: 'a[href="/ayuda"]',
    preparar: (c) => c.minimizarTodas(),
  },
];
