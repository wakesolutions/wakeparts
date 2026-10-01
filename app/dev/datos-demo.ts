"use client";

import { ubicarVehiculo } from "@/app/acciones/vehiculos";
import type { Apis } from "@/components/datos/apis";
import type { ImagenProducto } from "@/components/imagenes/api";
import { centavos } from "@/lib/formato";
import type { ResultadoImportacion } from "@/lib/inventario";
import { diasEntre, sumarDias } from "@/lib/reportes/periodos";
import type { DatosReporte } from "@/lib/reportes/tipos";
import type { FilaCompat, NivelVehiculo } from "@/lib/vehiculos";
import {
  calcularTotales,
  type Carrito,
  type Cliente,
  type Documento,
  type LineaCarrito,
  type ResultadoBusqueda,
} from "@/lib/ventas";

/**
 * Datos de demostración en memoria para el sandbox /dev (sin sesión ni base).
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
const clientes: Cliente[] = [
  { id: 1, nombre: "TRANSPORTES LÓPEZ S. DE R.L.", rtn: "08019010123456", telefono: "2233-4455" },
  { id: 2, nombre: "JUAN PÉREZ", rtn: null, telefono: "9988-7766" },
];
const documentos: Documento[] = [];
let correlativoCot = 1;
let correlativoFac = 1;
let siguienteLinea = 1;

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
      if (cli) Object.assign(c, { cliente_nombre: cli.nombre, cliente_rtn: cli.rtn, cliente_telefono: cli.telefono });
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
    const t = calcularTotales(ls, c.descuento_pct);
    const numero = tipo === "factura" ? `000-001-01-${String(correlativoFac++).padStart(8, "0")}` : `COT-${String(correlativoCot++).padStart(6, "0")}`;
    const doc: Documento = {
      id: crypto.randomUUID(),
      tipo,
      numero,
      fecha: new Date().toISOString(),
      vence: tipo === "cotizacion" ? new Date(Date.now() + 15 * 864e5).toISOString().slice(0, 10) : null,
      cai: tipo === "factura" ? "35BD6A-0195F4-B34BAA-8B7D13-37F5E8-2D" : null,
      cai_rango: tipo === "factura" ? "000-001-01-00000001 al 000-001-01-00000500" : null,
      cai_fecha_limite: tipo === "factura" ? "2027-03-31" : null,
      emisor: {
        nombre: "Yonker Demo",
        razon_social: "Repuestos Demo S. de R.L.",
        rtn: "08011990123456",
        telefono: "2222-0000",
        correo: "ventas@demo.hn",
        direccion: "Tegucigalpa, Francisco Morazán",
      },
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
        id: i + 1,
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
  documento: async (id) => espera(documentos.find((d) => d.id === id) ?? null),
  carritoDesdeDocumento: async (id) => {
    const d = documentos.find((x) => x.id === id);
    if (!d) return { ok: false as const, error: "No existe." };
    const c = { ...nuevoCarrito(), nombre: d.numero, cliente_nombre: d.cliente_nombre, cliente_rtn: d.cliente_rtn };
    carritos.push(c);
    lineas.set(
      c.id,
      d.lineas.map((l) => ({ ...l, id: siguienteLinea++, id_carrito: c.id, id_producto: null, orden: 0, costo: null, existencia: null, controla_inventario: null, unidad: null, oem: null, imagen: null })),
    );
    return espera({ ok: true as const, id: c.id });
  },
  anular: async (id) => {
    const d = documentos.find((x) => x.id === id);
    if (d) d.estado = "anulado";
    return espera({ ok: true as const });
  },
  urlImpresion: (id) => `/dev/documento?id=${id}`,
};

/** La página /dev/documento lee el documento de sessionStorage (otra pestaña). */
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

export const APIS_DEMO: Partial<Apis> = { ventas, compatibilidad, imagenes, inventario, reportes, identidad };
