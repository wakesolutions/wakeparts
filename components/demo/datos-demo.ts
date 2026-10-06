"use client";

import { ubicarVehiculo } from "@/app/acciones/vehiculos";
import type { Apis } from "@/components/datos/apis";
import { apiRecursos } from "@/components/datos/api-recursos";
import { CAMPOS_TALLER } from "@/lib/empresa";
import { CAMPOS_PERFIL } from "@/lib/perfil";
import { obtenerRecurso } from "@/lib/recursos";
import { consultarEnMemoria, opcionesEnMemoria } from "@/lib/recursos/memoria";
import type { Fila, Valores } from "@/lib/recursos/tipos";
import { validarValores } from "@/lib/recursos/validar";
import type { ImagenProducto } from "@/components/imagenes/api";
import type { EstadoSitio, PedidoWeb } from "@/components/sitio-web/api";
import { armarBandeja } from "@/lib/notificaciones";
import type { CreditoCliente, CuentaFactura, EstadoCuenta, Recibo } from "@/lib/cobros";
import {

  sumarDiasIso,
  totalesCompra,
  type Compra,
  type CuentaCompra,
  type PagoProveedor,
  type ProveedorBreve,
} from "@/lib/compras";
import { aplanar, FUENTES_EXPORTACION } from "@/lib/exportacion";
import { resumirTurno, totalArqueo, type Arqueo, type MovimientoCaja, type Turno } from "@/lib/caja";
import type { Asiento, CuentaBreve, FilaBalanza, Naturaleza, OrigenAsiento, TipoCuenta } from "@/lib/contabilidad";
import { normalizarSitio } from "@/lib/sitio-web";
import { centavos } from "@/lib/formato";
import type { ResultadoImportacion } from "@/lib/inventario";
import { diasEntre, sumarDias } from "@/lib/reportes/periodos";
import type { DatosReporte } from "@/lib/reportes/tipos";
import type { FilaCompat, NivelVehiculo } from "@/lib/vehiculos";
import {
  calcularTotales,
  CODIGO_TIPO_DOCUMENTO,
  motivosNota,
  pendienteDevolver,
  totalesNota,
  type Carrito,
  type Cliente,
  type Documento,
  type LineaAcreditable,
  type ResultadoBusqueda,
  type LineaCarrito,
  type PuntoEmision,
  type TipoCualquierDocumento,
} from "@/lib/ventas";

/**
 * Datos de demostración en memoria para el sandbox /dev y la demo pública
 * /demo (sin sesión ni base): nada de esto sale del navegador del visitante.
 * Imitan lo que hacen buscar_productos(), los carritos y emitir_documento().
 * El catálogo de vehículos sí es el real (lectura pública).
 */

type Producto = Omit<ResultadoBusqueda, "grupo" | "ajuste" | "relevancia" | "orden"> & { sinonimos: string };

const P = (
  id: number,
  codigo: string,
  nombre: string,
  marca: string | null,
  id_categoria: number,
  categoria: string,
  sinonimos: string,
  precio: number,
  costo: number,
  existencia: number,
  extra: Partial<Producto> = {},
): Producto => ({
  id,
  codigo,
  nombre,
  marca,
  id_categoria,
  categoria,
  oem: null,
  numero_parte: null,
  condicion: "nuevo",
  unidad: "unidad",
  precio,
  exento: false,
  costo,
  existencia,
  controla_inventario: true,
  disponible: existencia > 0,
  ubicacion: null,
  imagen: null,
  sinonimos,
  ...extra,
});

const PRODUCTOS: Producto[] = [
  P(1, "P-000001", "Pastillas de freno delanteras cerámicas", "AKEBONO", 70, "Pastillas de freno", "fricciones balatas pads frenos", 650, 400, 6, { oem: "04465-02220", ubicacion: "A3" }),
  P(2, "P-000002", "Pastillas de freno delanteras", "BOSCH", 70, "Pastillas de freno", "fricciones balatas pads frenos", 520, 310, 2, { oem: "04465-0K240", ubicacion: "A3" }),
  P(3, "P-000003", "Disco de freno delantero ventilado", "BREMBO", 72, "Discos de freno", "rotores frenos", 980, 620, 4, { ubicacion: "B1" }),
  P(4, "FA-01", "Filtro de aceite", "DENSO", 30, "Filtros de aceite", "filtro elemento", 120, 60, 24, { oem: "90915-YZZE1", ubicacion: "C2" }),
  P(5, "FA-02", "Filtro de aceite", "WIX", 30, "Filtros de aceite", "filtro elemento", 145, 80, 12, { oem: "15208-65F0E", ubicacion: "C2" }),
  P(6, "AI-01", "Filtro de aire de motor", "SAKURA", 31, "Filtros de aire", "filtro", 260, 140, 7, { oem: "17801-21050" }),
  P(7, "AC-2050", "Aceite 20W50 mineral galón", "CASTROL", 20, "Aceite de motor", "aceite lubricante 20w50", 450, 300, 18, { unidad: "galon" }),
  P(8, "AC-5W30", "Aceite 5W30 sintético cuarto", "MOBIL", 20, "Aceite de motor", "aceite lubricante 5w30 sintetico", 210, 130, 30, { unidad: "cuarto" }),
  P(9, "BU-01", "Bujía de iridio", "NGK", 40, "Bujías", "candelas candela spark plug", 240, 150, 16, { numero_parte: "IZFR6K11" }),
  P(10, "AM-01", "Amortiguador delantero", "KYB", 80, "Amortiguadores", "shocks", 1650, 1100, 2, { ubicacion: "D4" }),
  P(11, "BA-01", "Balinera de rueda delantera", "KOYO", 110, "Balineras de rueda", "rodamientos cojinetes", 720, 450, 0),
  P(12, "LF-01", "Líquido de frenos DOT 4", "BOSCH", 21, "Líquido de frenos", "dot 4 brake fluid", 180, 95, 9),
  P(13, "MO-01", "Cambio de pastillas (mano de obra)", null, 900, "Mano de obra › Frenos", "servicio", 300, 0, 0, { controla_inventario: false, unidad: "servicio", disponible: true }),
  P(14, "RE-01", "Refrigerante verde galón", "PRESTONE", 22, "Refrigerante", "coolant anticongelante", 390, 250, 11, { unidad: "galon" }),
  P(15, "AL-01", "Alternador reconstruido", "DENSO", 120, "Alternadores", "alternador", 3400, 2300, 1, { condicion: "reconstruido" }),
  P(16, "FU-01", "Faro delantero izquierdo usado", null, 140, "Faros", "focos delanteros farol", 1800, 600, 1, { condicion: "usado" }),
];

/** Categorías relacionadas (id → relacionadas) como la semilla. */
const RELACIONES: Record<number, number[]> = {
  20: [30, 31],
  30: [20, 31],
  31: [30, 20],
  70: [72, 21, 900],
  72: [70, 110],
  21: [70],
  40: [],
  80: [110],
  110: [72, 80],
};

// Compatibilidad: producto → filas (marca, modelo, año, especificación).
const TOYOTA = 75, COROLLA = 771, COROLLA_2005 = 7929, HILUX = 779, YARIS = 793, HONDA = 32, CIVIC = 320, NISSAN = 56, FRONTIER = 656;

let siguienteCompat = 1;
const compat: FilaCompat[] = [];
function fila(idProducto: number, f: Omit<FilaCompat, "id" | "nivel">) {
  const nivel = (f.id_especificacion ? 4 : f.id_modelo_anio ? 3 : f.id_modelo ? 2 : 1) as FilaCompat["nivel"];
  compat.push({ ...f, id: siguienteCompat++, nivel, ...{ producto: idProducto } } as FilaCompat);
}
const productoDe = (f: FilaCompat) => (f as FilaCompat & { producto: number }).producto;
const base = { id_modelo: null, modelo: null, id_modelo_anio: null, anio: null, id_especificacion: null, especificacion: null };
for (const anio of [2003, 2004, 2005, 2006, 2007, 2008]) {
  fila(1, { ...base, id_marca: TOYOTA, marca: "TOYOTA", id_modelo: COROLLA, modelo: "COROLLA", id_modelo_anio: COROLLA_2005 + (anio - 2005), anio });
}
fila(2, { ...base, id_marca: TOYOTA, marca: "TOYOTA", id_modelo: HILUX, modelo: "HILUX" });
fila(3, { ...base, id_marca: TOYOTA, marca: "TOYOTA", id_modelo: COROLLA, modelo: "COROLLA", id_modelo_anio: COROLLA_2005, anio: 2005, id_especificacion: 15571, especificacion: "TURISMO · 1.5 L" });
fila(4, { ...base, id_marca: TOYOTA, marca: "TOYOTA" });
fila(5, { ...base, id_marca: NISSAN, marca: "NISSAN", id_modelo: FRONTIER, modelo: "FRONTIER" });
fila(6, { ...base, id_marca: TOYOTA, marca: "TOYOTA", id_modelo: COROLLA, modelo: "COROLLA" });
fila(9, { ...base, id_marca: TOYOTA, marca: "TOYOTA", id_modelo: YARIS, modelo: "YARIS" });
fila(9, { ...base, id_marca: HONDA, marca: "HONDA", id_modelo: CIVIC, modelo: "CIVIC" });
fila(10, { ...base, id_marca: TOYOTA, marca: "TOYOTA", id_modelo: COROLLA, modelo: "COROLLA" });
fila(11, { ...base, id_marca: TOYOTA, marca: "TOYOTA", id_modelo: COROLLA, modelo: "COROLLA" });
fila(15, { ...base, id_marca: TOYOTA, marca: "TOYOTA", id_modelo: HILUX, modelo: "HILUX" });
fila(16, { ...base, id_marca: TOYOTA, marca: "TOYOTA", id_modelo: COROLLA, modelo: "COROLLA", id_modelo_anio: COROLLA_2005, anio: 2005 });

const normal = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/ll/g, "y")
    .replace(/v/g, "b")
    .replace(/z|c(?=[ei])/g, "s");

const espera = <T>(v: T, ms = 120) => new Promise<T>((r) => setTimeout(() => r(v), ms));

// ---------------------------------------------------------------- ventas ----

let carritos: Carrito[] = [];
const lineas = new Map<string, LineaCarrito[]>();
type ClienteDemo = Cliente & {
  exonerado?: boolean;
  exo_constancia?: string | null;
  credito_habilitado?: boolean;
  limite_credito?: number | null;
  dias_credito?: number;
};
const clientes: ClienteDemo[] = [
  {
    id: 1,
    nombre: "TRANSPORTES LÓPEZ S. DE R.L.",
    rtn: "08019010123456",
    telefono: "2233-4455",
    credito_habilitado: true,
    limite_credito: 25000,
    dias_credito: 30,
  },
  { id: 2, nombre: "JUAN PÉREZ", rtn: null, telefono: "9988-7766" },
  {
    id: 3,
    nombre: "COOPERATIVA AGRÍCOLA LOS PINOS",
    rtn: "08019015987654",
    telefono: "2780-1122",
    exonerado: true,
    exo_constancia: "CRE-2026-0451",
  },
];
/** Documentos y sus líneas con id propio (las notas apuntan a líneas de la factura). */
type DocumentoDemo = Omit<Documento, "lineas"> & {
  lineas: (Documento["lineas"][number] & { id_linea_origen?: number })[];
  id_turno?: string | null;
};
const documentos: DocumentoDemo[] = [];
let correlativoCot = 1;
const correlativos: Record<Exclude<TipoCualquierDocumento, "cotizacion">, number> = { factura: 1, nota_credito: 1, nota_debito: 1 };
let siguienteLinea = 1;
let siguienteLineaDoc = 1;

/** Punto de emisión de la demo (uno solo: Caja principal, 000-001). */
const PUNTO_DEMO: PuntoEmision = { id: 1, codigo: "000-001", nombre: "Caja principal", sucursal: "Principal" };
const CAI_DEMO = {
  factura: "35BD6A-0195F4-B34BAA-8B7D13-37F5E8-2D",
  nota_credito: "8C21F0-77AB34-19DE60-4A5B2C-93E1F7-0A",
  nota_debito: "D4E8A1-2B6C90-F35E17-60AA4D-C1B83E-5F",
};
const EMISOR_DEMO: Documento["emisor"] = {
  nombre: "Yonker Demo",
  razon_social: "Repuestos Demo S. de R.L.",
  rtn: "08011990123456",
  telefono: "2222-0000",
  correo: "ventas@demo.hn",
  direccion: "Tegucigalpa, Francisco Morazán",
  sucursal: "Principal",
  punto: "Caja principal",
};

/** Siguiente número con CAI de la demo: 000-001-TT-NNNNNNNN. */
function numeroCai(tipo: Exclude<TipoCualquierDocumento, "cotizacion">) {
  const tt = CODIGO_TIPO_DOCUMENTO[tipo];
  const n = correlativos[tipo]++;
  return {
    numero: `000-001-${tt}-${String(n).padStart(8, "0")}`,
    cai: CAI_DEMO[tipo],
    cai_rango: `000-001-${tt}-00000001 al 000-001-${tt}-00000500`,
    cai_fecha_limite: "2027-03-31",
  };
}

/** Lo común de un documento nuevo de la demo. */
const baseDocumento = (): Pick<
  Documento,
  | "exoneracion"
  | "id_factura"
  | "factura_numero"
  | "factura_fecha"
  | "factura_cai"
  | "motivo_tipo"
  | "motivo"
  | "reintegra_inventario"
  | "importe_exonerado"
  | "condicion"
  | "dias_credito"
> => ({
  exoneracion: null,
  id_factura: null,
  factura_numero: null,
  factura_fecha: null,
  factura_cai: null,
  motivo_tipo: null,
  motivo: null,
  reintegra_inventario: false,
  importe_exonerado: 0,
  condicion: "contado",
  dias_credito: null,
});

function acreditables(idFactura: string): LineaAcreditable[] {
  const f = documentos.find((d) => d.id === idFactura);
  if (!f) return [];
  const notas = documentos.filter((d) => d.id_factura === idFactura && d.tipo === "nota_credito" && d.estado === "emitido");
  return f.lineas.map((l) => {
    const devueltas = notas.flatMap((n) => n.lineas.filter((x) => x.id_linea_origen === l.id));
    return {
      id: l.id,
      codigo: l.codigo,
      descripcion: l.descripcion,
      cantidad: l.cantidad,
      precio: l.precio,
      descuento_pct: l.descuento_pct,
      exento: l.exento,
      total: l.total,
      controla_inventario: PRODUCTOS.some((p) => p.codigo === l.codigo && p.controla_inventario),
      devuelto: centavos(devueltas.reduce((s, x) => s + x.cantidad, 0)),
      acreditado: centavos(devueltas.reduce((s, x) => s + x.total, 0)),
    };
  });
}

function saldoDemo(f: Documento) {
  return centavos(
    documentos
      .filter((d) => d.id_factura === f.id && d.estado === "emitido")
      .reduce((s, n) => s + (n.tipo === "nota_debito" ? n.total : -n.total), f.total),
  );
}

// --------------------------------------------------------- crédito (demo) --

type PagoDemo = Omit<Recibo, "emisor" | "saldo_actual" | "aplicaciones"> & {
  aplicaciones: { id_documento: string; monto: number }[];
  id_turno?: string | null;
};

// ------------------------------------------------------------ caja (demo) --

type TurnoDemo = {
  id: string;
  numero: number;
  abierta_en: string;
  fondo: number;
  estado: "abierta" | "cerrada";
  cerrada_en: string | null;
  contado: number | null;
  arqueo: Arqueo | null;
  notas: string | null;
  manuales: { id: number; tipo: "entrada" | "salida"; monto: number; concepto: string; fecha: string }[];
};
const turnosDemo: TurnoDemo[] = [];
let cajaObligatoriaDemo = false;
let siguienteManual = 1;
const turnoAbiertoDemo = () => turnosDemo.find((t) => t.estado === "abierta") ?? null;

