import type { Enlace } from "./notificaciones";
import type { Fila } from "./recursos/tipos";

/**
 * Búsqueda global del escritorio (Ctrl/⌘ F): destinos fijos (módulos, secciones
 * y acciones) que se filtran en el navegador, y fuentes de datos (documentos,
 * productos, clientes…) que se consultan con la búsqueda rápida de cada recurso.
 *
 * Una sección nueva de un módulo = una entrada en DESTINOS. Una fuente nueva =
 * una entrada en FUENTES_BUSQUEDA (el recurso debe tener columnas `buscable`)
 * y, si su lista no abre el registro sola, que use MantenimientoRecurso
 * (toma el «ir a» de lib/ir-a.ts).
 */

/* ------------------------------------------------------------- destinos --- */

export type Destino = {
  /** Clave única (para recientes). */
  id: string;
  titulo: string;
  /** Dónde está: «Ventas», «Inventario › Catálogos». */
  lugar: string;
  /** Módulo que abre (y del que toma el ícono y la visibilidad). */
  modulo: string;
  /** Sección de ModuloTablas que muestra al abrir. */
  seccion?: string;
  /** Sinónimos y palabras con que la gente lo busca. */
  claves?: string;
  /** Acción (crear algo) en vez de un lugar: se lista en «Acciones rápidas». */
  accion?: boolean;
};

const S = (
  modulo: string,
  lugar: string,
  seccion: string,
  titulo: string,
  claves?: string,
  accion?: boolean,
): Destino => ({ id: `${modulo}/${seccion}`, modulo, lugar, seccion, titulo, claves, accion });

/** Secciones y acciones de cada módulo (los módulos en sí salen de MODULOS). */
export const DESTINOS: readonly Destino[] = [
  // Acciones rápidas
  { id: "accion/facturar", modulo: "cotizar", lugar: "Cotizar y facturar", titulo: "Nueva factura o cotización", claves: "vender facturar cotizar carrito mostrador ticket", accion: true },
  S("notas", "Notas", "nueva-nota", "Nueva nota de crédito o débito", "nc nd devolucion rebaja", true),
  S("compras", "Compras", "nueva-compra", "Registrar una compra o gasto", "proveedor gasto factura proveedor", true),
  S("caja", "Caja", "caja-actual", "Abrir o cerrar mi caja", "turno arqueo corte efectivo fondo", true),
  S("contabilidad", "Contabilidad", "nuevo-asiento", "Nuevo asiento contable", "partida diario", true),
  { id: "accion/toma", modulo: "toma", lugar: "Toma rápida", titulo: "Dar de alta productos con foto", claves: "toma rapida telefono camara foto alta", accion: true },

  // Inventario
  S("inventario", "Inventario", "productos", "Productos", "repuestos piezas existencias precios articulos"),
  S("inventario", "Inventario", "movimientos", "Kardex", "movimientos entradas salidas existencias"),
  S("inventario", "Inventario › Catálogos", "marcas_productos", "Marcas de repuestos", "fabricantes"),
  S("inventario", "Inventario › Catálogos", "categorias", "Categorías", "familias grupos"),

  // Ventas
  S("ventas", "Ventas", "documentos", "Documentos emitidos", "facturas cotizaciones notas anular reimprimir"),
  S("ventas", "Ventas", "pedidos_web", "Pedidos web", "sitio catalogo pedidos clientes en linea"),
  S("ventas", "Ventas", "clientes", "Clientes", "rtn contactos"),
  S("ventas", "Ventas › Cobros", "cuentas_clientes", "Cuentas por cobrar", "cxc cartera credito deudas saldos estado de cuenta"),
  S("ventas", "Ventas › Cobros", "pagos", "Abonos y recibos", "rec recibos pagos de clientes"),
  S("ventas", "Ventas › Análisis", "reporte-ventas", "Reporte de ventas", "estadisticas ventas del mes utilidad graficas"),
  S("ventas", "Ventas › Facturación", "puntos_emision", "Puntos de emisión", "sucursales cajas establecimiento"),
  S("ventas", "Ventas › Facturación", "cai", "CAI", "sar rangos autorizados correlativo"),

  // Notas
  S("notas", "Notas", "notas", "Notas emitidas", "notas de credito notas de debito nc nd"),

  // Caja
  S("caja", "Caja", "cajas_turnos", "Turnos de caja", "cortes arqueos historial"),

  // Compras
  S("compras", "Compras", "compras", "Compras registradas", "facturas de proveedores gastos"),
  S("compras", "Compras", "proveedores", "Proveedores"),
  S("compras", "Compras › Por pagar", "cuentas_proveedores", "Cuentas por pagar", "cxp deudas proveedores"),
  S("compras", "Compras › Por pagar", "pagos_proveedores", "Pagos a proveedores"),

  // Contabilidad
  S("contabilidad", "Contabilidad", "dia", "Libro del día", "diario cuadre"),
  S("contabilidad", "Contabilidad", "asientos", "Asientos", "partidas polizas"),
  S("contabilidad", "Contabilidad › Reportes", "balanza", "Balanza de comprobación", "balance resultados estados financieros"),
  S("contabilidad", "Contabilidad › Reportes", "mayor", "Libro mayor"),
  S("contabilidad", "Contabilidad › Configuración", "cuentas_contables", "Catálogo de cuentas", "plan de cuentas"),
  S("contabilidad", "Contabilidad › Configuración", "cierre", "Cierre de mes"),

  // Mantenimiento
  S("mantenimiento", "Mantenimiento", "marcas", "Marcas de vehículos", "fabricantes toyota nissan"),
  S("mantenimiento", "Mantenimiento", "modelos", "Modelos de vehículos"),
  S("mantenimiento", "Mantenimiento", "modelos_anios", "Años de cada modelo"),

  // Usuarios
  S("usuarios", "Usuarios", "miembros", "Equipo", "usuarios vendedores roles permisos"),
  S("usuarios", "Usuarios", "invitaciones", "Invitaciones", "invitar agregar usuario"),
];

