"use server";

import type { PostgrestError } from "@supabase/supabase-js";
import { obtenerSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import type {
  CambiosCarrito,
  CambiosLinea,
  Carrito,
  Cliente,
  ConsultaMostrador,
  Documento,
  FacturaParaNota,
  LineaAcreditable,
  LineaCarrito,
  NotaRelacionada,
  NuevaLinea,
  NuevaNota,
  NuevaNotaLibre,
  PuntoEmision,
  Resultado,
  ResultadoBusqueda,
  TipoDocumento,
} from "@/lib/ventas";
import { motivosNota, MOTIVOS_NOTA } from "@/lib/ventas";
import { FORMAS_PAGO } from "@/lib/cobros";

// Mostrador: búsqueda, carritos y emisión. La autorización real es RLS y las
// funciones de la base (emitir_documento, anular_documento); aquí se valida
// forma y se traducen errores.

const COLUMNAS_CARRITO =
  "id, nombre, id_cliente, cliente_nombre, cliente_rtn, cliente_telefono, id_marca, id_modelo, id_modelo_anio, id_especificacion, vehiculo, descuento_pct, notas, estado, lineas, creado_por_nombre, creado_en, actualizado_en, exonerado, exo_orden_compra, exo_constancia, exo_registro_sag, condicion, forma_pago, referencia_pago";
const COLUMNAS_LINEA =
  "id, id_carrito, id_producto, codigo, descripcion, cantidad, precio, descuento_pct, exento, orden, costo, existencia, controla_inventario, unidad, oem, imagen";

const esUuid = (v: unknown): v is string =>
  typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const esId = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v > 0;
const idOpcional = (v: unknown) => (v === null || v === undefined ? null : esId(v) ? v : undefined);

function mensaje(error: PostgrestError, porDefecto: string) {
  if (error.code === "P0001") return error.message;
  if (error.code === "42501") return "No tenés permiso para esta acción.";
  if (error.code === "23514") return "Algún valor está fuera del rango permitido.";
  console.error("[ventas]", error);
  return porDefecto;
}

const numeros = <T extends Record<string, unknown>>(fila: T, campos: (keyof T)[]) => {
  const copia = { ...fila };
  for (const c of campos) if (copia[c] !== null && copia[c] !== undefined) copia[c] = Number(copia[c]) as T[keyof T];
  return copia;
};

// ------------------------------------------------------------- búsqueda ----

export async function buscarMostrador(consulta: ConsultaMostrador): Promise<ResultadoBusqueda[]> {
  const sesion = await obtenerSesion();
  if (!sesion?.empresa) return [];
  const v = consulta.vehiculo ?? {};
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("buscar_productos", {
    p_empresa: sesion.empresa.id,
    p_texto: String(consulta.texto ?? "").slice(0, 120),
    p_id_marca: idOpcional(v.id_marca) ?? null,
    p_id_modelo: idOpcional(v.id_modelo) ?? null,
    p_id_modelo_anio: idOpcional(v.id_modelo_anio) ?? null,
    p_id_especificacion: idOpcional(v.id_especificacion) ?? null,
    p_id_categoria: idOpcional(consulta.id_categoria) ?? null,
    p_limite: Math.min(Math.max(Number(consulta.limite) || 60, 1), 200),
  });
  if (error) {
    console.error("[buscarMostrador]", error);
    return [];
  }
  return ((data ?? []) as ResultadoBusqueda[])
    .map((r) => numeros(r, ["precio", "costo", "existencia", "relevancia"]))
    .sort((a, b) => a.orden - b.orden);
}

// ------------------------------------------------------------- carritos ----

export async function listarCarritos(): Promise<Carrito[]> {
  const sesion = await obtenerSesion();
  if (!sesion?.empresa) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_carritos")
    .select(COLUMNAS_CARRITO)
    .eq("id_empresa", sesion.empresa.id)
    .eq("estado", "abierto")
    .order("creado_en");
  return ((data ?? []) as unknown as Carrito[]).map((c) => numeros(c, ["descuento_pct"]));
}

async function leerCarrito(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("v_carritos").select(COLUMNAS_CARRITO).eq("id", id).maybeSingle();
  return data ? numeros(data as unknown as Carrito, ["descuento_pct"]) : null;
}

export async function crearCarrito(): Promise<Resultado<{ carrito: Carrito }>> {
  const sesion = await obtenerSesion();
  if (!sesion?.empresa) return { ok: false, error: "No hay una empresa activa." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("carritos").insert({ id_empresa: sesion.empresa.id }).select("id").single();
  if (error || !data) return { ok: false, error: error ? mensaje(error, "No se pudo crear el carrito.") : "No se pudo crear el carrito." };
  const carrito = await leerCarrito(data.id);
  return carrito ? { ok: true, carrito } : { ok: false, error: "No se pudo leer el carrito." };
}

const CAMPOS_CARRITO = new Set<keyof CambiosCarrito>([
  "nombre",
  "id_cliente",
  "cliente_nombre",
  "cliente_rtn",
  "cliente_telefono",
  "id_marca",
  "id_modelo",
  "id_modelo_anio",
  "id_especificacion",
  "descuento_pct",
  "notas",
  "exonerado",
  "exo_orden_compra",
  "exo_constancia",
  "exo_registro_sag",
  "condicion",
  "forma_pago",
  "referencia_pago",
]);

export async function actualizarCarrito(id: string, cambios: CambiosCarrito): Promise<Resultado<{ carrito: Carrito }>> {
  if (!esUuid(id)) return { ok: false, error: "Carrito no válido." };
  const datos: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(cambios ?? {})) {
    if (!CAMPOS_CARRITO.has(k as keyof CambiosCarrito)) continue;
    if (k.startsWith("id_") && idOpcional(v) === undefined) return { ok: false, error: "Dato no válido." };
    if (k === "descuento_pct") {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0 || n > 100) return { ok: false, error: "El descuento va de 0 a 100 %." };
      datos[k] = Math.round(n * 1000) / 1000;
    } else if (k === "forma_pago") {
      if (!FORMAS_PAGO.some((f) => f.valor === v)) return { ok: false, error: "Forma de pago no válida." };
      datos[k] = v;
    } else if (k === "referencia_pago") {
      datos[k] = v ? String(v).trim().slice(0, 80) || null : null;
    } else if (k === "condicion") {
      if (v !== "contado" && v !== "credito") return { ok: false, error: "Condición no válida." };
      datos[k] = v;
    } else if (k === "exonerado") {
      datos[k] = Boolean(v);
    } else if (k.startsWith("exo_")) {
      datos[k] = v ? String(v).trim().slice(0, 60) || null : null;
    } else if (k === "cliente_rtn" && v) {
      const rtn = String(v).replace(/\D/g, "");
      if (rtn.length !== 14) return { ok: false, error: "El RTN son 14 dígitos." };
      datos[k] = rtn;
    } else {
      datos[k] = typeof v === "string" ? v.slice(0, 200) : v;
    }
  }
  const supabase = await createClient();
  const { error } = await supabase.from("carritos").update(datos).eq("id", id);
  if (error) return { ok: false, error: mensaje(error, "No se pudo guardar el carrito.") };
  const carrito = await leerCarrito(id);
  return carrito ? { ok: true, carrito } : { ok: false, error: "No se pudo leer el carrito." };
}