function movimientosTurnoDemo(t: TurnoDemo): MovimientoCaja[] {
  const docs: MovimientoCaja[] = documentos
    .filter((d) => d.id_turno === t.id && d.tipo !== "cotizacion")
    .map((d) => {
      const f = d.id_factura ? documentos.find((x) => x.id === d.id_factura) : undefined;
      const tipo =
        d.tipo === "factura" ? (d.condicion === "credito" ? "venta_credito" : "venta") : d.tipo === "nota_credito" ? "devolucion" : "cargo";
      return {
        id: d.id,
        fecha: d.fecha,
        tipo,
        referencia: d.numero,
        detalle: d.cliente_nombre,
        forma_pago: d.forma_pago ?? f?.forma_pago ?? null,
        monto: d.tipo === "nota_credito" ? -d.total : d.total,
        // Nota sin factura (0019): mueve dinero si tiene forma de pago.
        en_caja: d.tipo === "factura" ? d.condicion === "contado" : f ? f.condicion === "contado" : d.forma_pago != null,
        estado: d.estado,
        usuario: d.vendedor,
      };
    });
  const abonos: MovimientoCaja[] = pagosDemo
    .filter((p) => p.id_turno === t.id)
    .map((p) => ({
      id: p.id,
      fecha: p.fecha,
      tipo: "abono",
      referencia: p.numero,
      detalle: p.cliente_nombre,
      forma_pago: p.forma_pago,
      monto: p.monto,
      en_caja: true,
      estado: p.estado,
      usuario: p.cobro,
    }));
  const salidasCompras: MovimientoCaja[] = [
    ...comprasDemo
      .filter((c) => c.id_turno === t.id)
      .map((c) => ({
        id: c.id,
        fecha: c.creado_en,
        tipo: "compra" as const,
        referencia: c.numero,
        detalle: c.proveedor_nombre,
        forma_pago: c.forma_pago,
        monto: -c.total,
        en_caja: true,
        estado: c.estado,
        usuario: "Demo Sandbox",
      })),
    ...pagosProvDemo
      .filter((x) => x.id_turno === t.id)
      .map((x) => ({
        id: x.id,
        fecha: x.fecha,
        tipo: "pago_proveedor" as const,
        referencia: x.numero,
        detalle: x.proveedor_nombre,
        forma_pago: x.forma_pago,
        monto: -x.monto,
        en_caja: true,
        estado: x.estado,
        usuario: "Demo Sandbox",
      })),
  ];
  const manuales: MovimientoCaja[] = t.manuales.map((m) => ({
    id: String(m.id),
    fecha: m.fecha,
    tipo: m.tipo,
    referencia: null,
    detalle: m.concepto,
    forma_pago: "efectivo",
    monto: m.tipo === "salida" ? -m.monto : m.monto,
    en_caja: true,
    estado: "emitido",
    usuario: "Demo Sandbox",
  }));
  return [...docs, ...abonos, ...salidasCompras, ...manuales].sort((a, b) => b.fecha.localeCompare(a.fecha));
}

function turnoCompletoDemo(t: TurnoDemo): Turno {
  const movimientos = movimientosTurnoDemo(t);
  const resumen = resumirTurno(t.fondo, movimientos);
  return {
    id: t.id,
    numero: t.numero,
    empresa: EMISOR_DEMO.nombre ?? "Yonker Demo",
    punto: `${PUNTO_DEMO.codigo} · ${PUNTO_DEMO.nombre}`,
    estado: t.estado,
    abierta_en: t.abierta_en,
    abierta_por: "Demo Sandbox",
    cerrada_en: t.cerrada_en,
    cerrada_por: t.cerrada_en ? "Demo Sandbox" : null,
    fondo_inicial: t.fondo,
    efectivo_contado: t.contado,
    diferencia: t.contado === null ? null : centavos(t.contado - resumen.esperado_efectivo),
    arqueo: t.arqueo,
    notas: t.notas,
    propio: true,
    resumen,
    movimientos,
  };
}

function guardarCorteDemo(id: string) {
  const t = turnosDemo.find((x) => x.id === id);
  if (!t) return;
  try {
    localStorage.setItem(`wp:demo:corte:${id}`, JSON.stringify(turnoCompletoDemo(t)));
  } catch {
    // sin almacenamiento
  }
}
const pagosDemo: PagoDemo[] = [];
let correlativoRecibo = 1;

const hoyIso = () => new Date().toISOString().slice(0, 10);
const diasEntreFechas = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / 86_400_000);

/** Igual que v_cuentas_cobrar: facturas al crédito vigentes con lo que queda por cobrar. */
function cuentasDemo(): CuentaFactura[] {
  const hoy = hoyIso();
  return documentos
    .filter((d) => d.tipo === "factura" && d.condicion === "credito" && d.estado === "emitido")
    .map((f) => {
      const notas = documentos.filter((n) => n.id_factura === f.id && n.estado === "emitido");
      const debitos = centavos(notas.filter((n) => n.tipo === "nota_debito").reduce((s, n) => s + n.total, 0));
      const creditos = centavos(notas.filter((n) => n.tipo === "nota_credito").reduce((s, n) => s + n.total, 0));
      const abonado = centavos(
        pagosDemo
          .filter((p) => p.estado === "emitido")
          .flatMap((p) => p.aplicaciones)
          .filter((a) => a.id_documento === f.id)
          .reduce((s, a) => s + a.monto, 0),
      );
      const pendiente = centavos(f.total + debitos - creditos - abonado);
      const vence = f.vence ?? hoy;
      const estado: EstadoCuenta =
        pendiente <= 0 ? "pagada" : hoy > vence ? "vencida" : diasEntreFechas(vence, hoy) <= 7 ? "por_vencer" : "al_dia";
      return {
        id: f.id,
        numero: f.numero,
        fecha: f.fecha,
        vence,
        id_cliente: clientes.find((c) => c.nombre === f.cliente_nombre)?.id ?? 0,
        cliente_nombre: f.cliente_nombre,
        total: f.total,
        debitos,
        creditos,
        abonado,
        pendiente,
        dias_vencida: Math.max(diasEntreFechas(hoy, vence), 0),
        estado,
      };
    });
}

function creditoDemo(id: number): CreditoCliente | null {
  const c = clientes.find((x) => x.id === id);
  if (!c) return null;
  const cuentas = cuentasDemo().filter((f) => f.id_cliente === id);
  if (!c.credito_habilitado && !cuentas.length) return null;
  const pend = cuentas.filter((f) => f.pendiente > 0);
  const pendiente = centavos(cuentas.reduce((s, f) => s + f.pendiente, 0));
  const limite = c.limite_credito ?? null;
  return {
    id: c.id,
    nombre: c.nombre,
    rtn: c.rtn,
    telefono: c.telefono,
    credito_habilitado: Boolean(c.credito_habilitado),
    limite_credito: limite,
    dias_credito: c.dias_credito ?? 30,
    pendiente,
    vencido: centavos(pend.filter((f) => f.estado === "vencida").reduce((s, f) => s + f.pendiente, 0)),
    disponible: limite === null ? null : centavos(limite - pendiente),
    facturas: pend.length,
    dias_mora: Math.max(0, ...pend.map((f) => f.dias_vencida)),
    ultimo_abono: pagosDemo.filter((p) => p.id_cliente === id && p.estado === "emitido").at(-1)?.fecha ?? null,
  };
}

function reciboDemo(id: string): Recibo | null {
  const p = pagosDemo.find((x) => x.id === id);
  if (!p) return null;
  return {
    ...p,
    emisor: EMISOR_DEMO,
    aplicaciones: p.aplicaciones.map((a) => {
      const f = documentos.find((d) => d.id === a.id_documento)!;
      return { id_documento: a.id_documento, numero: f.numero, fecha_factura: f.fecha, total: f.total, monto: a.monto };
    }),
    saldo_actual: creditoDemo(p.id_cliente)?.pendiente ?? 0,
  };
}

function guardarReciboDemo(id: string) {
  try {
    localStorage.setItem(`wp:demo:rec:${id}`, JSON.stringify(reciboDemo(id)));
  } catch {
    // sin almacenamiento
  }
}

/** Dos facturas al crédito de ejemplo para Transportes López: una vencida y otra al día. */
function sembrarCredito() {
  const cli = clientes[0];
  const emitirSembrada = (diasAtras: number, items: [number, number][]) => {
    const fecha = new Date(Date.now() - diasAtras * 86_400_000);
    const ls = items.map(([i, cantidad]) => {
      const p = PRODUCTOS[i];
      return { cantidad, precio: p.precio, descuento_pct: 0, exento: p.exento, costo: p.costo, codigo: p.codigo, descripcion: p.nombre };
    });
    const t = calcularTotales(ls, 0);
    const cai = numeroCai("factura");
    documentos.push({
      ...baseDocumento(),
      id: crypto.randomUUID(),
      tipo: "factura",
      numero: cai.numero,
      fecha: fecha.toISOString(),
      vence: new Date(fecha.getTime() + (cli.dias_credito ?? 30) * 86_400_000).toISOString().slice(0, 10),
      cai: cai.cai,
      cai_rango: cai.cai_rango,
      cai_fecha_limite: cai.cai_fecha_limite,
      emisor: EMISOR_DEMO,
      condicion: "credito",
      dias_credito: cli.dias_credito ?? 30,
      cliente_nombre: cli.nombre,
      cliente_rtn: cli.rtn,
      cliente_telefono: cli.telefono,
      vehiculo: "TOYOTA HILUX 2018",
      subtotal: t.subtotal,
      descuento: t.descuento,
      importe_exento: t.exento,
      importe_gravado: t.gravado,
      isv: t.isv,
      total: t.total,
      notas: null,
      estado: "emitido",
      motivo_anulacion: null,
      vendedor: "Ana Demo",
      lineas: ls.map((l, i) => ({
        id: siguienteLineaDoc++,
        codigo: l.codigo,
        descripcion: l.descripcion,
        cantidad: l.cantidad,
        precio: l.precio,
        descuento_pct: 0,
        descuento: 0,
        exento: l.exento,
        total: t.lineas[i].neto,
      })),
    });
  };
  emitirSembrada(48, [
    [2, 2],
    [5, 4],
  ]);
  emitirSembrada(9, [[1, 2]]);
}
sembrarCredito();

const conNotas = (d: DocumentoDemo): Documento => ({
  ...d,
  notasRelacionadas: documentos
    .filter((n) => n.id_factura === d.id)
    .map((n) => ({
      id: n.id,
      tipo: n.tipo as "nota_credito" | "nota_debito",
      numero: n.numero,
      fecha: n.fecha,
      total: n.total,
      estado: n.estado,
      motivo_tipo: n.motivo_tipo,
    })),
});

function nuevoCarrito(): Carrito {
  const ahora = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    nombre: null,
    id_cliente: null,
    cliente_nombre: null,
    cliente_rtn: null,
    cliente_telefono: null,
    id_marca: TOYOTA,
    id_modelo: COROLLA,
    id_modelo_anio: COROLLA_2005,
    id_especificacion: null,
    vehiculo: "TOYOTA COROLLA 2005",
    descuento_pct: 0,
    notas: null,
    estado: "abierto",
    lineas: 0,
    creado_por_nombre: "Demo Sandbox",
    creado_en: ahora,
    actualizado_en: ahora,
    exonerado: false,
    exo_orden_compra: null,
    exo_constancia: null,
    exo_registro_sag: null,
    condicion: "contado",
    forma_pago: "efectivo",
    referencia_pago: null,
  };
}

function buscar(consulta: Parameters<Apis["ventas"]["buscar"]>[0]): ResultadoBusqueda[] {
  const v = consulta.vehiculo ?? {};
  const palabras = normal(consulta.texto ?? "").split(/[^a-z0-9ñ]+/).filter((p) => p.length >= 2);
  const codigo = (consulta.texto ?? "").replace(/[^0-9a-z]/gi, "").toLowerCase();

  const coincide = (p: Producto) => {
    const heno = normal(`${p.nombre} ${p.marca ?? ""} ${p.categoria} ${p.sinonimos} ${p.codigo} ${p.oem ?? ""} ${p.numero_parte ?? ""}`);
    const codigos = [p.codigo, p.oem, p.numero_parte].map((c) => (c ?? "").replace(/[^0-9a-z]/gi, "").toLowerCase());
    if (codigo.length >= 3 && codigos.some((c) => c.includes(codigo))) return true;
    return palabras.every((w) => heno.includes(w));
  };

  const ajuste = (p: Producto): { grupo: ResultadoBusqueda["grupo"]; ajuste: ResultadoBusqueda["ajuste"]; puntos: number } | null => {
    if (!v.id_marca) return { grupo: "todos", ajuste: null, puntos: 0 };
    const filas = compat.filter((f) => productoDe(f) === p.id);
    if (!filas.length) return { grupo: "general", ajuste: null, puntos: 0 };
    let mejor = 0;
    for (const f of filas) {
      if (f.id_marca !== v.id_marca) continue;
      if (v.id_modelo && f.id_modelo && f.id_modelo !== v.id_modelo) continue;
      if (v.id_modelo_anio && f.id_modelo_anio && f.id_modelo_anio !== v.id_modelo_anio) continue;
      if (v.id_especificacion && f.id_especificacion && f.id_especificacion !== v.id_especificacion) continue;
      const exacto =
        (!f.id_modelo || f.id_modelo === v.id_modelo) &&
        (!f.id_modelo_anio || f.id_modelo_anio === v.id_modelo_anio) &&
        (!f.id_especificacion || f.id_especificacion === v.id_especificacion);
      mejor = Math.max(mejor, exacto ? f.nivel * 10 : f.nivel);
    }
    if (!mejor) return null;
    const nombre = mejor >= 40 ? "motor" : mejor >= 30 ? "anio" : mejor >= 20 ? "modelo" : mejor >= 10 ? "marca" : "verificar";
    return { grupo: "vehiculo", ajuste: nombre, puntos: mejor };
  };

  const principales = PRODUCTOS.filter(coincide)
    .map((p) => ({ p, a: ajuste(p) }))
    .filter((x) => x.a)
    .sort((x, y) => {
      const rango = (a: typeof x.a) => (a!.grupo === "vehiculo" ? (a!.puntos >= 10 ? 0 : 1) : a!.grupo === "todos" ? 0 : 2);
      return rango(x.a) - rango(y.a) || y.a!.puntos - x.a!.puntos || x.p.nombre.localeCompare(y.p.nombre);
    });

  const vistos = new Set(principales.map((x) => x.p.id));
  const categorias = new Set(principales.slice(0, 12).map((x) => x.p.id_categoria));
  const relacionadas = new Set([...categorias].flatMap((c) => RELACIONES[c] ?? []).filter((c) => !categorias.has(c)));
  const complementos =
    palabras.length || codigo.length >= 3
      ? PRODUCTOS.filter((p) => !vistos.has(p.id) && relacionadas.has(p.id_categoria))
          .map((p) => ({ p, a: ajuste(p) }))
          .filter((x) => x.a)
          .slice(0, 8)
      : [];

  const salida = (p: Producto, grupo: ResultadoBusqueda["grupo"], aj: ResultadoBusqueda["ajuste"], orden: number): ResultadoBusqueda => {
    const { sinonimos, ...resto } = p;
    void sinonimos;
    return { ...resto, grupo, ajuste: aj, relevancia: 0, orden };
  };
  return [
    ...principales.map((x, i) => salida(x.p, x.a!.grupo, x.a!.ajuste, i + 1)),
    ...complementos.map((x, i) => salida(x.p, "complemento", x.a!.grupo === "vehiculo" ? (x.a!.puntos >= 10 ? "vehiculo" : "verificar") : null, 10000 + i)),
  ];
}