/** Palabras extra para los módulos (además de su nombre). */
export const CLAVES_MODULO: Record<string, string> = {
  inicio: "escritorio minimizar todo",
  cotizar: "mostrador vender facturar cotizar carrito pos",
  caja: "efectivo turno arqueo",
  inventario: "productos repuestos existencias stock bodega",
  compras: "proveedores gastos cuentas por pagar",
  toma: "alta rapida camara telefono",
  ventas: "facturas clientes documentos cobros",
  notas: "credito debito devoluciones",
  contabilidad: "asientos balance diario mayor",
  sitio: "pagina web catalogo tienda en linea",
  mantenimiento: "catalogo vehiculos marcas modelos",
  usuarios: "equipo vendedores roles invitar",
  actividad: "registro bitacora auditoria errores",
  suscripcion: "plan pago tarjeta factura wake parts",
  taller: "empresa datos logo apariencia formato factura",
  "mi-usuario": "perfil cuenta nombre recorrido",
};

/* ------------------------------------------------------- fuentes de datos --- */

/** Insignia de un resultado: abreviatura en mono + tono del LED. */
export type Insignia = { texto: string; tono?: "acento" | "ok" | "aviso" | "neutro" };

export type FuenteBusqueda = {
  /** Recurso de lib/recursos (su búsqueda rápida usa las columnas `buscable`). */
  recurso: string;
  /** Título del grupo de resultados y del filtro. */
  grupo: string;
  /** Filtro (chip) al que pertenece. */
  filtro: FiltroBusqueda;
  /** Dónde se abre: el primer módulo visible de la lista. */
  destinos: readonly { modulo: string; seccion: string }[];
  presentar: (f: Fila) => Presentacion;
};

export type Presentacion = {
  titulo: string;
  detalle: string;
  insignia?: Insignia;
  /** Lectura a la derecha (total, precio, saldo). */
  valor?: string;
  /** Segunda lectura bajo el valor (existencia). */
  nota?: { texto: string; tono: "ok" | "aviso" | "apagado" };
  /** Ruta de Storage de la foto (productos). */
  imagen?: string;
  tachado?: boolean;
};

export type FiltroBusqueda = "todo" | "ir" | "documentos" | "productos" | "clientes" | "compras";