export async function descartarCarrito(id: string): Promise<Resultado> {
  if (!esUuid(id)) return { ok: false, error: "Carrito no válido." };
  const supabase = await createClient();
  const { error } = await supabase.from("carritos").delete().eq("id", id).eq("estado", "abierto");
  return error ? { ok: false, error: mensaje(error, "No se pudo descartar.") } : { ok: true };
}

// --------------------------------------------------------------- líneas ----

export async function listarLineas(idCarrito: string): Promise<LineaCarrito[]> {
  if (!esUuid(idCarrito)) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_carritos_lineas")
    .select(COLUMNAS_LINEA)
    .eq("id_carrito", idCarrito)
    .order("orden")
    .order("id");
  return ((data ?? []) as unknown as LineaCarrito[]).map((l) =>
    numeros(l, ["cantidad", "precio", "descuento_pct", "costo", "existencia"]),
  );
}

export async function agregarLinea(idCarrito: string, linea: NuevaLinea): Promise<Resultado<{ linea: LineaCarrito }>> {
  if (!esUuid(idCarrito)) return { ok: false, error: "Carrito no válido." };
  const cantidad = Number(linea.cantidad);
  const precio = Number(linea.precio);
  const descripcion = String(linea.descripcion ?? "").trim().slice(0, 240);
  if (!descripcion || !(cantidad > 0) || !(precio >= 0)) return { ok: false, error: "Revisá la descripción, la cantidad y el precio." };
  if (idOpcional(linea.id_producto) === undefined) return { ok: false, error: "Producto no válido." };

  const supabase = await createClient();
  const { data: ultima } = await supabase
    .from("carritos_lineas")
    .select("orden")
    .eq("id_carrito", idCarrito)
    .order("orden", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await supabase
    .from("carritos_lineas")
    .insert({
      id_carrito: idCarrito,
      id_producto: linea.id_producto ?? null,
      codigo: linea.codigo ?? null,
      descripcion,
      cantidad,
      precio,
      exento: Boolean(linea.exento),
      orden: (ultima?.orden ?? 0) + 1,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error ? mensaje(error, "No se pudo agregar.") : "No se pudo agregar." };
  const { data: fila } = await supabase.from("v_carritos_lineas").select(COLUMNAS_LINEA).eq("id", data.id).single();
  return {
    ok: true,
    linea: numeros(fila as unknown as LineaCarrito, ["cantidad", "precio", "descuento_pct", "costo", "existencia"]),
  };
}

export async function actualizarLinea(id: number, cambios: CambiosLinea): Promise<Resultado> {
  if (!esId(id)) return { ok: false, error: "Línea no válida." };
  const datos: Record<string, unknown> = {};
  if (cambios.cantidad !== undefined) {
    const n = Number(cambios.cantidad);
    if (!(n > 0) || n > 99999) return { ok: false, error: "La cantidad debe ser mayor que cero." };
    datos.cantidad = Math.round(n * 100) / 100;
  }
  if (cambios.precio !== undefined) {
    const n = Number(cambios.precio);
    if (!(n >= 0)) return { ok: false, error: "Precio no válido." };
    datos.precio = Math.round(n * 100) / 100;
  }
  if (cambios.descuento_pct !== undefined) {
    const n = Number(cambios.descuento_pct);
    if (!(n >= 0 && n <= 100)) return { ok: false, error: "El descuento va de 0 a 100 %." };
    datos.descuento_pct = Math.round(n * 1000) / 1000;
  }
  if (cambios.descripcion !== undefined) {
    const d = String(cambios.descripcion).trim().slice(0, 240);
    if (!d) return { ok: false, error: "Escribí una descripción." };
    datos.descripcion = d;
  }
  const supabase = await createClient();
  const { error } = await supabase.from("carritos_lineas").update(datos).eq("id", id);
  return error ? { ok: false, error: mensaje(error, "No se pudo actualizar.") } : { ok: true };
}

export async function quitarLinea(id: number): Promise<Resultado> {
  if (!esId(id)) return { ok: false, error: "Línea no válida." };
  const supabase = await createClient();
  const { error } = await supabase.from("carritos_lineas").delete().eq("id", id);
  return error ? { ok: false, error: mensaje(error, "No se pudo quitar.") } : { ok: true };
}

// --------------------------------------------------------------- clientes --

export async function buscarClientes(texto: string): Promise<Cliente[]> {
  const sesion = await obtenerSesion();
  if (!sesion?.empresa) return [];
  const termino = String(texto ?? "").replace(/["\\*%_(),]/g, " ").trim().slice(0, 60);
  const supabase = await createClient();
  let q = supabase
    .from("clientes")
    .select("id, nombre, rtn, telefono")
    .eq("id_empresa", sesion.empresa.id)
    .eq("activo", true)
    .order("nombre")
    .limit(8);
  if (termino) {
    const digitos = termino.replace(/\D/g, "");
    q = q.or(
      [`nombre.ilike."*${termino}*"`, `telefono.ilike."*${termino}*"`, ...(digitos.length >= 4 ? [`rtn.ilike."*${digitos}*"`] : [])].join(","),
    );
  }
  const { data } = await q;
  return (data ?? []) as Cliente[];
}

export async function crearCliente(datos: { nombre: string; rtn?: string | null; telefono?: string | null }): Promise<Resultado<{ cliente: Cliente }>> {
  const sesion = await obtenerSesion();
  if (!sesion?.empresa) return { ok: false, error: "No hay una empresa activa." };
  const nombre = String(datos.nombre ?? "").trim().slice(0, 160);
  const rtn = datos.rtn ? String(datos.rtn).replace(/\D/g, "") : null;
  if (!nombre) return { ok: false, error: "Escribí el nombre del cliente." };
  if (rtn && rtn.length !== 14) return { ok: false, error: "El RTN son 14 dígitos." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clientes")
    .insert({ id_empresa: sesion.empresa.id, nombre, rtn, telefono: datos.telefono?.slice(0, 30) || null })
    .select("id, nombre, rtn, telefono")
    .single();
  if (error || !data) {
    if (error?.code === "23505") return { ok: false, error: "Ya hay un cliente con ese RTN." };
    return { ok: false, error: error ? mensaje(error, "No se pudo guardar el cliente.") : "No se pudo guardar el cliente." };
  }
  return { ok: true, cliente: data as Cliente };
}

// ---------------------------------------------------------------- emisión --

export async function emitirDocumento(idCarrito: string, tipo: TipoDocumento): Promise<Resultado<{ id: string; numero: string }>> {
  if (!esUuid(idCarrito) || (tipo !== "cotizacion" && tipo !== "factura")) return { ok: false, error: "Datos no válidos." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("emitir_documento", { p_carrito: idCarrito, p_tipo: tipo });
  if (error || !data) return { ok: false, error: error ? mensaje(error, "No se pudo emitir.") : "No se pudo emitir." };
  const { data: doc } = await supabase.from("documentos").select("numero").eq("id", data).single();
  return { ok: true, id: data as string, numero: doc?.numero ?? "" };
}

export async function leerDocumento(id: string): Promise<Documento | null> {
  if (!esUuid(id)) return null;
  const supabase = await createClient();
  const [{ data: doc }, { data: lineas }, { data: vendedor }, { data: notas }] = await Promise.all([
    supabase
      .from("documentos")
      .select(
        "id, tipo, numero, fecha, vence, cai, cai_rango, cai_fecha_limite, emisor, cliente_nombre, cliente_rtn, cliente_telefono, vehiculo, subtotal, descuento, importe_exento, importe_gravado, importe_exonerado, isv, total, notas, estado, motivo_anulacion, exoneracion, id_factura, factura_numero, factura_fecha, factura_cai, motivo_tipo, motivo, reintegra_inventario, condicion, dias_credito, forma_pago, referencia_pago",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("documentos_lineas")
      .select("id, codigo, descripcion, cantidad, precio, descuento_pct, descuento, exento, total")
      .eq("id_documento", id)
      .order("orden"),
    supabase.from("v_documentos").select("vendedor").eq("id", id).maybeSingle(),
    supabase
      .from("documentos")
      .select("id, tipo, numero, fecha, total, estado, motivo_tipo")
      .eq("id_factura", id)
      .order("fecha"),
  ]);
  if (!doc) return null;
  return {
    ...numeros(doc as unknown as Documento, [
      "subtotal",
      "descuento",
      "importe_exento",
      "importe_gravado",
      "importe_exonerado",
      "isv",
      "total",
    ]),
    vendedor: vendedor?.vendedor ?? null,
    notasRelacionadas: (notas ?? []).map((n) => numeros(n as unknown as NotaRelacionada, ["total"])),
    lineas: (lineas ?? []).map((l) => numeros(l, ["cantidad", "precio", "descuento_pct", "descuento", "total"])) as Documento["lineas"],
  };
}

export async function carritoDesdeDocumento(id: string): Promise<Resultado<{ id: string }>> {
  if (!esUuid(id)) return { ok: false, error: "Documento no válido." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("carrito_desde_documento", { p_documento: id });
  if (error || !data) return { ok: false, error: error ? mensaje(error, "No se pudo abrir el carrito.") : "No se pudo abrir el carrito." };
  return { ok: true, id: data as string };
}

export async function anularDocumento(id: string, motivo: string): Promise<Resultado> {
  if (!esUuid(id)) return { ok: false, error: "Documento no válido." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("anular_documento", { p_documento: id, p_motivo: String(motivo ?? "").slice(0, 300) });
  return error ? { ok: false, error: mensaje(error, "No se pudo anular.") } : { ok: true };
}

// ------------------------------------------------- notas de crédito/débito --

/** Líneas de una factura con lo ya devuelto (para armar una devolución). */
export async function lineasAcreditables(idFactura: string): Promise<LineaAcreditable[]> {
  if (!esUuid(idFactura)) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_lineas_acreditables")
    .select("id, codigo, descripcion, cantidad, precio, descuento_pct, exento, total, controla_inventario, devuelto, acreditado")
    .eq("id_documento", idFactura)
    .order("orden");
  return ((data ?? []) as unknown as LineaAcreditable[]).map((l) =>
    numeros(l, ["cantidad", "precio", "descuento_pct", "total", "devuelto", "acreditado"]),
  );
}

export async function emitirNota(idFactura: string, nota: NuevaNota): Promise<Resultado<{ id: string; numero: string }>> {
  if (!esUuid(idFactura) || (nota?.tipo !== "nota_credito" && nota?.tipo !== "nota_debito")) {
    return { ok: false, error: "Datos no válidos." };
  }
  if (!MOTIVOS_NOTA[nota.tipo].some((m) => m.valor === nota.motivo_tipo)) return { ok: false, error: "Elegí el motivo." };
  const motivo = String(nota.motivo ?? "").trim().slice(0, 300);
  if (!motivo) return { ok: false, error: "Escribí el motivo de la nota." };
  if (!Array.isArray(nota.lineas) || !nota.lineas.length || nota.lineas.length > 100) {
    return { ok: false, error: "La nota no tiene líneas." };
  }
  const lineas = [];
  for (const l of nota.lineas) {
    if ("id_linea" in l) {
      const cantidad = Math.round(Number(l.cantidad) * 100) / 100;
      if (!esId(l.id_linea) || !(cantidad > 0)) return { ok: false, error: "Revisá las cantidades." };
      lineas.push({ id_linea: l.id_linea, cantidad });
    } else {
      const descripcion = String(l.descripcion ?? "").trim().slice(0, 240);
      const monto = Math.round(Number(l.monto) * 100) / 100;
      if (!descripcion || !(monto > 0)) return { ok: false, error: "Revisá la descripción y el monto." };
      lineas.push({ descripcion, monto, exento: Boolean(l.exento) });
    }
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("emitir_nota", {
    p_factura: idFactura,
    p_tipo: nota.tipo,
    p_motivo_tipo: nota.motivo_tipo,
    p_motivo: motivo,
    p_lineas: lineas,
    p_reintegrar: Boolean(nota.reintegrar),
  });
  if (error || !data) return { ok: false, error: error ? mensaje(error, "No se pudo emitir la nota.") : "No se pudo emitir la nota." };
  const { data: doc } = await supabase.from("documentos").select("numero").eq("id", data).single();
  return { ok: true, id: data as string, numero: doc?.numero ?? "" };
}

/**
 * Nota de crédito o débito sin factura relacionada (0019): a nombre de un
 * cliente o de consumidor final, con montos sin ISV y, si mueve dinero, su forma
 * de pago.
 */
export async function emitirNotaLibre(nota: NuevaNotaLibre): Promise<Resultado<{ id: string; numero: string }>> {
  const sesion = await obtenerSesion();
  if (!sesion?.empresa) return { ok: false, error: "No hay una empresa activa." };
  if (nota?.tipo !== "nota_credito" && nota?.tipo !== "nota_debito") return { ok: false, error: "Datos no válidos." };
  if (!motivosNota(nota.tipo, false).some((m) => m.valor === nota.motivo_tipo)) return { ok: false, error: "Elegí el motivo." };
  const motivo = String(nota.motivo ?? "").trim().slice(0, 300);
  if (!motivo) return { ok: false, error: "Escribí el motivo de la nota." };
  if (!Array.isArray(nota.lineas) || !nota.lineas.length || nota.lineas.length > 100) {
    return { ok: false, error: "La nota no tiene líneas." };
  }
  const lineas = [];
  for (const l of nota.lineas) {
    const descripcion = String(l.descripcion ?? "").trim().slice(0, 240);
    const monto = Math.round(Number(l.monto) * 100) / 100;
    if (!descripcion || !(monto > 0)) return { ok: false, error: "Revisá la descripción y el monto." };
    lineas.push({ descripcion, monto, exento: Boolean(l.exento) });
  }
  if (nota.id_cliente !== null && !esId(nota.id_cliente)) return { ok: false, error: "Cliente no válido." };
  const rtn = nota.cliente_rtn ? String(nota.cliente_rtn).replace(/\D/g, "") : null;
  if (rtn && rtn.length !== 14) return { ok: false, error: "El RTN son 14 dígitos." };
  const forma = nota.forma_pago === null ? null : FORMAS_PAGO.find((f) => f.valor === nota.forma_pago);
  if (forma === undefined) return { ok: false, error: "Elegí la forma de pago." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("emitir_nota_libre", {
    p_empresa: sesion.empresa.id,
    p_tipo: nota.tipo,
    p_cliente: nota.id_cliente,
    p_cliente_nombre: nota.id_cliente ? null : String(nota.cliente_nombre ?? "").trim().slice(0, 160) || null,
    p_cliente_rtn: nota.id_cliente ? null : rtn,
    p_motivo_tipo: nota.motivo_tipo,
    p_motivo: motivo,
    p_lineas: lineas,
    p_forma_pago: forma?.valor ?? null,
    p_referencia: forma?.pideReferencia ? String(nota.referencia_pago ?? "").trim().slice(0, 80) || null : null,
  });
  if (error || !data) return { ok: false, error: error ? mensaje(error, "No se pudo emitir la nota.") : "No se pudo emitir la nota." };
  const { data: doc } = await supabase.from("documentos").select("numero").eq("id", data).single();
  return { ok: true, id: data as string, numero: doc?.numero ?? "" };
}

/** Facturas emitidas para elegir sobre cuál va una nota (por número o cliente), con su saldo. */
export async function buscarFacturasParaNota(texto: string): Promise<FacturaParaNota[]> {
  const sesion = await obtenerSesion();
  if (!sesion?.empresa) return [];
  const termino = String(texto ?? "").replace(/["\\*%_(),]/g, " ").trim().slice(0, 60);
  const supabase = await createClient();
  let q = supabase
    .from("documentos")
    .select("id, numero, fecha, cliente_nombre, total")
    .eq("id_empresa", sesion.empresa.id)
    .eq("tipo", "factura")
    .eq("estado", "emitido")
    .order("fecha", { ascending: false })
    .limit(8);
  if (termino) q = q.or([`numero.ilike."*${termino}*"`, `cliente_nombre.ilike."*${termino}*"`].join(","));
  const { data } = await q;
  const facturas = (data ?? []) as Omit<FacturaParaNota, "saldo">[];
  if (!facturas.length) return [];
  const { data: notas } = await supabase
    .from("documentos")
    .select("id_factura, tipo, total")
    .in("id_factura", facturas.map((f) => f.id))
    .eq("estado", "emitido");
  return facturas.map((f) => ({
    ...f,
    total: Number(f.total),
    saldo:
      Math.round(
        (notas ?? [])
          .filter((n) => n.id_factura === f.id)
          .reduce((s, n) => s + (n.tipo === "nota_debito" ? Number(n.total) : -Number(n.total)), Number(f.total)) * 100,
      ) / 100,
  }));
}

/** Punto de emisión con el que factura el usuario (el suyo o el predeterminado). */
export async function puntoEmisionActual(): Promise<PuntoEmision | null> {
  const sesion = await obtenerSesion();
  if (!sesion?.empresa) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("punto_emision_actual", { p_empresa: sesion.empresa.id }).maybeSingle();
  const p = data as { id: number | null; establecimiento: string; punto_emision: string; nombre: string; sucursal: string } | null;
  if (!p?.id) return null;
  return { id: p.id, codigo: `${p.establecimiento}-${p.punto_emision}`, nombre: p.nombre, sucursal: p.sucursal };
}