const ventas: Apis["ventas"] = {
  buscar: async (c) => espera(buscar(c), 90),
  carritos: async () => espera(carritos.filter((c) => c.estado === "abierto")),
  crearCarrito: async () => {
    const c = nuevoCarrito();
    carritos.push(c);
    return espera({ ok: true as const, carrito: c });
  },
  actualizarCarrito: async (id, cambios) => {
    const c = carritos.find((x) => x.id === id);
    if (!c) return { ok: false as const, error: "Carrito no encontrado." };
    if ((cambios.descuento_pct ?? 0) > 10) {
      return { ok: false as const, error: "Tu rol permite hasta 10 % de descuento. (demo)" };
    }
    Object.assign(c, cambios);
    if (cambios.id_cliente) {
      const cli = clientes.find((x) => x.id === cambios.id_cliente);
      if (cli)
        Object.assign(c, {
          cliente_nombre: cli.nombre,
          cliente_rtn: cli.rtn,
          cliente_telefono: cli.telefono,
          exonerado: Boolean(cli.exonerado),
          exo_constancia: cli.exo_constancia ?? null,
          exo_orden_compra: null,
        });
    }
    if (typeof cambios.cliente_nombre === "string") c.cliente_nombre = cambios.cliente_nombre.toUpperCase();
    if ("id_marca" in cambios) {
      const u = await (c.id_especificacion
        ? ubicarVehiculo("especificacion", c.id_especificacion)
        : c.id_modelo_anio
          ? ubicarVehiculo("anio", c.id_modelo_anio)
          : c.id_modelo
            ? ubicarVehiculo("modelo", c.id_modelo)
            : c.id_marca
              ? ubicarVehiculo("marca", c.id_marca)
              : null);
      c.vehiculo = u ? [u.marca, u.modelo, u.anio].filter(Boolean).join(" ") : null;
    }
    return espera({ ok: true as const, carrito: { ...c } });
  },
  descartarCarrito: async (id) => {
    carritos = carritos.filter((c) => c.id !== id);
    return espera({ ok: true as const });
  },
  lineas: async (id) => espera([...(lineas.get(id) ?? [])]),
  agregarLinea: async (id, l) => {
    const p = PRODUCTOS.find((x) => x.id === l.id_producto);
    const nueva: LineaCarrito = {
      id: siguienteLinea++,
      id_carrito: id,
      id_producto: l.id_producto ?? null,
      codigo: l.codigo ?? null,
      descripcion: l.descripcion,
      cantidad: l.cantidad,
      precio: l.precio,
      descuento_pct: 0,
      exento: l.exento,
      orden: (lineas.get(id)?.length ?? 0) + 1,
      costo: p?.costo ?? null,
      existencia: p?.existencia ?? null,
      controla_inventario: p?.controla_inventario ?? null,
      unidad: p?.unidad ?? null,
      oem: p?.oem ?? null,
      imagen: p?.imagen ?? null,
    };
    lineas.set(id, [...(lineas.get(id) ?? []), nueva]);
    const c = carritos.find((x) => x.id === id);
    if (c) c.lineas = lineas.get(id)!.length;
    return espera({ ok: true as const, linea: nueva });
  },
  actualizarLinea: async (idLinea, cambios) => {
    if ((cambios.descuento_pct ?? 0) > 10) return { ok: false as const, error: "Tu rol permite hasta 10 % de descuento. (demo)" };
    for (const [, ls] of lineas) {
      const l = ls.find((x) => x.id === idLinea);
      if (l) Object.assign(l, cambios);
    }
    return espera({ ok: true as const });
  },
  quitarLinea: async (idLinea) => {
    for (const [k, ls] of lineas) lineas.set(k, ls.filter((x) => x.id !== idLinea));
    return espera({ ok: true as const });
  },
  clientes: async (texto) => {
    const t = normal(texto ?? "");
    return espera(clientes.filter((c) => !t || normal(`${c.nombre} ${c.rtn ?? ""} ${c.telefono ?? ""}`).includes(t)).slice(0, 8));
  },
  crearCliente: async (d) => {
    const c: Cliente = { id: clientes.length + 1, nombre: d.nombre.toUpperCase(), rtn: d.rtn ?? null, telefono: d.telefono ?? null };
    clientes.push(c);
    return espera({ ok: true as const, cliente: c });
  },
  emitir: async (idCarrito, tipo) => {
    const c = carritos.find((x) => x.id === idCarrito);
    const ls = lineas.get(idCarrito) ?? [];
    if (!c || !ls.length) return { ok: false as const, error: "El carrito está vacío." };
    if (tipo === "factura" && c.exonerado) {
      if (!c.cliente_rtn) return { ok: false as const, error: "Una factura exonerada lleva el RTN del cliente." };
      if (!c.exo_orden_compra && !c.exo_constancia) {
        return { ok: false as const, error: "Escribí la orden de compra exenta o la constancia de registro de exonerado." };
      }
    }
    const credito = tipo === "factura" && c.condicion === "credito";
    const cliCredito = credito ? clientes.find((x) => x.id === c.id_cliente) : undefined;
    if (credito && !cliCredito) return { ok: false as const, error: "Para vender al crédito elegí un cliente registrado." };
    if (credito && !cliCredito?.credito_habilitado) {
      return { ok: false as const, error: "Este cliente no tiene crédito. Habilitalo en Ventas › Clientes." };
    }
    if (tipo === "factura" && !credito && cajaObligatoriaDemo && !turnoAbiertoDemo()) {
      return { ok: false as const, error: "Abrí la caja (módulo Caja) antes de facturar de contado." };
    }
    const t = calcularTotales(ls, c.descuento_pct, c.exonerado);
    const cai =
      tipo === "factura"
        ? numeroCai("factura")
        : { numero: `COT-${String(correlativoCot++).padStart(6, "0")}`, cai: null, cai_rango: null, cai_fecha_limite: null };
    const numero = cai.numero;
    const doc: DocumentoDemo = {
      ...baseDocumento(),
      id: crypto.randomUUID(),
      tipo,
      numero,
      fecha: new Date().toISOString(),
      vence:
        tipo === "cotizacion"
          ? new Date(Date.now() + 15 * 864e5).toISOString().slice(0, 10)
          : credito
            ? new Date(Date.now() + (cliCredito!.dias_credito ?? 30) * 864e5).toISOString().slice(0, 10)
            : null,
      condicion: credito ? "credito" : "contado",
      dias_credito: credito ? (cliCredito!.dias_credito ?? 30) : null,
      forma_pago: tipo === "factura" && !credito ? c.forma_pago : null,
      referencia_pago: tipo === "factura" && !credito ? c.referencia_pago : null,
      id_turno: tipo === "factura" ? (turnoAbiertoDemo()?.id ?? null) : null,
      cai: cai.cai,
      cai_rango: cai.cai_rango,
      cai_fecha_limite: cai.cai_fecha_limite,
      emisor: EMISOR_DEMO,
      exoneracion: c.exonerado
        ? { orden_compra: c.exo_orden_compra, constancia: c.exo_constancia, registro_sag: c.exo_registro_sag }
        : null,
      importe_exonerado: t.exonerado,
      cliente_nombre: c.cliente_nombre ?? "CONSUMIDOR FINAL",
      cliente_rtn: c.cliente_rtn,
      cliente_telefono: c.cliente_telefono,
      vehiculo: c.vehiculo,
      subtotal: t.subtotal,
      descuento: t.descuento,
      importe_exento: t.exento,
      importe_gravado: t.gravado,
      isv: t.isv,
      total: t.total,
      notas: c.notas,
      estado: "emitido",
      motivo_anulacion: null,
      vendedor: "Demo Sandbox",
      lineas: ls.map((l, i) => ({
        id: siguienteLineaDoc++,
        codigo: l.codigo,
        descripcion: l.descripcion,
        cantidad: l.cantidad,
        precio: l.precio,
        descuento_pct: centavos((1 - (1 - l.descuento_pct / 100) * (1 - c.descuento_pct / 100)) * 100),
        descuento: t.lineas[i].descuento,
        exento: l.exento,
        total: t.lineas[i].neto,
      })),
    };
    documentos.push(doc);
    c.estado = "cerrado";
    guardarDocumentoDemo(doc);
    return espera({ ok: true as const, id: doc.id, numero }, 400);
  },
  documento: async (id) => {
    const d = documentos.find((x) => x.id === id);
    return espera(d ? conNotas(d) : null);
  },
  carritoDesdeDocumento: async (id) => {
    const d = documentos.find((x) => x.id === id);
    if (!d) return { ok: false as const, error: "No existe." };
    if (d.tipo !== "cotizacion" && d.tipo !== "factura") {
      return { ok: false as const, error: "Solo una cotización o una factura se pueden pasar a un carrito." };
    }
    const c = { ...nuevoCarrito(), nombre: d.numero, cliente_nombre: d.cliente_nombre, cliente_rtn: d.cliente_rtn };
    carritos.push(c);
    lineas.set(
      c.id,
      d.lineas.map((l) => ({ ...l, id: siguienteLinea++, id_carrito: c.id, id_producto: null, orden: 0, costo: null, existencia: null, controla_inventario: null, unidad: null, oem: null, imagen: null })),
    );
    return espera({ ok: true as const, id: c.id });
  },
  anular: async (id, motivo) => {
    const d = documentos.find((x) => x.id === id);
    if (!d) return { ok: false as const, error: "El documento no existe." };
    if (d.tipo === "factura" && documentos.some((n) => n.id_factura === id && n.estado === "emitido")) {
      return { ok: false as const, error: "Esta factura tiene notas de crédito o débito vigentes: anulalas primero." };
    }
    d.estado = "anulado";
    d.motivo_anulacion = motivo;
    guardarDocumentoDemo(conNotas(d));
    return espera({ ok: true as const });
  },
  lineasAcreditables: async (id) => espera(acreditables(id)),
  emitirNota: async (idFactura, nota) => {
    const f = documentos.find((d) => d.id === idFactura);
    if (!f || f.tipo !== "factura" || f.estado !== "emitido") return { ok: false as const, error: "La factura no se puede modificar." };
    if (!nota.motivo.trim()) return { ok: false as const, error: "Escribí el motivo de la nota." };
    const lineasF = acreditables(idFactura);
    const devolucion = nota.motivo_tipo === "devolucion";
    type Entrada = { linea: LineaAcreditable; cantidad: number } | { monto: number; exento: boolean; descripcion: string };
    const entradas: Entrada[] = nota.lineas.map((l) =>
      "id_linea" in l
        ? { linea: lineasF.find((x) => x.id === l.id_linea)!, cantidad: l.cantidad }
        : { monto: l.monto, exento: l.exento, descripcion: l.descripcion },
    );
    for (const e of entradas) {
      if ("linea" in e && (!e.linea || e.cantidad > pendienteDevolver(e.linea))) {
        return { ok: false as const, error: `«${e.linea?.descripcion ?? "Línea"}»: no quedan tantas por devolver.` };
      }
    }
    const t = totalesNota(entradas, f.exoneracion != null);
    if (nota.tipo === "nota_credito" && t.total > saldoDemo(f) + 0.02) {
      return { ok: false as const, error: "La nota supera lo que queda de la factura." };
    }
    const cai = numeroCai(nota.tipo);
    const doc: DocumentoDemo = {
      ...baseDocumento(),
      id: crypto.randomUUID(),
      tipo: nota.tipo,
      numero: cai.numero,
      fecha: new Date().toISOString(),
      vence: null,
      cai: cai.cai,
      cai_rango: cai.cai_rango,
      cai_fecha_limite: cai.cai_fecha_limite,
      emisor: EMISOR_DEMO,
      exoneracion: f.exoneracion,
      id_factura: f.id,
      factura_numero: f.numero,
      factura_fecha: f.fecha,
      factura_cai: f.cai,
      motivo_tipo: nota.motivo_tipo,
      motivo: nota.motivo.trim(),
      reintegra_inventario: devolucion && nota.reintegrar,
      id_turno: turnoAbiertoDemo()?.id ?? null,
      cliente_nombre: f.cliente_nombre,
      cliente_rtn: f.cliente_rtn,
      cliente_telefono: f.cliente_telefono,
      vehiculo: f.vehiculo,
      subtotal: t.exento + t.gravado + t.exonerado,
      descuento: 0,
      importe_exento: t.exento,
      importe_gravado: t.gravado,
      importe_exonerado: t.exonerado,
      isv: t.isv,
      total: t.total,
      notas: null,
      estado: "emitido",
      motivo_anulacion: null,
      vendedor: "Demo Sandbox",
      lineas: entradas.map((e, i) =>
        "linea" in e
          ? {
              id: siguienteLineaDoc++,
              codigo: e.linea.codigo,
              descripcion: e.linea.descripcion,
              cantidad: e.cantidad,
              precio: e.linea.precio,
              descuento_pct: e.linea.descuento_pct,
              descuento: centavos(e.cantidad * e.linea.precio - t.netos[i]),
              exento: e.linea.exento,
              total: t.netos[i],
              id_linea_origen: e.linea.id,
            }
          : {
              id: siguienteLineaDoc++,
              codigo: null,
              descripcion: e.descripcion,
              cantidad: 1,
              precio: e.monto,
              descuento_pct: 0,
              descuento: 0,
              exento: e.exento,
              total: t.netos[i],
            },
      ),
    };
    documentos.push(doc);
    guardarDocumentoDemo(doc);
    return espera({ ok: true as const, id: doc.id, numero: doc.numero }, 400);
  },
  emitirNotaLibre: async (nota) => {
    if (!motivosNota(nota.tipo, false).some((m) => m.valor === nota.motivo_tipo)) return { ok: false as const, error: "Elegí el motivo." };
    if (!nota.motivo.trim()) return { ok: false as const, error: "Escribí el motivo de la nota." };
    if (!nota.lineas.length || nota.lineas.some((l) => !l.descripcion.trim() || !(l.monto > 0))) {
      return { ok: false as const, error: "Revisá la descripción y el monto." };
    }
    if (nota.forma_pago && cajaObligatoriaDemo && !turnoAbiertoDemo()) {
      return { ok: false as const, error: "Abrí la caja (módulo Caja) antes de emitir una nota que mueve dinero." };
    }
    const cli = nota.id_cliente ? clientes.find((c) => c.id === nota.id_cliente) : undefined;
    const t = totalesNota(nota.lineas, false);
    const cai = numeroCai(nota.tipo);
    const doc: DocumentoDemo = {
      ...baseDocumento(),
      id: crypto.randomUUID(),
      tipo: nota.tipo,
      numero: cai.numero,
      fecha: new Date().toISOString(),
      vence: null,
      cai: cai.cai,
      cai_rango: cai.cai_rango,
      cai_fecha_limite: cai.cai_fecha_limite,
      emisor: EMISOR_DEMO,
      motivo_tipo: nota.motivo_tipo,
      motivo: nota.motivo.trim(),
      forma_pago: nota.forma_pago,
      referencia_pago: nota.forma_pago ? nota.referencia_pago : null,
      id_turno: turnoAbiertoDemo()?.id ?? null,
      cliente_nombre: cli?.nombre ?? (nota.cliente_nombre?.trim() || "CONSUMIDOR FINAL"),
      cliente_rtn: cli ? cli.rtn : nota.cliente_rtn?.replace(/\D/g, "") || null,
      cliente_telefono: cli?.telefono ?? null,
      vehiculo: null,
      subtotal: t.exento + t.gravado,
      descuento: 0,
      importe_exento: t.exento,
      importe_gravado: t.gravado,
      importe_exonerado: 0,
      isv: t.isv,
      total: t.total,
      notas: null,
      estado: "emitido",
      motivo_anulacion: null,
      vendedor: "Demo Sandbox",
      lineas: nota.lineas.map((l, i) => ({
        id: siguienteLineaDoc++,
        codigo: null,
        descripcion: l.descripcion.trim(),
        cantidad: 1,
        precio: l.monto,
        descuento_pct: 0,
        descuento: 0,
        exento: l.exento,
        total: t.netos[i],
      })),
    };
    documentos.push(doc);
    guardarDocumentoDemo(doc);
    return espera({ ok: true as const, id: doc.id, numero: doc.numero }, 400);
  },
  facturasParaNota: async (texto) => {
    const q = normal(texto.trim());
    return espera(
      documentos
        .filter((d) => d.tipo === "factura" && d.estado === "emitido")
        .filter((d) => !q || normal(d.numero).includes(q) || normal(d.cliente_nombre).includes(q))
        .sort((a, b) => b.fecha.localeCompare(a.fecha))
        .slice(0, 8)
        .map((d) => ({ id: d.id, numero: d.numero, fecha: d.fecha, cliente_nombre: d.cliente_nombre, total: d.total, saldo: saldoDemo(d) })),
    );
  },
  puntoEmision: async () => espera(PUNTO_DEMO),
  urlImpresion: (id) => `/demo/documento?id=${id}`,
};