export const FILTROS: readonly { id: FiltroBusqueda; nombre: string }[] = [
  { id: "todo", nombre: "Todo" },
  { id: "ir", nombre: "Ir a" },
  { id: "documentos", nombre: "Documentos" },
  { id: "productos", nombre: "Productos" },
  { id: "clientes", nombre: "Clientes" },
  { id: "compras", nombre: "Compras" },
];

const txt = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const num = (v: unknown) => Number(v ?? 0) || 0;
const unir = (...partes: unknown[]) => partes.map(txt).filter(Boolean).join(" · ");
const dia = (v: unknown) => (v ? txt(v).slice(0, 10).split("-").reverse().join("/") : "");
const lempiras = (v: unknown) =>
  `L ${num(v).toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const cantidad = (v: unknown) => num(v).toLocaleString("es-HN", { maximumFractionDigits: 2 });

const INSIGNIA_DOCUMENTO: Record<string, Insignia> = {
  factura: { texto: "FAC", tono: "acento" },
  cotizacion: { texto: "COT", tono: "neutro" },
  nota_credito: { texto: "NC", tono: "aviso" },
  nota_debito: { texto: "ND", tono: "aviso" },
};

export const FUENTES_BUSQUEDA: readonly FuenteBusqueda[] = [
  {
    recurso: "documentos",
    grupo: "Facturas, cotizaciones y notas",
    filtro: "documentos",
    destinos: [
      { modulo: "ventas", seccion: "documentos" },
      { modulo: "notas", seccion: "notas" },
    ],
    presentar: (f) => ({
      titulo: txt(f.numero),
      detalle: unir(f.cliente_nombre || "Consumidor final", dia(f.fecha), f.vehiculo),
      insignia: INSIGNIA_DOCUMENTO[txt(f.tipo)] ?? { texto: "DOC" },
      valor: lempiras(f.total),
      tachado: f.estado === "anulado",
    }),
  },
  {
    recurso: "productos",
    grupo: "Productos",
    filtro: "productos",
    destinos: [{ modulo: "inventario", seccion: "productos" }],
    presentar: (f) => {
      const existencia = num(f.existencia);
      return {
        titulo: txt(f.nombre),
        detalle: unir(f.codigo, f.marca, f.categoria_ruta),
        imagen: txt(f.imagen) || undefined,
        valor: lempiras(f.precio_final ?? f.precio),
        nota: {
          texto: existencia > 0 ? `${cantidad(existencia)} en existencia` : "Sin existencia",
          tono: existencia <= 0 ? "apagado" : f.bajo_minimo ? "aviso" : "ok",
        },
      };
    },
  },
  {
    recurso: "clientes",
    grupo: "Clientes",
    filtro: "clientes",
    destinos: [{ modulo: "ventas", seccion: "clientes" }],
    presentar: (f) => ({
      titulo: txt(f.nombre),
      detalle: unir(f.rtn ? `RTN ${txt(f.rtn)}` : "Sin RTN", f.telefono),
      valor: num(f.saldo) > 0 ? lempiras(f.saldo) : undefined,
      nota: num(f.saldo) > 0 ? { texto: "Saldo", tono: "aviso" } : undefined,
    }),
  },
  {
    recurso: "pagos",
    grupo: "Recibos de abono",
    filtro: "documentos",
    destinos: [{ modulo: "ventas", seccion: "pagos" }],
    presentar: (f) => ({
      titulo: txt(f.numero),
      detalle: unir(f.cliente_nombre, dia(f.fecha), f.facturas),
      insignia: { texto: "REC", tono: "ok" },
      valor: lempiras(f.monto),
      tachado: f.estado === "anulado",
    }),
  },
  {
    recurso: "compras",
    grupo: "Compras y gastos",
    filtro: "compras",
    destinos: [{ modulo: "compras", seccion: "compras" }],
    presentar: (f) => ({
      titulo: unir(f.numero, f.documento),
      detalle: unir(f.proveedor_nombre, dia(f.fecha)),
      insignia: f.tipo === "gasto" ? { texto: "GAS", tono: "neutro" } : { texto: "COM", tono: "ok" },
      valor: lempiras(f.total),
      tachado: f.estado === "anulado",
    }),
  },
  {
    recurso: "proveedores",
    grupo: "Proveedores",
    filtro: "compras",
    destinos: [{ modulo: "compras", seccion: "proveedores" }],
    presentar: (f) => ({
      titulo: txt(f.nombre),
      detalle: unir(f.rtn ? `RTN ${txt(f.rtn)}` : "", f.contacto, f.telefono),
      valor: num(f.saldo) > 0 ? lempiras(f.saldo) : undefined,
      nota: num(f.saldo) > 0 ? { texto: "Le debés", tono: "aviso" } : undefined,
    }),
  },
];

export const RECURSOS_BUSCABLES = FUENTES_BUSQUEDA.map((f) => f.recurso);

/** Resultado del servidor: filas por recurso (los que fallan, p. ej. por permisos, no vienen). */
export type ResultadoBusqueda = Record<string, { filas: Fila[]; total: number }>;

/** Enlace «ir a» de una fila: abre el módulo, la sección y el registro. */
export function enlaceDe(fuente: FuenteBusqueda, fila: Fila, visibles: ReadonlySet<string>): Enlace | null {
  const d = fuente.destinos.find((x) => visibles.has(x.modulo));
  if (!d) return null;
  // Una nota sin acceso a Ventas se abre en el módulo Notas (su recurso es «notas»).
  const recurso = d.modulo === "notas" ? "notas" : fuente.recurso;
  return { modulo: d.modulo, seccion: d.seccion, recurso, id: txt(fila.id) };
}

/* ---------------------------------------------------------- coincidencia --- */

/** Minúsculas sin tildes (ñ incluida en «n»: la gente escribe «compania»). */
const plano = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

export const normalizar = (s: string) => plano(s).trim();

/**
 * Puntaje de un texto contra la consulta: cada palabra de la consulta debe
 * aparecer. Vale más al inicio del título, luego al inicio de una palabra,
 * luego al inicio de una palabra de las claves; las iniciales («cxc», «nc») también cuentan. 0 = no.
 */
export function puntuar(consulta: string, titulo: string, claves = ""): number {
  const q = normalizar(consulta);
  if (!q) return 0;
  const t = normalizar(titulo);
  const k = normalizar(claves);
  const palabrasT = t.split(/[^a-z0-9]+/).filter(Boolean);
  const iniciales = palabrasT.map((p) => p[0]).join("");
  let total = 0;
  if (t.startsWith(q)) total += 120;
  if (iniciales.startsWith(q.replace(/\s+/g, "")) && q.length >= 2) total += 80;
  for (const p of q.split(/\s+/)) {
    if (palabrasT.some((w) => w.startsWith(p))) total += 40;
    else if (t.includes(p)) total += 20;
    else if (k.split(/\s+/).some((w) => w.startsWith(p))) total += 14;
    else if (!(iniciales.startsWith(p) && p.length >= 2)) return 0;
  }
  return total;
}

/** Partes del texto para resaltar lo que coincide con la consulta (sin tildes). */
export function resaltar(texto: string, consulta: string): { t: string; si: boolean }[] {
  const palabras = normalizar(consulta).split(/\s+/).filter((p) => p.length > 0);
  if (!palabras.length || !texto) return [{ t: texto, si: false }];
  // plano() conserva el largo letra por letra: los índices sirven para el original.
  const base = plano(texto);
  const marcas = new Array<boolean>(texto.length).fill(false);
  for (const p of palabras) {
    let i = base.indexOf(p);
    while (i >= 0) {
      for (let j = i; j < i + p.length && j < marcas.length; j++) marcas[j] = true;
      i = base.indexOf(p, i + p.length);
    }
  }
  const partes: { t: string; si: boolean }[] = [];
  for (let i = 0; i < texto.length; i++) {
    const ultima = partes[partes.length - 1];
    if (ultima && ultima.si === marcas[i]) ultima.t += texto[i];
    else partes.push({ t: texto[i], si: marcas[i] });
  }
  return partes;
}

/** ¿La consulta parece un número de documento? Entonces los documentos van primero. */
export const pareceNumero = (q: string) => /\d{3,}|^(fac|cot|rec|nc|nd|com)\b/i.test(q.trim());