/** La página /demo/documento (y /dev/documento) lee el documento de sessionStorage (otra pestaña). */
function guardarDocumentoDemo(doc: Documento) {
  try {
    sessionStorage.setItem(`wp:demo:doc:${doc.id}`, JSON.stringify(doc));
    localStorage.setItem(`wp:demo:doc:${doc.id}`, JSON.stringify(doc));
  } catch {
    // sin almacenamiento
  }
}

// ---------------------------------------------------------- compatibilidad --

const compatibilidad: Apis["compatibilidad"] = {
  leer: async (idProducto) => espera(compat.filter((f) => productoDe(f) === idProducto).map((f) => ({ ...f }))),
  cambiar: async (idProducto, nivel: NivelVehiculo, ids, asignar) => {
    const n = { marca: 1, modelo: 2, anio: 3, especificacion: 4 }[nivel];
    const campo = (["id_marca", "id_modelo", "id_modelo_anio", "id_especificacion"] as const)[n - 1];
    const propias = () => compat.filter((f) => productoDe(f) === idProducto);
    if (!asignar) {
      for (const f of propias()) if (f.nivel === n && ids.includes(f[campo] as number)) compat.splice(compat.indexOf(f), 1);
      return espera({ ok: true as const });
    }
    for (const id of ids) {
      if (propias().some((f) => f.nivel === n && f[campo] === id)) continue;
      const u = await ubicarVehiculo(nivel, id);
      if (!u) continue;
      fila(idProducto, {
        id_marca: u.id_marca,
        marca: u.marca,
        id_modelo: n >= 2 ? u.id_modelo : null,
        modelo: n >= 2 ? u.modelo : null,
        id_modelo_anio: n >= 3 ? u.id_modelo_anio : null,
        anio: n >= 3 ? u.anio : null,
        id_especificacion: n === 4 ? id : null,
        especificacion: n === 4 ? u.especificacion : null,
      });
    }
    // Compactar: lo cubierto por una fila más general sobra.
    for (const f of propias()) {
      const cubierta = propias().some(
        (g) =>
          g.nivel < f.nivel &&
          g.id_marca === f.id_marca &&
          (!g.id_modelo || g.id_modelo === f.id_modelo) &&
          (!g.id_modelo_anio || g.id_modelo_anio === f.id_modelo_anio),
      );
      if (cubierta) compat.splice(compat.indexOf(f), 1);
    }
    return espera({ ok: true as const });
  },
  copiar: async (origen, destino) => {
    for (const f of compat.filter((x) => productoDe(x) === origen)) {
      const { id, nivel, ...resto } = f;
      void id;
      void nivel;
      fila(destino, resto);
    }
    return espera({ ok: true as const });
  },
};

// ------------------------------------------------------------------ fotos ---

const fotos = new Map<number, ImagenProducto[]>();
let siguienteFoto = 1;

const imagenes: Apis["imagenes"] = {
  leer: async (id) => espera([...(fotos.get(id) ?? [])]),
  subir: async (datos) => {
    const id = Number(datos.get("producto"));
    const archivo = datos.get("archivo") as File;
    const miniatura = datos.get("miniatura") as File | null;
    const imagen: ImagenProducto = {
      id: siguienteFoto++,
      ruta: URL.createObjectURL(archivo),
      ruta_miniatura: miniatura ? URL.createObjectURL(miniatura) : null,
      ancho: Number(datos.get("ancho")) || null,
      alto: Number(datos.get("alto")) || null,
      orden: fotos.get(id)?.length ?? 0,
    };
    fotos.set(id, [...(fotos.get(id) ?? []), imagen]);
    return espera({ ok: true as const, imagen }, 600);
  },
  eliminar: async (idFoto) => {
    for (const [k, fs] of fotos) fotos.set(k, fs.filter((f) => f.id !== idFoto));
    return espera({ ok: true as const });
  },
  ordenar: async (id, ids) => {
    const actuales = fotos.get(id) ?? [];
    fotos.set(id, ids.map((x) => actuales.find((f) => f.id === x)!).filter(Boolean));
    return espera({ ok: true as const });
  },
};

// ------------------------------------------------ entradas e importación ---

const inventario: Apis["inventario"] = {
  buscar: async (texto) => espera(buscar({ texto, vehiculo: {} }), 90),
  entrada: async (lineas) => {
    let unidades = 0;
    let valor = 0;
    for (const l of lineas) {
      const p = PRODUCTOS.find((x) => x.id === l.id_producto);
      if (!p) return espera({ ok: false as const, error: "Un producto de la lista no existe." });
      if (!p.controla_inventario) return espera({ ok: false as const, error: `«${p.nombre}» es un servicio: no lleva inventario.` });
      p.existencia = Number(p.existencia ?? 0) + l.cantidad;
      p.disponible = p.existencia > 0;
      unidades += l.cantidad;
      valor += l.cantidad * (l.costo ?? Number(p.costo ?? 0));
    }
    return espera({ ok: true as const, productos: lineas.length, unidades, valor: centavos(valor) }, 400);
  },
  // Sin base: valida lo mínimo para ver la interfaz (nombre y categoría en productos nuevos).
  importar: async (filas, actualizar, probar) => {
    const r: ResultadoImportacion = { creados: 0, actualizados: 0, saltados: 0, marcas_nuevas: [], errores: [], probado: probar };
    for (const f of filas) {
      const existe = f.codigo && PRODUCTOS.some((p) => p.codigo === String(f.codigo).toUpperCase());
      if (existe) {
        if (actualizar) r.actualizados++;
        else r.saltados++;
      } else if (!f.nombre) r.errores.push({ fila: f._fila, mensaje: "Falta el nombre." });
      else if (!f.categoria) r.errores.push({ fila: f._fila, mensaje: "Falta la categoría." });
      else if (typeof f.precio === "string") r.errores.push({ fila: f._fila, mensaje: "Hay un número o dato con formato no válido." });
      else r.creados++;
    }
    return espera({ ok: true as const, resultado: r }, 500);
  },
};

// ------------------------------------------------------------- reportes ---

/** Números inventados pero estables (misma fecha → mismo valor) para ver el tablero. */
function ruido(semilla: string) {
  let h = 2166136261;
  for (const c of semilla) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

const reportes: Apis["reportes"] = {
  leer: async (_id, desde, hasta) => {
    const dias = diasEntre(desde, hasta);
    const dia = (f: string) => {
      const semana = new Date(`${f}T00:00:00Z`).getUTCDay();
      const base = semana === 0 ? 0.2 : semana === 6 ? 1.3 : 1;
      const facturas = Math.round((3 + ruido(f) * 9) * base);
      return { fecha: f, facturas, ventas: centavos(facturas * (900 + ruido(`v${f}`) * 1900)) };
    };
    const serie = Array.from({ length: dias }, (_, i) => dia(sumarDias(desde, i)));
    const previa = Array.from({ length: dias }, (_, i) => dia(sumarDias(desde, i - dias)));
    const suma = (xs: typeof serie, k: "ventas" | "facturas") => centavos(xs.reduce((s, x) => s + x[k], 0));
    const v = suma(serie, "ventas");
    const va = suma(previa, "ventas") * 0.92;
    const f = suma(serie, "facturas");
    const fa = suma(previa, "facturas");
    const par = (valor: number, anterior: number) => ({ valor: centavos(valor), anterior: centavos(anterior) });
    const reparto = (nombres: string[], total: number) =>
      nombres.map((n, i) => ({ n, t: centavos(total * (0.34 / (i + 1)) * (0.8 + ruido(n) * 0.4)) })).sort((a, b) => b.t - a.t);
    const datos: DatosReporte = {
      periodo: { desde, hasta, dias },
      indicadores: {
        ventas: par(v, va),
        facturas: par(f, fa),
        ticket: par(f ? v / f : 0, fa ? va / fa : 0),
        utilidad: par(v / 1.15 * 0.36, va / 1.15 * 0.33),
        margen: par(36.2, 33.4),
        isv: par(v - v / 1.15, va - va / 1.15),
        descuentos: par(v * 0.018, va * 0.024),
        cotizado: par(v * 0.42, va * 0.47),
        anuladas: par(Math.round(dias / 14), Math.round(dias / 11)),
      },
      serie,
      rankings: {
        productos: PRODUCTOS.filter((p) => p.controla_inventario)
          .slice(0, 10)
          .map((p, i) => {
            const total = centavos((v * 0.16) / (i + 1.4));
            return { codigo: p.codigo, descripcion: p.nombre, cantidad: Math.max(1, Math.round(total / p.precio)), total, utilidad: centavos(total * 0.3) };
          }),
        categorias: reparto(["Pastillas de freno", "Aceite de motor", "Filtros de aceite", "Amortiguadores", "Bujías", "Baterías"], v).map((x) => ({ nombre: x.n, total: x.t })),
        vendedores: reparto(["Demo Sandbox", "Karla Mejía", "José Ramos"], v * 2.2).map((x, i) => ({ nombre: x.n, total: x.t, facturas: Math.round(f / (i + 1.6)) })),
        clientes: reparto(["CONSUMIDOR FINAL", "TRANSPORTES LÓPEZ S. DE R.L.", "TAXI RÁPIDO CAPITALINO", "JUAN PÉREZ"], v * 2).map((x, i) => ({ nombre: x.n, total: x.t, facturas: Math.max(1, Math.round(f / (i + 1.3))) })),
      },
    };
    return espera({ ok: true as const, datos }, 450);
  },
};

// ------------------------------------------------- apariencia de la empresa ---

// En el sandbox las imágenes quedan como URL locales del navegador; el
// escritorio guarda el resultado en su propio estado (IdentidadProvider).
const identidad: Apis["identidad"] = {
  subir: async (datos) => espera({ ok: true as const, url: URL.createObjectURL(datos.get("archivo") as File) }, 500),
  quitar: async () => espera({ ok: true as const }),
  guardarApariencia: async () => espera({ ok: true as const }, 300),
  guardarFormato: async () => espera({ ok: true as const }, 300),
};

// ------------------------------------------------------------- sitio web ---

let sitioDemo: EstadoSitio = {
  slug: null,
  sugerencia: "yonker-demo",
  publicado: false,
  config: normalizarSitio({}),
};

const pedidosDemo: PedidoWeb[] = [
  {
    id: "00000000-0000-0000-0000-00000000a001",
    numero: 1042,
    creado_en: new Date(Date.now() - 25 * 60_000).toISOString(),
    cliente_nombre: "María López",
    cliente_telefono: "98765432",
    cliente_correo: null,
    mensaje: "Lo paso a traer el sábado en la mañana.",
    vehiculo: "TOYOTA COROLLA 2008",
    estado: "nuevo",
    id_carrito: null,
    atendido_por: null,
    total_estimado: 1340.65,
    lineas: [
      { id: 1, codigo: "ACT1089", descripcion: "Pastillas de freno delanteras", cantidad: 1, precio: 980, exento: false },
      { id: 2, codigo: "PH4967", descripcion: "Filtro de aceite", cantidad: 1, precio: 185, exento: false },
    ],
  },
];

const sitioWeb: Apis["sitioWeb"] = {
  leer: async () => espera({ ok: true as const, sitio: sitioDemo }),
  guardar: async (cambio) => {
    sitioDemo = {
      ...sitioDemo,
      ...(cambio.slug !== undefined ? { slug: cambio.slug } : {}),
      ...(cambio.publicado !== undefined ? { publicado: cambio.publicado } : {}),
      config: cambio.config ? normalizarSitio({ ...sitioDemo.config, ...cambio.config }) : sitioDemo.config,
    };
    return espera({ ok: true as const, sitio: sitioDemo }, 300);
  },
  // En el sandbox la foto queda como URL local: el sitio público demo no la ve.
  subirFoto: async () => espera({ ok: false as const, error: "En el sandbox no se suben fotos del sitio." }),
  quitarFoto: async () => espera({ ok: true as const, sitio: sitioDemo }),
  buscarProductos: async (texto) =>
    espera(
      buscar({ texto, vehiculo: {} })
        .slice(0, 12)
        .map((p) => ({ id: p.id, nombre: p.nombre, codigo: p.codigo, imagen: null, publicable: p.disponible })),
    ),
  destacados: async (ids) =>
    espera(
      ids
        .map((id) => PRODUCTOS.find((p) => p.id === id))
        .filter(Boolean)
        .map((p) => ({ id: p!.id, nombre: p!.nombre, codigo: p!.codigo, imagen: null, publicable: true })),
    ),
  pedido: async (id) => espera(pedidosDemo.find((p) => p.id === id) ?? null),
  atender: async (id) => {
    const p = pedidosDemo.find((x) => x.id === id);
    if (!p) return { ok: false as const, error: "El pedido no existe." };
    p.estado = "atendido";
    p.atendido_por = "Demo Sandbox";
    return espera({ ok: true as const, carrito: carritos[0]?.id ?? "demo" });
  },
  cambiarEstado: async (id, estado) => {
    const p = pedidosDemo.find((x) => x.id === id);
    if (p) p.estado = estado;
    return espera({ ok: true as const });
  },
  pedidosNuevos: async () => espera(pedidosDemo.filter((p) => p.estado === "nuevo").length),
};

// --------------------------------------------------------- notificaciones ---

// Igual que el trigger de 0014: cada pedido web «nuevo» es una tarea pendiente.
const leidasDemo = new Set<string>();

const notificaciones: Apis["notificaciones"] = {
  leer: async () =>
    espera(
      armarBandeja(
        pedidosDemo.map((p) => ({
          id: `n-${p.id}`,
          tipo: "pedido_web",
          titulo: `Pedido web #${p.numero} · ${p.cliente_nombre}`,
          cuerpo: [p.vehiculo, p.mensaje].filter(Boolean).join(" · ") || null,
          enlace: { modulo: "ventas", seccion: "pedidos_web", recurso: "pedidos_web", id: p.id },
          esTarea: true,
          pendiente: p.estado === "nuevo",
          leida: leidasDemo.has(`n-${p.id}`),
          creadoEn: p.creado_en,
          resueltaEn: p.estado === "nuevo" ? null : new Date().toISOString(),
          resueltaPor: p.estado === "atendido" ? "Demo Sandbox" : null,
        })),
      ),
    ),
  marcarLeidas: async (ids) => {
    for (const p of pedidosDemo) if (!ids || ids.includes(`n-${p.id}`)) leidasDemo.add(`n-${p.id}`);
  },
};

/** Sandbox: simula que entra un pedido web nuevo (para ver la campanita y el aviso). */
const SIMULADOS = [
  { cliente_nombre: "Carlos Mejía", vehiculo: "NISSAN FRONTIER 2012", mensaje: "¿Tienen el filtro original?" },
  { cliente_nombre: "Taller Hermanos Reyes", vehiculo: "TOYOTA HILUX 2015", mensaje: "Necesito 4 amortiguadores, ¿hacen descuento?" },
  { cliente_nombre: "Daniela Castro", vehiculo: "HONDA CIVIC 2009", mensaje: null },
];

export function simularPedidoWeb() {
  const numero = 1043 + pedidosDemo.length;
  const quien = SIMULADOS[(pedidosDemo.length - 1) % SIMULADOS.length];
  pedidosDemo.unshift({
    ...pedidosDemo[pedidosDemo.length - 1],
    id: `00000000-0000-0000-0000-${String(numero).padStart(12, "0")}`,
    numero,
    creado_en: new Date().toISOString(),
    ...quien,
    estado: "nuevo",
  });
}

// ------------------------------------------------ tablas genéricas (demo) ---

const HOY = Date.now();
const haceDias = (d: number) => new Date(HOY - d * 86_400_000).toISOString();

const MARCAS = [...new Set(PRODUCTOS.map((p) => p.marca).filter(Boolean) as string[])].sort();
const idMarca = (nombre: string | null) => (nombre ? MARCAS.indexOf(nombre) + 1 : null);
const CATEGORIAS = [...new Map(PRODUCTOS.map((p) => [p.id_categoria, p.categoria])).entries()];

/** Filas «de la vista» de cada recurso, calculadas de los datos vivos de la demo. */
const BASES: Record<string, () => Fila[]> = {
  productos: () =>
    PRODUCTOS.map((p) => {
      const precioFinal = Math.round(p.precio * (p.exento ? 1 : 1.15) * 100) / 100;
      return {
        id: p.id,
        imagen: fotos.get(p.id)?.[0]?.ruta_miniatura ?? fotos.get(p.id)?.[0]?.ruta ?? null,
        codigo: p.codigo,
        nombre: p.nombre,
        categoria_ruta: p.categoria,
        marca: p.marca,
        oem: p.oem,
        numero_parte: p.numero_parte,
        referencias: null,
        existencia: p.existencia,
        existencia_minima: 2,
        costo: p.costo,
        precio: p.precio,
        precio_final: precioFinal,
        utilidad: p.precio - (p.costo ?? 0),
        margen: p.precio > 0 ? Math.round(((p.precio - (p.costo ?? 0)) / p.precio) * 10000) / 100 : null,
        compatibilidades: compat.filter((f) => productoDe(f) === p.id).length || null,
        ubicacion: p.ubicacion,
        condicion: p.condicion,
        unidad: p.unidad,
        activo: true,
        visible_catalogo: true,
        actualizado_en: haceDias(p.id % 9),
        id_categoria: p.id_categoria,
        id_marca_producto: idMarca(p.marca),
        bajo_minimo: p.controla_inventario && (p.existencia ?? 0) <= 2,
        exento: p.exento,
        controla_inventario: p.controla_inventario,
        descripcion: null,
        notas: null,
        codigo_barras: null,
      };
    }),
  movimientos: () => [
    ...PRODUCTOS.map((p) => ({
      id: p.id,
      creado_en: haceDias(30),
      codigo: p.codigo,
      producto: p.nombre,
      tipo: "inicial",
      cantidad: (p.existencia ?? 0) + 2,
      existencia: (p.existencia ?? 0) + 2,
      referencia: "Inventario inicial",
      usuario: "Ana Demo",
    })),
    ...documentos
      .filter((d) => d.tipo === "factura")
      .flatMap((d, i) =>
        d.lineas.map((l, j) => ({
          id: 10_000 + i * 100 + j,
          creado_en: d.fecha,
          codigo: l.codigo,
          producto: l.descripcion,
          tipo: "venta",
          cantidad: -l.cantidad,
          existencia: PRODUCTOS.find((p) => p.codigo === l.codigo)?.existencia ?? null,
          referencia: d.numero,
          usuario: d.vendedor,
        })),
      ),
  ],
  marcas_productos: () =>
    MARCAS.map((nombre, i) => ({
      id: i + 1,
      nombre,
      pais: null,
      global: true,
      productos: PRODUCTOS.filter((p) => p.marca === nombre).length,
      activa: true,
      id_empresa: null,
    })),
  categorias: () =>
    CATEGORIAS.map(([id, nombre], i) => ({
      id,
      ruta: nombre,
      nivel: 1,
      sinonimos: PRODUCTOS.find((p) => p.id_categoria === id)?.sinonimos ?? null,
      subcategorias: 0,
      relacionadas: RELACIONES[id]?.length ?? 0,
      es_servicio: /mano de obra|servicio/i.test(nombre),
      orden: i,
      slug: nombre.toLowerCase().replace(/\W+/g, "-"),
      activa: true,
      global: true,
      id_padre: null,
      orden_arbol: String(i).padStart(4, "0"),
      id_empresa: null,
    })),
  puntos_emision: () => [
    {
      id: PUNTO_DEMO.id,
      codigo: PUNTO_DEMO.codigo,
      establecimiento: "000",
      punto_emision: "001",
      nombre: PUNTO_DEMO.nombre,
      sucursal: PUNTO_DEMO.sucursal,
      etiqueta: `${PUNTO_DEMO.codigo} · ${PUNTO_DEMO.nombre}`,
      direccion: "Tegucigalpa, Francisco Morazán",
      telefono: null,
      predeterminado: true,
      usuarios: 0,
      cai_vigentes: 3,
      activo: true,
    },
  ],
  clientes: () =>
    clientes.map((c) => {
      const docs = documentos.filter((d) => d.cliente_nombre === c.nombre);
      return {
        id: c.id,
        nombre: c.nombre,
        rtn: c.rtn,
        telefono: c.telefono,
        correo: null,
        direccion: null,
        facturas: docs.filter((d) => d.tipo === "factura").length,
        ultima_compra: docs.at(-1)?.fecha ?? null,
        activo: true,
        exonerado: Boolean(c.exonerado),
        exo_constancia: c.exo_constancia ?? null,
        exo_registro_sag: null,
        credito_habilitado: Boolean(c.credito_habilitado),
        limite_credito: c.limite_credito ?? null,
        dias_credito: c.dias_credito ?? 30,
        saldo: creditoDemo(c.id)?.pendiente ?? 0,
      };
    }),
  cuentas_clientes: () =>
    clientes
      .map((c) => creditoDemo(c.id))
      .filter((c): c is CreditoCliente => c !== null)
      .map((c) => {
        const pend = cuentasDemo().filter((f) => f.id_cliente === c.id && f.pendiente > 0);
        return {
          ...c,
          proximo_vence: pend.map((f) => f.vence).sort()[0] ?? null,
          en_mora: c.vencido > 0,
          estado: c.vencido > 0 ? "vencida" : c.pendiente > 0 ? "al_dia" : c.pendiente < 0 ? "a_favor" : "sin_saldo",
        };
      }),
  cajas_turnos: () =>
    turnosDemo
      .map(turnoCompletoDemo)
      .map((t) => ({
        id: t.id,
        numero: t.numero,
        punto: t.punto,
        estado: t.estado,
        abierta_en: t.abierta_en,
        abierta_por: t.abierta_por,
        cerrada_en: t.cerrada_en,
        cerrada_por: t.cerrada_por,
        facturas: t.resumen.facturas,
        total_cobrado: t.resumen.total_cobrado,
        fondo_inicial: t.fondo_inicial,
        efectivo_esperado: t.resumen.esperado_efectivo,
        efectivo_contado: t.efectivo_contado,
        diferencia: t.diferencia,
        notas: t.notas,
        descuadre: (t.diferencia ?? 0) !== 0,
      })),
  pagos: () =>
    pagosDemo.map((p) => ({
      id: p.id,
      fecha: p.fecha,
      numero: p.numero,
      cliente_nombre: p.cliente_nombre,
      monto: p.monto,
      forma_pago: p.forma_pago,
      referencia: p.referencia,
      facturas: p.aplicaciones.map((a) => documentos.find((d) => d.id === a.id_documento)?.numero).join(", "),
      estado: p.estado,
      cobro: p.cobro,
    })),
  cai: () =>
    (["factura", "nota_credito", "nota_debito"] as const).map((tipo, i) => ({
      id: i + 1,
      cai: CAI_DEMO[tipo],
      tipo_documento: CODIGO_TIPO_DOCUMENTO[tipo],
      establecimiento: "000",
      punto_emision: "001",
      punto: PUNTO_DEMO.nombre,
      id_punto_emision: PUNTO_DEMO.id,
      rango_inicial: 1,
      rango_final: 500,
      siguiente: correlativos[tipo],
      disponibles: 501 - correlativos[tipo],
      usado_pct: Math.round(((correlativos[tipo] - 1) / 500) * 10000) / 100,
      fecha_limite: "2027-03-31",
      dias_restantes: Math.ceil((new Date(2027, 2, 31).getTime() - HOY) / 86_400_000),
      vigente: true,
      activo: true,
    })),
  documentos: () =>
    documentos.map((d) => ({
      id: d.id,
      fecha: d.fecha,
      tipo: d.tipo,
      numero: d.numero,
      cliente_nombre: d.cliente_nombre,
      cliente_rtn: d.cliente_rtn,
      vehiculo: d.vehiculo,
      total: d.total,
      isv: d.isv,
      descuento: d.descuento,
      estado: d.estado,
      vence: d.vence,
      vendedor: d.vendedor,
      factura_numero: d.factura_numero,
      punto: d.cai ? PUNTO_DEMO.codigo : null,
      exonerada: d.exoneracion != null,
      importe_exonerado: d.importe_exonerado,
      condicion: d.condicion,
      pendiente: cuentasDemo().find((f) => f.id === d.id)?.pendiente ?? null,
    })),
  notas: () =>
    documentos
      .filter((d) => d.tipo === "nota_credito" || d.tipo === "nota_debito")
      .map((d) => ({
        id: d.id,
        fecha: d.fecha,
        tipo: d.tipo,
        numero: d.numero,
        cliente_nombre: d.cliente_nombre,
        cliente_rtn: d.cliente_rtn,
        id_factura: d.id_factura,
        factura_numero: d.factura_numero,
        con_factura: d.id_factura != null,
        motivo_tipo: d.motivo_tipo,
        motivo: d.motivo,
        isv: d.isv,
        total: d.total,
        forma_pago: d.id_factura ? (documentos.find((f) => f.id === d.id_factura)?.forma_pago ?? null) : (d.forma_pago ?? null),
        estado: d.estado,
        punto: PUNTO_DEMO.codigo,
        emitio: d.vendedor,
      })),
  pedidos_web: () =>
    pedidosDemo.map((p) => ({
      id: p.id,
      numero: p.numero,
      creado_en: p.creado_en,
      estado: p.estado,
      cliente_nombre: p.cliente_nombre,
      cliente_telefono: p.cliente_telefono,
      vehiculo: p.vehiculo,
      lineas: p.lineas.length,
      total_estimado: p.total_estimado,
      atendido_por: p.atendido_por,
      mensaje: p.mensaje,
    })),
  miembros: () => [
    { id_usuario: "00000000-0000-0000-0000-000000000000", nombre: "Ana Demo", correo: "ana@yonkerdemo.hn", telefono: "9876-0000", rol: "dueno", activo: true, creado_en: haceDias(120) },
    { id_usuario: "00000000-0000-0000-0000-000000000001", nombre: "Luis Vendedor", correo: "luis@yonkerdemo.hn", telefono: null, rol: "vendedor", activo: true, creado_en: haceDias(60) },
  ],
  invitaciones: () => [
    { id: 1, correo: "caja@yonkerdemo.hn", rol: "vendedor", invitado_por: "Ana Demo", creado_en: haceDias(2) },
  ],
  actividad: () =>
    [
      ["sesion", "info", "sesion.inicio", "Inició sesión", "Ana Demo", 0.02],
      ["cambio", "info", "productos.editar", "Cambió el precio de Filtro de aceite", "Ana Demo", 0.5],
      ["cambio", "info", "documentos.crear", "Emitió una cotización", "Luis Vendedor", 1.2],
      ["sesion", "info", "sesion.inicio", "Inició sesión", "Luis Vendedor", 1.3],
      ["cambio", "aviso", "productos.eliminar", "Eliminó un producto duplicado", "Ana Demo", 3],
    ].map(([tipo, nivel, evento, mensaje, usuario, dias], i) => ({
      id: i + 1,
      creado_en: haceDias(dias as number),
      tipo,
      nivel,
      evento,
      mensaje,
      usuario,
      correo: null,
      ip: "190.92.0.10",
      dispositivo: i % 2 ? "Celular · Android 14 · Chrome" : "Computadora · Windows · Edge",
      ruta: "/inicio",
    })),
};
BASES.actividad_plataforma = BASES.actividad;

// Lo que el visitante crea, edita o elimina en la demo (vive solo en esta pestaña).
const creados: Record<string, Fila[]> = {};
const editados: Record<string, Map<string, Fila>> = {};
const eliminados: Record<string, Set<string>> = {};
let siguienteId = 90_000;

function filasDemo(recurso: string): Fila[] | null {
  const base = BASES[recurso];
  if (!base) return null;
  const clave = obtenerRecurso(recurso).clave;
  const cambios = editados[recurso];
  const fuera = eliminados[recurso];
  return [...(creados[recurso] ?? []), ...base()]
    .filter((f) => !fuera?.has(String(f[clave])))
    .map((f) => ({ ...f, ...(cambios?.get(String(f[clave])) ?? {}) }));
}

/** Etiquetas de relaciones para que una fila nueva o editada se vea bien en la tabla. */
function completar(recurso: string, datos: Valores): Fila {
  if (recurso !== "productos") return datos;
  const precio = Number(datos.precio ?? 0);
  const costo = Number(datos.costo ?? 0);
  return {
    ...datos,
    categoria_ruta: CATEGORIAS.find(([id]) => id === Number(datos.id_categoria))?.[1] ?? null,
    marca: MARCAS[Number(datos.id_marca_producto) - 1] ?? null,
    precio_final: Math.round(precio * (datos.exento ? 1 : 1.15) * 100) / 100,
    utilidad: precio - costo,
    margen: precio > 0 ? Math.round(((precio - costo) / precio) * 10000) / 100 : null,
  };
}

const recursos: Apis["recursos"] = {
  // Lo que no tiene datos de demo (catálogo de vehículos) se lee del real: es público.
  consultar: async (recurso, consulta) => {
    const filas = filasDemo(recurso);
    if (!filas) return apiRecursos.consultar(recurso, consulta);
    return espera(consultarEnMemoria(obtenerRecurso(recurso), filas, consulta), 160);
  },
  opciones: async (recurso, o) => {
    const filas = filasDemo(recurso);
    if (!filas) return apiRecursos.opciones(recurso, o);
    return espera(opcionesEnMemoria(filas, o));
  },
  leer: async (recurso, clave) => {
    const filas = filasDemo(recurso);
    if (!filas) return apiRecursos.leer(recurso, clave);
    const k = obtenerRecurso(recurso).clave;
    return espera(filas.find((f) => String(f[k]) === String(clave)) ?? null);
  },
  guardar: async (recurso, clave, valores) => {
    const def = obtenerRecurso(recurso);
    if (!BASES[recurso] || def.escritura === "ninguna") {
      return { ok: false as const, error: "En la demo esto no se puede cambiar." };
    }
    const v = validarValores(def.campos, valores, { edicion: clave !== null });
    if (!v.ok) return { ok: false as const, error: "Revisá los campos marcados.", errores: v.errores };
    const datos = completar(recurso, v.datos);
    if (clave === null) {
      const id = siguienteId++;
      const fila: Fila = { ...datos, [def.clave]: id, activo: datos.activo ?? true, creado_en: new Date().toISOString() };
      if (recurso === "productos") {
        // También al mostrador: así se puede vender lo que se acaba de crear.
        PRODUCTOS.unshift(
          P(id, String(datos.codigo), String(datos.nombre), (fila.marca as string) ?? null, Number(datos.id_categoria),
            String(fila.categoria_ruta ?? ""), "", Number(datos.precio ?? 0), Number(datos.costo ?? 0),
            Number(datos.existencia ?? 0)),
        );
      } else {
        (creados[recurso] ??= []).unshift(fila);
      }
      if (recurso === "clientes") clientes.push({ id, nombre: String(datos.nombre), rtn: (datos.rtn as string) ?? null, telefono: (datos.telefono as string) ?? null });
      return espera({ ok: true as const, id }, 300);
    }
    (editados[recurso] ??= new Map()).set(String(clave), { ...(editados[recurso].get(String(clave)) ?? {}), ...datos });
    if (recurso === "productos") {
      const p = PRODUCTOS.find((x) => String(x.id) === String(clave));
      if (p) Object.assign(p, { nombre: datos.nombre ?? p.nombre, codigo: datos.codigo ?? p.codigo, precio: Number(datos.precio ?? p.precio), costo: Number(datos.costo ?? p.costo) });
    }
    return espera({ ok: true as const, id: clave }, 300);
  },
  eliminar: async (recurso, clave) => {
    const def = obtenerRecurso(recurso);
    if (!BASES[recurso] || def.escritura === "ninguna") return { ok: false as const, error: "En la demo esto no se puede eliminar." };
    (eliminados[recurso] ??= new Set()).add(String(clave));
    return espera({ ok: true as const });
  },
  leerPreferencias: async () => null,
  guardarPreferencias: async () => {},
};

// ---------------------------------------------------------- empresa y perfil ---

let empresaDemo = {
  nombre: "Yonker Demo",
  razon_social: "Yonker Demo S. de R.L.",
  rtn: "08019015123456",
  telefono: "2556-1234",
  correo: "ventas@yonkerdemo.hn",
  direccion: "Barrio Guamilito, 6 calle, San Pedro Sula",
  paleta: "rojo-negro",
  creado_en: haceDias(120),
  descuento_maximo_vendedor: 10,
};

const empresa: Apis["empresa"] = {
  leer: async () => espera({ ...empresaDemo }),
  actualizar: async (valores) => {
    const v = validarValores(CAMPOS_TALLER, valores);
    if (!v.ok) return { ok: false as const, error: "Revisá los campos marcados.", errores: v.errores };
    empresaDemo = { ...empresaDemo, ...(v.datos as Partial<typeof empresaDemo>) };
    return espera({ ok: true as const, id: "demo" }, 300);
  },
  cargarDemo: async () => espera({ ok: true as const, productos: 0, compatibilidades: 0, clientes: 0 }, 400),
  cambiarPaleta: async () => ({ ok: true as const }),
};

let perfilDemo = { nombre: "Ana Demo", telefono: "9876-0000", id_empresa_activa: "demo", creado_en: haceDias(120) };

const perfil: Apis["perfil"] = {
  leer: async () => espera({ ...perfilDemo }),
  actualizar: async (valores) => {
    const v = validarValores(CAMPOS_PERFIL, valores);
    if (!v.ok) return { ok: false as const, error: "Revisá los campos marcados.", errores: v.errores };
    perfilDemo = { ...perfilDemo, ...(v.datos as Partial<typeof perfilDemo>) };
    return espera({ ok: true as const, id: "demo" }, 300);
  },
  restablecerTablas: async () => ({ ok: true as const }),
  marcarRecorrido: async () => ({ ok: true as const }),
  // El dock de la demo vive en el navegador (copia local que guarda el propio dock).
  guardarDock: async () => ({ ok: true as const }),
};

const cobros: Apis["cobros"] = {
  cartera: async () => espera(cuentasDemo().filter((f) => f.pendiente > 0)),
  credito: async (id) => espera(creditoDemo(id)),
  estadoDeCuenta: async (id) => {
    const cliente = creditoDemo(id);
    if (!cliente) return espera(null);
    return espera({
      cliente,
      facturas: cuentasDemo()
        .filter((f) => f.id_cliente === id && f.pendiente !== 0)
        .sort((a, b) => a.vence.localeCompare(b.vence)),
      recibos: pagosDemo
        .filter((p) => p.id_cliente === id)
        .reverse()
        .map((p) => ({ id: p.id, numero: p.numero, fecha: p.fecha, monto: p.monto, forma_pago: p.forma_pago, estado: p.estado })),
    });
  },
  registrarAbono: async (a) => {
    const cli = clientes.find((c) => c.id === a.id_cliente);
    if (!cli) return { ok: false as const, error: "El cliente no existe." };
    if (cajaObligatoriaDemo && !turnoAbiertoDemo()) {
      return { ok: false as const, error: "Abrí la caja (módulo Caja) antes de registrar un abono." };
    }
    const cuentas = cuentasDemo().filter((f) => f.id_cliente === cli.id && f.pendiente > 0);
    const total = centavos(cuentas.reduce((s, f) => s + f.pendiente, 0));
    if (a.monto > total) return { ok: false as const, error: `El abono supera lo pendiente del cliente (L ${total.toFixed(2)}).` };
    for (const ap of a.aplicaciones) {
      const f = cuentas.find((x) => x.id === ap.id_documento);
      if (!f || ap.monto > f.pendiente) return { ok: false as const, error: "Revisá el reparto entre facturas." };
    }
    const id = crypto.randomUUID();
    const numero = `REC-${String(correlativoRecibo++).padStart(6, "0")}`;
    pagosDemo.push({
      id,
      numero,
      fecha: new Date().toISOString(),
      id_cliente: cli.id,
      cliente_nombre: cli.nombre,
      cliente_rtn: cli.rtn,
      monto: a.monto,
      forma_pago: a.forma_pago,
      referencia: a.referencia ?? null,
      notas: a.notas || null,
      estado: "emitido",
      motivo_anulacion: null,
      cobro: "Demo Sandbox",
      aplicaciones: a.aplicaciones,
      id_turno: turnoAbiertoDemo()?.id ?? null,
    });
    guardarReciboDemo(id);
    return espera({ ok: true as const, id, numero }, 400);
  },
  anularAbono: async (id, motivo) => {
    const p = pagosDemo.find((x) => x.id === id);
    if (!p) return { ok: false as const, error: "El recibo no existe." };
    p.estado = "anulado";
    p.motivo_anulacion = motivo;
    guardarReciboDemo(id);
    return espera({ ok: true as const });
  },
  recibo: async (id) => espera(reciboDemo(id)),
  urlRecibo: (id) => `/demo/documento?recibo=${id}`,
};

const caja: Apis["caja"] = {
  estado: async () => {
    const t = turnoAbiertoDemo();
    return espera({
      punto: { id: PUNTO_DEMO.id, codigo: PUNTO_DEMO.codigo, nombre: PUNTO_DEMO.nombre },
      turno: t ? turnoCompletoDemo(t) : null,
      obligatoria: cajaObligatoriaDemo,
    });
  },
  turno: async (id) => {
    const t = turnosDemo.find((x) => x.id === id);
    return espera(t ? turnoCompletoDemo(t) : null);
  },
  abrir: async (fondo) => {
    if (turnoAbiertoDemo()) return { ok: false as const, error: "Caja principal ya está abierta." };
    if (!(fondo >= 0)) return { ok: false as const, error: "El fondo inicial no puede ser negativo." };
    const t: TurnoDemo = {
      id: crypto.randomUUID(),
      numero: turnosDemo.length + 1,
      abierta_en: new Date().toISOString(),
      fondo: centavos(fondo),
      estado: "abierta",
      cerrada_en: null,
      contado: null,
      arqueo: null,
      notas: null,
      manuales: [],
    };
    turnosDemo.push(t);
    return espera({ ok: true as const, id: t.id }, 300);
  },
  movimiento: async (id, tipo, monto, concepto) => {
    const t = turnosDemo.find((x) => x.id === id && x.estado === "abierta");
    if (!t) return { ok: false as const, error: "La caja ya se cerró." };
    t.manuales.push({ id: siguienteManual++, tipo, monto: centavos(monto), concepto, fecha: new Date().toISOString() });
    return espera({ ok: true as const });
  },
  cerrar: async (id, contado, arqueo, notas) => {
    const t = turnosDemo.find((x) => x.id === id && x.estado === "abierta");
    if (!t) return { ok: false as const, error: "La caja ya se cerró." };
    const esperado = turnoCompletoDemo(t).resumen.esperado_efectivo;
    const dif = centavos(contado - esperado);
    if (dif !== 0 && !notas.trim()) {
      return { ok: false as const, error: `La caja no cuadra por L ${Math.abs(dif).toFixed(2)}: escribí una nota que lo explique.` };
    }
    Object.assign(t, {
      estado: "cerrada",
      cerrada_en: new Date().toISOString(),
      contado: centavos(contado),
      arqueo: arqueo && totalArqueo(arqueo) > 0 ? arqueo : null,
      notas: notas.trim() || null,
    });
    guardarCorteDemo(id);
    return espera({ ok: true as const }, 400);
  },
  obligatoria: async (valor) => {
    cajaObligatoriaDemo = valor;
    return espera({ ok: true as const });
  },
  urlCorte: (id) => {
    guardarCorteDemo(id);
    return `/demo/documento?corte=${id}`;
  },
};

const exportacion: Apis["exportacion"] = {
  datos: async () => {
    const de = (recurso: string) => (filasDemo(recurso) ?? []).map((f) => aplanar(f as Record<string, unknown>));
    const filas: Record<string, Record<string, unknown>[]> = {
      "01 Empresa": [{ ...EMISOR_DEMO }],
      "02 Usuarios": de("miembros"),
      "03 Puntos de emision": de("puntos_emision"),
      "04 CAI": de("cai"),
      "05 Productos": de("productos"),
      "07 Kardex": de("movimientos"),
      "08 Categorias propias": [],
      "09 Marcas propias": [],
      "11 Clientes": de("clientes"),
      "12 Documentos": documentos.map((d) => aplanar(Object.fromEntries(Object.entries(d).filter(([k]) => k !== "lineas")))),
      "13 Lineas de documentos": documentos.flatMap((d) =>
        d.lineas.map((l) => ({ documentos_numero: d.numero, documentos_tipo: d.tipo, ...l })),
      ),
      "14 Cuentas por cobrar": cuentasDemo(),
      "15 Abonos": pagosDemo.map((p) => Object.fromEntries(Object.entries(p).filter(([k]) => k !== "aplicaciones"))),
      "17 Turnos de caja": de("cajas_turnos"),
      "19 Pedidos web": de("pedidos_web"),
    };
    return espera(
      {
        ok: true as const,
        datos: {
          empresa: EMISOR_DEMO.nombre ?? "Yonker Demo",
          generado: new Date().toISOString(),
          hojas: FUENTES_EXPORTACION.map((f) => ({ archivo: f.archivo, filas: filas[f.archivo] ?? [] })),
        },
      },
      500,
    );
  },
};

// ---------------------------------------------------------- compras (demo) --

type CompraDemo = Omit<Compra, "pendiente" | "pagos" | "de_caja" | "registro"> & { id_turno: string | null; creado_en: string };
type PagoProvDemo = Omit<PagoProveedor, "aplicaciones" | "de_caja" | "pago"> & {
  id_turno: string | null;
  aplicaciones: { id_compra: string; monto: number }[];
};

const proveedoresDemo: (ProveedorBreve & { contacto: string | null })[] = [
  { id: 1, nombre: "DISTRIBUIDORA DE REPUESTOS DEL NORTE", rtn: "05019005123456", telefono: "2550-1100", dias_credito: 30, contacto: "Karla Mejía" },
  { id: 2, nombre: "LUBRICANTES Y FILTROS S.A.", rtn: "08019011987654", telefono: "2238-4400", dias_credito: 15, contacto: null },
  { id: 3, nombre: "ENEE", rtn: null, telefono: null, dias_credito: 0, contacto: null },
];
const comprasDemo: CompraDemo[] = [];
const pagosProvDemo: PagoProvDemo[] = [];
let correlativoCompra = 1;
let correlativoPagoProv = 1;

/** Proveedores de la demo: los sembrados y los que el visitante crea desde la tabla. */
const proveedoresVivos = (): (ProveedorBreve & { activo: boolean })[] =>
  (filasDemo("proveedores") ?? []).map((f) => ({
    id: Number(f.id),
    nombre: String(f.nombre),
    rtn: (f.rtn as string) ?? null,
    telefono: (f.telefono as string) ?? null,
    dias_credito: Number(f.dias_credito ?? 0),
    activo: f.activo !== false,
  }));

const pagadoDemo = (id: string) =>
  centavos(
    pagosProvDemo
      .filter((x) => x.estado === "emitido")
      .flatMap((x) => x.aplicaciones)
      .filter((a) => a.id_compra === id)
      .reduce((s, a) => s + a.monto, 0),
  );

/** Igual que v_cuentas_pagar. */
function cuentasPagarDemo(): CuentaCompra[] {
  const hoy = hoyIso();
  return comprasDemo
    .filter((c) => c.condicion === "credito" && c.estado === "emitido")
    .map((c) => {
      const pagado = pagadoDemo(c.id);
      const pendiente = centavos(c.total - pagado);
      const vence = c.vence!;
      const dias = Math.max(diasEntreFechas(hoy, vence), 0);
      const estado: CuentaCompra["estado"] =
        pendiente <= 0 ? "pagada" : hoy > vence ? "vencida" : diasEntreFechas(vence, hoy) <= 7 ? "por_vencer" : "al_dia";
      return {
        id: c.id,
        numero: c.numero,
        documento: c.documento,
        fecha: c.fecha,
        vence,
        id_proveedor: c.id_proveedor,
        proveedor_nombre: c.proveedor_nombre,
        total: c.total,
        pagado,
        pendiente,
        dias_vencida: dias,
        estado,
      };
    });
}

function nuevaCompraDemo(d: Omit<CompraDemo, "id" | "numero" | "creado_en" | "estado" | "motivo_anulacion">): CompraDemo {
  const c: CompraDemo = {
    ...d,
    id: crypto.randomUUID(),
    numero: `COMP-${String(correlativoCompra++).padStart(6, "0")}`,
    creado_en: new Date().toISOString(),
    estado: "emitido",
    motivo_anulacion: null,
  };
  comprasDemo.push(c);
  return c;
}

// Una compra al crédito de hace 12 días para ver Por pagar con algo.
(function sembrarCompras() {
  const lineas = PRODUCTOS.filter((x) => x.controla_inventario).slice(0, 3).map((x, i) => ({
    id: i + 1,
    codigo: x.codigo,
    descripcion: x.nombre,
    cantidad: 10,
    costo: Number(x.costo ?? 100),
    exento: false,
    total: centavos(10 * Number(x.costo ?? 100)),
  }));
  const t = totalesCompra(lineas.map((l) => ({ neto: l.total, exento: false })), null);
  const fecha = haceDias(12).slice(0, 10);
  nuevaCompraDemo({
    tipo: "inventario",
    fecha,
    id_proveedor: 1,
    proveedor_nombre: proveedoresDemo[0].nombre,
    proveedor_rtn: proveedoresDemo[0].rtn,
    documento: "001-001-01-00004512",
    cai_proveedor: null,
    condicion: "credito",
    vence: sumarDiasIso(fecha, 30),
    forma_pago: null,
    referencia_pago: null,
    subtotal: t.subtotal,
    importe_exento: t.exento,
    importe_gravado: t.gravado,
    isv: t.isv,
    total: t.total,
    notas: null,
    id_turno: null,
    lineas,
  });
})();

const compras: Apis["compras"] = {
  proveedores: async (texto) => {
    const q = normal(texto.trim());
    return espera(
      proveedoresVivos()
        .filter((x) => x.activo && (!q || normal(x.nombre).includes(q) || (x.rtn ?? "").includes(q.replace(/\D/g, "") || "~")))
        .slice(0, 8),
    );
  },
  crearProveedor: async (d) => {
    const nombre = d.nombre.trim().toUpperCase();
    if (!nombre) return { ok: false as const, error: "Escribí el nombre del proveedor." };
    const rtn = d.rtn ? d.rtn.replace(/\D/g, "") : null;
    if (rtn && rtn.length !== 14) return { ok: false as const, error: "El RTN son 14 dígitos." };
    const p = { id: siguienteId++, nombre, rtn, telefono: null, dias_credito: Number(d.dias_credito ?? 0), contacto: null };
    proveedoresDemo.push(p);
    return espera({ ok: true as const, proveedor: p }, 250);
  },
  registrar: async (n) => {
    const prov = proveedoresVivos().find((x) => x.id === n.id_proveedor);
    if (!prov) return { ok: false as const, error: "Elegí el proveedor." };
    const documento = n.documento?.trim().toUpperCase() || null;
    if (documento && comprasDemo.some((c) => c.id_proveedor === prov.id && c.documento === documento && c.estado === "emitido")) {
      return { ok: false as const, error: `La factura ${documento} de ${prov.nombre} ya está registrada.` };
    }
    const turno = n.de_caja && n.forma_pago === "efectivo" ? turnoAbiertoDemo() : null;
    if (n.de_caja && n.condicion === "contado" && n.forma_pago === "efectivo" && !turno) {
      return { ok: false as const, error: "No hay caja abierta en tu punto: abrila o desmarcá «Sale de la caja»." };
    }
    const lineas: CompraDemo["lineas"] = [];
    for (const [i, l] of n.lineas.entries()) {
      if ("id_producto" in l) {
        const p = PRODUCTOS.find((x) => x.id === l.id_producto);
        if (!p || !p.controla_inventario) return { ok: false as const, error: `Línea ${i + 1}: el producto no lleva inventario.` };
        const existencia = Number(p.existencia ?? 0);
        const costo = Number(p.costo ?? 0);
        p.costo = existencia <= 0 ? l.costo : centavos((existencia * costo + l.cantidad * l.costo) / (existencia + l.cantidad));
        p.existencia = existencia + l.cantidad;
        p.disponible = p.existencia > 0;
        lineas.push({ id: i + 1, codigo: p.codigo, descripcion: p.nombre, cantidad: l.cantidad, costo: l.costo, exento: l.exento, total: centavos(l.cantidad * l.costo) });
      } else {
        lineas.push({ id: i + 1, codigo: null, descripcion: l.descripcion, cantidad: 1, costo: l.monto, exento: l.exento, total: centavos(l.monto) });
      }
    }
    const t = totalesCompra(lineas.map((l) => ({ neto: l.total, exento: l.exento })), n.isv);
    if (!t.isvValido) return { ok: false as const, error: "El ISV no cuadra con lo gravado." };
    const c = nuevaCompraDemo({
      tipo: n.tipo,
      fecha: n.fecha,
      id_proveedor: prov.id,
      proveedor_nombre: prov.nombre,
      proveedor_rtn: prov.rtn,
      documento,
      cai_proveedor: n.cai?.toUpperCase() || null,
      condicion: n.condicion,
      vence: n.condicion === "credito" ? n.vence || sumarDiasIso(n.fecha, prov.dias_credito) : null,
      forma_pago: n.condicion === "contado" ? n.forma_pago : null,
      referencia_pago: n.condicion === "contado" ? n.referencia : null,
      subtotal: t.subtotal,
      importe_exento: t.exento,
      importe_gravado: t.gravado,
      isv: t.isv,
      total: t.total,
      notas: n.notas,
      id_turno: n.condicion === "contado" ? (turno?.id ?? null) : null,
      lineas,
    });
    return espera({ ok: true as const, id: c.id, numero: c.numero }, 450);
  },
  compra: async (id) => {
    const c = comprasDemo.find((x) => x.id === id);
    if (!c) return espera(null);
    const { id_turno, creado_en: _creado, ...resto } = c;
    void _creado;
    return espera({
      ...resto,
      de_caja: id_turno !== null,
      registro: "Demo Sandbox",
      pendiente: cuentasPagarDemo().find((x) => x.id === id)?.pendiente ?? null,
      pagos: pagosProvDemo.flatMap((x) =>
        x.aplicaciones.filter((a) => a.id_compra === id).map((a) => ({ id: x.id, numero: x.numero, fecha: x.fecha, monto: a.monto, estado: x.estado })),
      ),
    });
  },
  anular: async (id, motivo) => {
    const c = comprasDemo.find((x) => x.id === id);
    if (!c || c.estado === "anulado") return { ok: false as const, error: "La compra no se puede anular." };
    if (!motivo.trim()) return { ok: false as const, error: "Escribí el motivo de la anulación." };
    if (pagadoDemo(id) > 0) return { ok: false as const, error: "Esta compra tiene pagos: anulá primero los pagos al proveedor." };
    c.estado = "anulado";
    c.motivo_anulacion = motivo.trim();
    if (c.tipo === "inventario") {
      for (const l of c.lineas) {
        const p = PRODUCTOS.find((x) => x.codigo === l.codigo);
        if (p) {
          p.existencia = Number(p.existencia ?? 0) - l.cantidad;
          p.disponible = p.existencia > 0;
        }
      }
    }
    return espera({ ok: true as const });
  },
  cartera: async () => espera(cuentasPagarDemo().filter((c) => c.pendiente > 0)),
  estadoProveedor: async (idProveedor) => {
    const prov = proveedoresVivos().find((x) => x.id === idProveedor);
    if (!prov) return espera(null);
    const lista = cuentasPagarDemo().filter((c) => c.id_proveedor === idProveedor && c.pendiente > 0);
    return espera({
      proveedor: {
        id: prov.id,
        nombre: prov.nombre,
        rtn: prov.rtn,
        telefono: prov.telefono,
        dias_credito: prov.dias_credito,
        pendiente: centavos(lista.reduce((s, c) => s + c.pendiente, 0)),
        vencido: centavos(lista.filter((c) => c.estado === "vencida").reduce((s, c) => s + c.pendiente, 0)),
      },
      compras: lista,
      pagos: pagosProvDemo
        .filter((x) => x.id_proveedor === idProveedor)
        .slice()
        .reverse()
        .map((x) => ({ id: x.id, numero: x.numero, fecha: x.fecha, monto: x.monto, forma_pago: x.forma_pago, estado: x.estado })),
    });
  },
  pagar: async (n) => {
    const prov = proveedoresVivos().find((x) => x.id === n.id_proveedor);
    if (!prov) return { ok: false as const, error: "El proveedor no existe." };
    const pendientes = cuentasPagarDemo().filter((c) => c.id_proveedor === prov.id && c.pendiente > 0);
    const total = centavos(pendientes.reduce((s, c) => s + c.pendiente, 0));
    if (n.monto > total) return { ok: false as const, error: `El pago supera lo que se le debe al proveedor (L ${total.toFixed(2)}).` };
    const turno = n.de_caja && n.forma_pago === "efectivo" ? turnoAbiertoDemo() : null;
    if (n.de_caja && n.forma_pago === "efectivo" && !turno) {
      return { ok: false as const, error: "No hay caja abierta en tu punto: abrila o desmarcá «Sale de la caja»." };
    }
    const pago: PagoProvDemo = {
      id: crypto.randomUUID(),
      numero: `PAG-${String(correlativoPagoProv++).padStart(6, "0")}`,
      fecha: new Date().toISOString(),
      id_proveedor: prov.id,
      proveedor_nombre: prov.nombre,
      monto: centavos(n.monto),
      forma_pago: n.forma_pago,
      referencia: n.referencia ?? null,
      notas: n.notas ?? null,
      estado: "emitido",
      motivo_anulacion: null,
      id_turno: turno?.id ?? null,
      aplicaciones: n.aplicaciones,
    };
    pagosProvDemo.push(pago);
    return espera({ ok: true as const, id: pago.id, numero: pago.numero }, 350);
  },
  pago: async (id) => {
    const x = pagosProvDemo.find((y) => y.id === id);
    if (!x) return espera(null);
    const { id_turno, aplicaciones, ...resto } = x;
    return espera({
      ...resto,
      de_caja: id_turno !== null,
      pago: "Demo Sandbox",
      aplicaciones: aplicaciones.map((a) => {
        const c = comprasDemo.find((y) => y.id === a.id_compra);
        return { id_compra: a.id_compra, numero: c?.numero ?? "", documento: c?.documento ?? null, total: c?.total ?? 0, monto: a.monto };
      }),
    });
  },
  anularPago: async (id, motivo) => {
    const x = pagosProvDemo.find((y) => y.id === id);
    if (!x || x.estado === "anulado") return { ok: false as const, error: "El pago no se puede anular." };
    if (!motivo.trim()) return { ok: false as const, error: "Escribí el motivo de la anulación." };
    x.estado = "anulado";
    x.motivo_anulacion = motivo.trim();
    return espera({ ok: true as const });
  },
  cajaAbierta: async () => {
    const t = turnoAbiertoDemo();
    return espera(t ? { punto: PUNTO_DEMO.nombre, turno: t.numero } : null);
  },
};

BASES.proveedores = () =>
  proveedoresDemo.map((x) => {
    const propias = comprasDemo.filter((c) => c.id_proveedor === x.id && c.estado === "emitido");
    return {
      id: x.id,
      nombre: x.nombre,
      rtn: x.rtn,
      telefono: x.telefono,
      correo: null,
      direccion: null,
      contacto: x.contacto,
      dias_credito: x.dias_credito,
      notas: null,
      activo: true,
      compras: propias.length,
      ultima_compra: propias.at(-1)?.fecha ?? null,
      saldo: centavos(cuentasPagarDemo().filter((c) => c.id_proveedor === x.id).reduce((s, c) => s + c.pendiente, 0)),
      creado_en: haceDias(60),
    };
  });
BASES.compras = () =>
  comprasDemo.map((c) => ({
    id: c.id,
    numero: c.numero,
    tipo: c.tipo,
    fecha: c.fecha,
    id_proveedor: c.id_proveedor,
    proveedor_nombre: c.proveedor_nombre,
    proveedor_rtn: c.proveedor_rtn,
    documento: c.documento,
    condicion: c.condicion,
    vence: c.vence,
    forma_pago: c.forma_pago,
    subtotal: c.subtotal,
    isv: c.isv,
    total: c.total,
    estado: c.estado,
    pendiente: cuentasPagarDemo().find((x) => x.id === c.id)?.pendiente ?? null,
    lineas: c.lineas.length,
    registro: "Demo Sandbox",
    creado_en: c.creado_en,
  }));
BASES.cuentas_proveedores = () => {
  const cuentas = cuentasPagarDemo().filter((c) => c.pendiente > 0);
  return proveedoresVivos()
    .map((x) => {
      const suyas = cuentas.filter((c) => c.id_proveedor === x.id);
      if (!suyas.length) return null;
      const vencido = centavos(suyas.filter((c) => c.estado === "vencida").reduce((s, c) => s + c.pendiente, 0));
      return {
        id: x.id,
        nombre: x.nombre,
        rtn: x.rtn,
        telefono: x.telefono,
        dias_credito: x.dias_credito,
        pendiente: centavos(suyas.reduce((s, c) => s + c.pendiente, 0)),
        vencido,
        compras: suyas.length,
        dias_mora: Math.max(...suyas.map((c) => c.dias_vencida)),
        proximo_vence: suyas.map((c) => c.vence).sort()[0],
        ultimo_pago: pagosProvDemo.filter((p) => p.id_proveedor === x.id && p.estado === "emitido").at(-1)?.fecha ?? null,
        estado: vencido > 0 ? "vencida" : "al_dia",
        en_mora: vencido > 0,
      };
    })
    .filter(Boolean) as Fila[];
};
BASES.pagos_proveedores = () =>
  pagosProvDemo.map((x) => ({
    id: x.id,
    numero: x.numero,
    fecha: x.fecha,
    id_proveedor: x.id_proveedor,
    proveedor_nombre: x.proveedor_nombre,
    monto: x.monto,
    forma_pago: x.forma_pago,
    referencia: x.referencia,
    estado: x.estado,
    de_caja: x.id_turno !== null,
    compras: x.aplicaciones.map((a) => comprasDemo.find((c) => c.id === a.id_compra)?.numero).join(", "),
    pago: "Demo Sandbox",
  }));

// ------------------------------------------------------ contabilidad (demo) --
// Los asientos se calculan cada vez a partir de lo que pasó en la demo (las
// mismas reglas que los triggers de 0022) más los manuales del visitante.

const CATALOGO_DEMO: [string, string, TipoCuenta, Naturaleza, string | null, string | null][] = [
  ["1", "ACTIVO", "activo", "deudora", null, null],
  ["11", "Activo corriente", "activo", "deudora", "1", null],
  ["1101", "Efectivo y equivalentes", "activo", "deudora", "11", null],
  ["110101", "Caja general", "activo", "deudora", "1101", "caja"],
  ["110102", "Caja chica", "activo", "deudora", "1101", null],
  ["110103", "Bancos", "activo", "deudora", "1101", "bancos"],
  ["1102", "Cuentas por cobrar", "activo", "deudora", "11", null],
  ["110201", "Clientes", "activo", "deudora", "1102", "clientes"],
  ["1103", "Inventarios", "activo", "deudora", "11", null],
  ["110301", "Inventario de mercadería", "activo", "deudora", "1103", "inventario"],
  ["1104", "Impuestos por recuperar", "activo", "deudora", "11", null],
  ["110401", "ISV crédito fiscal (compras)", "activo", "deudora", "1104", "isv_credito"],
  ["12", "Activo no corriente", "activo", "deudora", "1", null],
  ["1201", "Propiedad, planta y equipo", "activo", "deudora", "12", null],
  ["120101", "Mobiliario y equipo", "activo", "deudora", "1201", null],
  ["120104", "Depreciación acumulada", "activo", "acreedora", "1201", null],
  ["2", "PASIVO", "pasivo", "acreedora", null, null],
  ["21", "Pasivo corriente", "pasivo", "acreedora", "2", null],
  ["2101", "Proveedores", "pasivo", "acreedora", "21", "proveedores"],
  ["2102", "Impuestos por pagar", "pasivo", "acreedora", "21", null],
  ["210201", "ISV por pagar (ventas)", "pasivo", "acreedora", "2102", "isv_debito"],
  ["2103", "Sueldos y prestaciones por pagar", "pasivo", "acreedora", "21", null],
  ["3", "PATRIMONIO", "patrimonio", "acreedora", null, null],
  ["3101", "Capital", "patrimonio", "acreedora", "3", "capital"],
  ["3102", "Utilidades acumuladas", "patrimonio", "acreedora", "3", null],
  ["4", "INGRESOS", "ingreso", "acreedora", null, null],
  ["4101", "Ventas de mercadería", "ingreso", "acreedora", "4", "ventas"],
  ["4102", "Devoluciones y rebajas sobre ventas", "ingreso", "deudora", "4", "devoluciones_ventas"],
  ["4201", "Otros ingresos", "ingreso", "acreedora", "4", "otros_ingresos"],
  ["4202", "Sobrantes de caja", "ingreso", "acreedora", "4", "sobrantes_caja"],
  ["5", "COSTOS", "costo", "deudora", null, null],
  ["5101", "Costo de ventas", "costo", "deudora", "5", "costo_ventas"],
  ["6", "GASTOS", "gasto", "deudora", null, null],
  ["6101", "Sueldos y salarios", "gasto", "deudora", "6", null],
  ["6102", "Alquiler", "gasto", "deudora", "6", null],
  ["6103", "Energía eléctrica, agua y teléfono", "gasto", "deudora", "6", null],
  ["6105", "Gastos generales", "gasto", "deudora", "6", "gastos_generales"],
  ["6106", "Faltantes de caja", "gasto", "deudora", "6", "faltantes_caja"],
  ["6107", "Depreciación", "gasto", "deudora", "6", null],
];

type CuentaDemo = { id: number; codigo: string; nombre: string; tipo: TipoCuenta; naturaleza: Naturaleza; id_padre: number | null; clave: string | null; activo: boolean };

/** El catálogo de la demo: el de fábrica más lo que el visitante crea o cambia en la tabla. */
function catalogoDemo(): CuentaDemo[] {
  const filas = filasDemo("cuentas_contables") ?? [];
  return filas.map((f) => ({
    id: Number(f.id),
    codigo: String(f.codigo),
    nombre: String(f.nombre),
    tipo: f.tipo as TipoCuenta,
    naturaleza: ((f.naturaleza as string) || (["activo", "costo", "gasto"].includes(String(f.tipo)) ? "deudora" : "acreedora")) as Naturaleza,
    id_padre: f.id_padre === null || f.id_padre === undefined || f.id_padre === "" ? null : Number(f.id_padre),
    clave: (f.clave as string) || null,
    activo: f.activo !== false,
  }));
}

const idCuentaDemo = (clave: string) => catalogoDemo().find((c) => c.clave === clave)?.id ?? 0;

type LineaCruda = { cuenta: string | number; debe?: number; haber?: number; descripcion?: string };
type AsientoCrudo = { clave: string; fecha: string; concepto: string; origen: OrigenAsiento; referencia: string | null; lineas: LineaCruda[]; orden: string };
type ManualDemo = AsientoCrudo & { revertidoPor?: string; revierte?: string };

const manualesDemo: ManualDemo[] = [];
const cerradosDemo = new Set<string>();
const formaCuenta = (f: string | null | undefined) => (!f || f === "efectivo" ? "caja" : "bancos");
const diaHn = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Tegucigalpa" });

/** Todos los asientos de la demo, numerados por fecha. */
function asientosDemo(): Asiento[] {
  const crudos: (AsientoCrudo & { reversaDe?: string })[] = [];
  const conReversa = (a: AsientoCrudo, anulado: boolean) => {
    crudos.push(a);
    if (anulado) {
      crudos.push({
        ...a,
        clave: `${a.clave}:rev`,
        concepto: `Anulación · ${a.concepto}`,
        orden: `${a.orden}~`,
        lineas: a.lineas.map((l) => ({ ...l, debe: l.haber, haber: l.debe })),
        reversaDe: a.clave,
      });
    }
  };
  for (const d of documentos) {
    if (d.tipo === "cotizacion") continue;
    const neto = centavos(d.total - d.isv);
    const costo = centavos(
      d.lineas.reduce((s, l) => {
        const p = PRODUCTOS.find((x) => x.codigo === l.codigo);
        return s + (p?.controla_inventario ? l.cantidad * Number(p.costo ?? 0) : 0);
      }, 0),
    );
    const f = d.id_factura ? documentos.find((x) => x.id === d.id_factura) : undefined;
    const cobro =
      d.tipo === "factura"
        ? d.condicion === "credito" ? "clientes" : formaCuenta(d.forma_pago)
        : f ? (f.condicion === "credito" ? "clientes" : formaCuenta(f.forma_pago)) : d.forma_pago ? formaCuenta(d.forma_pago) : "clientes";
    const lineas: LineaCruda[] =
      d.tipo === "factura"
        ? [
            { cuenta: cobro, debe: d.total },
            { cuenta: "ventas", haber: neto },
            { cuenta: "isv_debito", haber: d.isv },
            { cuenta: "costo_ventas", debe: costo, descripcion: "Costo de lo vendido" },
            { cuenta: "inventario", haber: costo, descripcion: "Salida de inventario" },
          ]
        : d.tipo === "nota_credito"
          ? [
              { cuenta: "devoluciones_ventas", debe: neto },
              { cuenta: "isv_debito", debe: d.isv },
              { cuenta: cobro, haber: d.total },
              { cuenta: "inventario", debe: d.reintegra_inventario ? costo : 0 },
              { cuenta: "costo_ventas", haber: d.reintegra_inventario ? costo : 0 },
            ]
          : [
              { cuenta: cobro, debe: d.total },
              { cuenta: "otros_ingresos", haber: neto },
              { cuenta: "isv_debito", haber: d.isv },
            ];
    const nombre = d.tipo === "factura" ? "Venta" : d.tipo === "nota_credito" ? "Nota de crédito" : "Nota de débito";
    conReversa(
      { clave: `doc:${d.id}`, fecha: diaHn(d.fecha), concepto: `${nombre} ${d.numero} · ${d.cliente_nombre}`, origen: d.tipo, referencia: d.numero, lineas, orden: d.fecha },
      d.estado === "anulado",
    );
  }
  for (const p of pagosDemo) {
    conReversa(
      {
        clave: `abono:${p.id}`,
        fecha: diaHn(p.fecha),
        concepto: `Abono ${p.numero} · ${p.cliente_nombre}`,
        origen: "abono",
        referencia: p.numero,
        lineas: [{ cuenta: formaCuenta(p.forma_pago), debe: p.monto }, { cuenta: "clientes", haber: p.monto }],
        orden: p.fecha,
      },
      p.estado === "anulado",
    );
  }
  for (const c of comprasDemo) {
    conReversa(
      {
        clave: `compra:${c.id}`,
        fecha: c.fecha,
        concepto: `Compra ${c.numero}${c.documento ? ` (${c.documento})` : ""} · ${c.proveedor_nombre}`,
        origen: "compra",
        referencia: c.documento ?? c.numero,
        lineas: [
          { cuenta: c.tipo === "inventario" ? "inventario" : "gastos_generales", debe: c.subtotal },
          { cuenta: "isv_credito", debe: c.isv },
          { cuenta: c.condicion === "credito" ? "proveedores" : formaCuenta(c.forma_pago), haber: c.total },
        ],
        orden: c.creado_en,
      },
      c.estado === "anulado",
    );
  }
  for (const x of pagosProvDemo) {
    conReversa(
      {
        clave: `pagoprov:${x.id}`,
        fecha: diaHn(x.fecha),
        concepto: `Pago ${x.numero} · ${x.proveedor_nombre}`,
        origen: "pago_proveedor",
        referencia: x.numero,
        lineas: [{ cuenta: "proveedores", debe: x.monto }, { cuenta: formaCuenta(x.forma_pago), haber: x.monto }],
        orden: x.fecha,
      },
      x.estado === "anulado",
    );
  }
  for (const t of turnosDemo) {
    for (const m of t.manuales) {
      crudos.push({
        clave: `caja:${t.id}:${m.id}`,
        fecha: diaHn(m.fecha),
        concepto: `${m.tipo === "entrada" ? "Entrada" : "Salida"} de caja · ${m.concepto}`,
        origen: m.tipo === "entrada" ? "caja_entrada" : "caja_salida",
        referencia: null,
        lineas: m.tipo === "entrada" ? [{ cuenta: "caja", debe: m.monto }, { cuenta: "bancos", haber: m.monto }] : [{ cuenta: "gastos_generales", debe: m.monto }, { cuenta: "caja", haber: m.monto }],
        orden: m.fecha,
      });
    }
    if (t.estado === "cerrada" && t.contado !== null && t.cerrada_en) {
      const dif = centavos(t.contado - turnoCompletoDemo({ ...t, estado: "abierta" }).resumen.esperado_efectivo);
      if (dif !== 0) {
        crudos.push({
          clave: `cierre:${t.id}`,
          fecha: diaHn(t.cerrada_en),
          concepto: `${dif < 0 ? "Faltante" : "Sobrante"} en el cierre del turno ${t.numero}`,
          origen: "cierre_caja",
          referencia: `Turno ${t.numero}`,
          lineas: dif < 0 ? [{ cuenta: "faltantes_caja", debe: -dif }, { cuenta: "caja", haber: -dif }] : [{ cuenta: "caja", debe: dif }, { cuenta: "sobrantes_caja", haber: dif }],
          orden: t.cerrada_en,
        });
      }
    }
  }
  crudos.push(...manualesDemo);

  const cuentas = catalogoDemo();
  const porId = new Map(cuentas.map((c) => [c.id, c]));
  const ordenados = crudos
    .map((a) => ({ ...a, lineas: a.lineas.filter((l) => (l.debe ?? 0) > 0 || (l.haber ?? 0) > 0) }))
    .filter((a) => a.lineas.length >= 2)
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.orden.localeCompare(b.orden));
  const numeros = new Map(ordenados.map((a, i) => [a.clave, i + 1]));
  const revertidos = new Set([
    ...ordenados.filter((a) => a.reversaDe).map((a) => a.reversaDe!),
    ...manualesDemo.filter((m) => m.revertidoPor).map((m) => m.clave),
  ]);
  return ordenados.map((a) => ({
    id: a.clave,
    numero: numeros.get(a.clave)!,
    fecha: a.fecha,
    concepto: a.concepto,
    origen: a.origen,
    referencia: a.referencia,
    es_reversa: Boolean(a.reversaDe) || Boolean((a as ManualDemo).revierte),
    revertido: revertidos.has(a.clave),
    registro: "Demo Sandbox",
    lineas: a.lineas.map((l, i) => {
      const id = typeof l.cuenta === "number" ? l.cuenta : idCuentaDemo(l.cuenta);
      const c = porId.get(id);
      return { id: i + 1, id_cuenta: id, codigo: c?.codigo ?? "?", cuenta: c?.nombre ?? "?", debe: centavos(l.debe ?? 0), haber: centavos(l.haber ?? 0), descripcion: l.descripcion ?? null };
    }),
  }));
}

function balanzaDemo(desde: string, hasta: string): FilaBalanza[] {
  const asientos = asientosDemo().filter((a) => a.fecha <= hasta);
  return catalogoDemo()
    .sort((a, b) => a.codigo.localeCompare(b.codigo))
    .map((c) => {
      let antes = 0;
      let debe = 0;
      let haber = 0;
      for (const a of asientos) {
        for (const l of a.lineas) {
          if (l.id_cuenta !== c.id) continue;
          if (a.fecha < desde) antes += l.debe - l.haber;
          else {
            debe += l.debe;
            haber += l.haber;
          }
        }
      }
      const s = c.naturaleza === "deudora" ? 1 : -1;
      return {
        id: c.id,
        codigo: c.codigo,
        nombre: c.nombre,
        tipo: c.tipo,
        naturaleza: c.naturaleza,
        id_padre: c.id_padre,
        activo: c.activo,
        saldo_inicial: centavos(antes * s),
        debe: centavos(debe),
        haber: centavos(haber),
        saldo_final: centavos((antes + debe - haber) * s),
      };
    });
}

const contabilidad: Apis["contabilidad"] = {
  diario: async (fecha) => {
    const asientos = asientosDemo().filter((a) => a.fecha === fecha);
    const lineas = asientos.flatMap((a) => a.lineas);
    return espera({
      fecha,
      asientos,
      debe: centavos(lineas.reduce((s, l) => s + l.debe, 0)),
      haber: centavos(lineas.reduce((s, l) => s + l.haber, 0)),
      cerrado: cerradosDemo.has(fecha.slice(0, 7)),
    });
  },
  asiento: async (id) => espera(asientosDemo().find((a) => a.id === id) ?? null),
  cuentas: async () => {
    const cs = catalogoDemo();
    const padres = new Set(cs.map((c) => c.id_padre));
    return espera(cs.filter((c) => c.activo && !padres.has(c.id)).sort((a, b) => a.codigo.localeCompare(b.codigo)).map(({ id, codigo, nombre, tipo }) => ({ id, codigo, nombre, tipo }) as CuentaBreve));
  },
  crearAsiento: async (a) => {
    if (cerradosDemo.has(a.fecha.slice(0, 7))) return { ok: false as const, error: `El mes de ${a.fecha.slice(5, 7)}/${a.fecha.slice(0, 4)} está cerrado.` };
    const debe = centavos(a.lineas.reduce((s, l) => s + l.debe, 0));
    const haber = centavos(a.lineas.reduce((s, l) => s + l.haber, 0));
    if (debe !== haber || debe <= 0) return { ok: false as const, error: `No cuadra: debe L ${debe.toFixed(2)} y haber L ${haber.toFixed(2)}.` };
    const clave = `manual:${crypto.randomUUID()}`;
    manualesDemo.push({
      clave,
      fecha: a.fecha,
      concepto: a.concepto.trim(),
      origen: "manual",
      referencia: null,
      orden: new Date().toISOString(),
      lineas: a.lineas.map((l) => ({ cuenta: l.id_cuenta, debe: l.debe, haber: l.haber, descripcion: l.descripcion ?? undefined })),
    });
    const numero = asientosDemo().find((x) => x.id === clave)?.numero ?? 0;
    return espera({ ok: true as const, id: clave, numero }, 300);
  },
  revertir: async (id, motivo) => {
    const m = manualesDemo.find((x) => x.clave === id);
    if (!m) return { ok: false as const, error: "Este asiento lo generó un documento: anulá el documento y su reversa sale sola." };
    if (m.revertidoPor || m.revierte) return { ok: false as const, error: "Este asiento ya fue revertido." };
    const clave = `manual:${crypto.randomUUID()}`;
    m.revertidoPor = clave;
    manualesDemo.push({
      ...m,
      clave,
      revierte: m.clave,
      revertidoPor: undefined,
      fecha: hoyIso(),
      concepto: `Reversa: ${motivo.trim()}`,
      orden: new Date().toISOString(),
      lineas: m.lineas.map((l) => ({ ...l, debe: l.haber, haber: l.debe })),
    });
    return espera({ ok: true as const });
  },
  balanza: async (desde, hasta) => espera(balanzaDemo(desde, hasta), 200),
  mayor: async (idCuenta, desde, hasta) => {
    const c = catalogoDemo().find((x) => x.id === idCuenta);
    if (!c) return espera(null);
    const s = c.naturaleza === "deudora" ? 1 : -1;
    const asientos = asientosDemo();
    let saldo = centavos(
      asientos.filter((a) => a.fecha < desde).flatMap((a) => a.lineas).filter((l) => l.id_cuenta === idCuenta).reduce((t, l) => t + (l.debe - l.haber) * s, 0),
    );
    const inicial = saldo;
    const movimientos = asientos
      .filter((a) => a.fecha >= desde && a.fecha <= hasta)
      .flatMap((a) =>
        a.lineas
          .filter((l) => l.id_cuenta === idCuenta)
          .map((l) => {
            saldo = centavos(saldo + (l.debe - l.haber) * s);
            return { id_asiento: a.id, numero: a.numero, fecha: a.fecha, concepto: a.concepto, referencia: a.referencia, descripcion: l.descripcion, debe: l.debe, haber: l.haber, saldo };
          }),
      );
    return espera({ saldo_inicial: inicial, movimientos });
  },
  periodos: async () => {
    const asientos = asientosDemo();
    const hoy = hoyIso();
    return espera(
      Array.from({ length: 13 }, (_, i) => {
        const d = new Date(`${hoy.slice(0, 7)}-15T12:00:00Z`);
        d.setUTCMonth(d.getUTCMonth() - i);
        const mes = d.toISOString().slice(0, 7);
        const del = asientos.filter((a) => a.fecha.startsWith(mes));
        return { mes, asientos: del.length, debe: centavos(del.flatMap((a) => a.lineas).reduce((s, l) => s + l.debe, 0)), cerrado: cerradosDemo.has(mes) };
      }),
    );
  },
  cerrarPeriodo: async (mes) => {
    if (mes >= hoyIso().slice(0, 7)) return { ok: false as const, error: "Solo se cierran meses que ya terminaron." };
    cerradosDemo.add(mes);
    return espera({ ok: true as const });
  },
  reabrirPeriodo: async (mes) => {
    cerradosDemo.delete(mes);
    return espera({ ok: true as const });
  },
  contabilizarPendientes: async () => espera({ ok: true as const, asientos: 0 }),
  aperturaInventario: async (fecha) => {
    if (manualesDemo.some((m) => m.origen === "apertura_inventario" && !m.revertidoPor)) {
      return { ok: false as const, error: "La apertura del inventario ya está registrada (revertila para hacerla de nuevo)." };
    }
    const valor = centavos(PRODUCTOS.filter((x) => x.controla_inventario).reduce((s, x) => s + Math.max(Number(x.existencia ?? 0), 0) * Number(x.costo ?? 0), 0));
    const clave = `manual:${crypto.randomUUID()}`;
    manualesDemo.push({
      clave,
      fecha,
      concepto: "Apertura: inventario inicial a costo",
      origen: "apertura_inventario",
      referencia: null,
      orden: "0",
      lineas: [{ cuenta: "inventario", debe: valor }, { cuenta: "capital", haber: valor }],
    });
    return espera({ ok: true as const, id: clave });
  },
};

BASES.cuentas_contables = () => {
  const porCodigo = new Map<string, number>();
  CATALOGO_DEMO.forEach(([codigo], i) => porCodigo.set(codigo, i + 1));
  return CATALOGO_DEMO.map(([codigo, nombre, tipo, naturaleza, padre, clave], i) => ({
    id: i + 1,
    codigo,
    nombre,
    tipo,
    naturaleza,
    id_padre: padre ? porCodigo.get(padre)! : null,
    padre: padre ? `${padre} · ${CATALOGO_DEMO.find((c) => c[0] === padre)![1]}` : null,
    clave,
    activo: true,
    es_grupo: CATALOGO_DEMO.some((c) => c[4] === codigo),
    nivel: codigo.length,
    etiqueta: `${codigo} · ${nombre}`,
    saldo: null,
    creado_en: haceDias(120),
  }));
};
BASES.asientos = () =>
  asientosDemo().map((a) => ({
    id: a.id,
    numero: a.numero,
    fecha: a.fecha,
    concepto: a.concepto,
    origen: a.origen,
    referencia: a.referencia,
    total: centavos(a.lineas.reduce((s, l) => s + l.debe, 0)),
    lineas: a.lineas.length,
    es_reversa: a.es_reversa,
    revertido: a.revertido,
    registro: a.registro,
  }));

export const APIS_DEMO: Partial<Apis> = {
  recursos,
  empresa,
  perfil,
  ventas,
  cobros,
  compras,
  contabilidad,
  caja,
  exportacion,
  compatibilidad,
  imagenes,
  inventario,
  reportes,
  identidad,
  sitioWeb,
  notificaciones,
};
