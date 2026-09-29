import "server-only";
import type { PostgrestError } from "@supabase/supabase-js";
import { obtenerSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { obtenerRecurso } from "./index";
import type {
  Consulta,
  DefColumna,
  DefRecurso,
  Filtro,
  Opcion,
  ResultadoConsulta,
  ResultadoGuardar,
  Valores,
} from "./tipos";
import { validarValores } from "./validar";

const TAMANO_MAX = 200;

/* Nombres de columna válidos para leer de la vista de un recurso. */
function columnasPermitidas(def: DefRecurso) {
  return new Set([
    def.clave,
    ...def.columnas.map((c) => c.clave),
    ...(def.columnasInternas ?? []),
    ...(def.ambito === "empresa" || def.ambito === "compartido" ? ["id_empresa"] : []),
  ]);
}

/**
 * Empresa activa para recursos con ámbito "empresa". undefined = recurso global.
 * null = debería tener empresa pero no hay sesión/empresa.
 */
async function empresaDe(def: DefRecurso): Promise<string | null | undefined> {
  if (def.ambito !== "empresa" && def.ambito !== "compartido") return undefined;
  const sesion = await obtenerSesion();
  return sesion?.empresa?.id ?? null;
}

/** Restringe una consulta a la empresa activa (y a las filas globales si es «compartido»). */
function deLaEmpresa<Q extends { eq(c: string, v: unknown): Q; or(f: string): Q }>(
  q: Q,
  def: DefRecurso,
  empresa: string | undefined,
): Q {
  if (!empresa) return q;
  return def.ambito === "compartido" ? q.or(`id_empresa.is.null,id_empresa.eq.${empresa}`) : q.eq("id_empresa", empresa);
}

const permite = (def: DefRecurso, accion: "crear" | "editar" | "eliminar") =>
  def.escritura !== "ninguna" && def.acciones?.[accion] !== false;

const SOLO_ADMIN = "Solo el administrador de Wake Parts puede cambiar el catálogo general.";

/**
 * Catálogo global: además de RLS (flag en la base), el correo debe estar en
 * ADMINS_PLATAFORMA (lib/sesion.ts). null = puede; texto = motivo.
 */
async function bloqueoGlobal(def: DefRecurso) {
  if (def.escritura !== "admin_plataforma") return null;
  const sesion = await obtenerSesion();
  return sesion?.usuario.esAdminPlataforma ? null : SOLO_ADMIN;
}

/* Texto seguro para filtros de PostgREST dentro de comillas. */
function limpiarTermino(valor: string) {
  return valor.replace(/["\\*%_(),]/g, " ").trim();
}

function escaparLike(valor: string) {
  return valor.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function comoNumero(valor: unknown) {
  const n = typeof valor === "number" ? valor : Number(valor);
  return Number.isFinite(n) ? n : null;
}

// Tipo mínimo del builder que necesitamos (evita arrastrar genéricos de supabase-js).
type Builder = {
  or(f: string): Builder;
  ilike(c: string, v: string): Builder;
  not(c: string, op: string, v: unknown): Builder;
  eq(c: string, v: unknown): Builder;
  neq(c: string, v: unknown): Builder;
  gt(c: string, v: unknown): Builder;
  gte(c: string, v: unknown): Builder;
  lt(c: string, v: unknown): Builder;
  lte(c: string, v: unknown): Builder;
  in(c: string, v: unknown[]): Builder;
  is(c: string, v: null | boolean): Builder;
  order(c: string, o: { ascending: boolean; nullsFirst?: boolean }): Builder;
  range(a: number, b: number): Builder;
  limit(n: number): Builder;
};

function aplicarFiltro(q: Builder, col: DefColumna, f: Filtro): Builder {
  const c = col.clave;
  const numerico = col.tipo === "entero" || col.tipo === "decimal";
  const valor = numerico ? comoNumero(f.valor) : f.valor != null ? String(f.valor) : null;

  switch (f.operador) {
    case "vacio":
      return q.is(c, null);
    case "no_vacio":
      return q.not(c, "is", null);
    case "verdadero":
      return q.eq(c, true);
    case "falso":
      return q.eq(c, false);
    case "en": {
      const valores = (f.valores ?? []).slice(0, 200);
      return valores.length ? q.in(c, valores) : q;
    }
  }

  if (valor === null || valor === "") return q;

  if (!numerico) {
    const v = escaparLike(String(valor));
    switch (f.operador) {
      case "contiene":
        return q.ilike(c, `%${v}%`);
      case "empieza":
        return q.ilike(c, `${v}%`);
      case "igual":
        return q.ilike(c, v);
      case "distinto":
        return q.not(c, "ilike", v);
      default:
        return q;
    }
  }

  switch (f.operador) {
    case "igual":
      return q.eq(c, valor);
    case "distinto":
      return q.neq(c, valor);
    case "mayor":
      return q.gt(c, valor);
    case "mayor_igual":
      return q.gte(c, valor);
    case "menor":
      return q.lt(c, valor);
    case "menor_igual":
      return q.lte(c, valor);
    case "entre": {
      const hasta = comoNumero(f.valor2);
      const conDesde = q.gte(c, valor);
      return hasta === null ? conDesde : conDesde.lte(c, hasta);
    }
    default:
      return q;
  }
}

export async function consultarRecurso(id: string, consulta: Consulta): Promise<ResultadoConsulta> {
  const def = obtenerRecurso(id);
  const columnas = new Map(def.columnas.map((c) => [c.clave, c]));
  const supabase = await createClient();

  const tamano = Math.min(Math.max(1, Math.floor(consulta.tamano) || 50), TAMANO_MAX);
  const pagina = Math.max(0, Math.floor(consulta.pagina) || 0);

  const empresa = await empresaDe(def);
  if (empresa === null) return { ok: false, error: "No hay una empresa activa." };

  let q = supabase
    .from(def.vista)
    .select([...columnasPermitidas(def)].join(","), { count: "exact" }) as unknown as Builder;
  q = deLaEmpresa(q, def, empresa);

  // Búsqueda rápida: cada palabra debe aparecer en alguna columna buscable.
  const terminos = limpiarTermino(consulta.busqueda ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6);
  const buscables = def.columnas.filter((c) => c.buscable);
  for (const termino of terminos) {
    const partes = buscables.flatMap((c) => {
      if (c.tipo === "texto") return [`${c.clave}.ilike."*${termino}*"`];
      if ((c.tipo === "entero" || c.tipo === "decimal") && /^\d+(\.\d+)?$/.test(termino)) {
        return [`${c.clave}.eq.${termino}`];
      }
      return [];
    });
    if (partes.length) q = q.or(partes.join(","));
  }

  for (const filtro of consulta.filtros ?? []) {
    const col = columnas.get(filtro.columna);
    if (col && col.filtro !== false) q = aplicarFiltro(q, col, filtro);
  }

  const orden = (consulta.orden?.length ? consulta.orden : def.orden ?? []).filter(
    (o) => columnas.get(o.columna)?.ordenable !== false && columnas.has(o.columna),
  );
  for (const o of orden) q = q.order(o.columna, { ascending: o.dir !== "desc", nullsFirst: false });
  if (!orden.some((o) => o.columna === def.clave)) q = q.order(def.clave, { ascending: true });

  const desde = pagina * tamano;
  const { data, count, error } = (await q.range(desde, desde + tamano - 1)) as unknown as {
    data: Record<string, unknown>[] | null;
    count: number | null;
    error: PostgrestError | null;
  };

  if (error) {
    // Página fuera de rango tras cambiar filtros: se devuelve vacía.
    if (error.code === "PGRST103") return { ok: true, filas: [], total: count ?? 0 };
    console.error("[consultarRecurso]", id, error);
    return { ok: false, error: "No se pudieron cargar los datos." };
  }
  return { ok: true, filas: data ?? [], total: count ?? 0 };
}

export async function buscarOpciones(
  id: string,
  opciones: {
    valor: string;
    etiqueta: string | readonly string[];
    busqueda?: string;
    filtro?: { columna: string; valor: unknown };
    fijo?: { columna: string; valor: string | number | boolean };
    valores?: (string | number)[];
    limite?: number;
  },
): Promise<Opcion[]> {
  const def = obtenerRecurso(id);
  const permitidas = columnasPermitidas(def);
  const etiquetas = typeof opciones.etiqueta === "string" ? [opciones.etiqueta] : [...opciones.etiqueta];
  if (![opciones.valor, ...etiquetas].every((c) => permitidas.has(c))) return [];

  const empresa = await empresaDe(def);
  if (empresa === null) return [];

  const supabase = await createClient();
  let q = supabase
    .from(def.vista)
    .select([...new Set([opciones.valor, ...etiquetas])].join(",")) as unknown as Builder;
  q = deLaEmpresa(q, def, empresa);
  if (opciones.fijo && permitidas.has(opciones.fijo.columna)) q = q.eq(opciones.fijo.columna, opciones.fijo.valor);

  if (opciones.filtro && permitidas.has(opciones.filtro.columna)) {
    if (opciones.filtro.valor === null || opciones.filtro.valor === undefined || opciones.filtro.valor === "") return [];
    q = q.eq(opciones.filtro.columna, opciones.filtro.valor);
  }
  if (opciones.valores?.length) q = q.in(opciones.valor, opciones.valores.slice(0, 100));

  const termino = limpiarTermino(opciones.busqueda ?? "");
  if (termino) {
    const etiquetaTexto = etiquetas.filter((c) => def.columnas.find((d) => d.clave === c)?.tipo === "texto");
    const partes = etiquetaTexto.map((c) => `${c}.ilike."*${termino}*"`);
    if (/^\d+$/.test(termino)) {
      etiquetas
        .filter((c) => def.columnas.find((d) => d.clave === c)?.tipo === "entero")
        .forEach((c) => partes.push(`${c}.eq.${termino}`));
    }
    if (partes.length) q = q.or(partes.join(","));
  }

  for (const c of etiquetas) q = q.order(c, { ascending: true });
  const { data, error } = (await q.limit(Math.min(opciones.limite ?? 50, 500))) as unknown as {
    data: Record<string, unknown>[] | null;
    error: PostgrestError | null;
  };
  if (error || !data) return [];

  return data.map((fila) => ({
    valor: fila[opciones.valor] as string | number,
    etiqueta: etiquetas.map((c) => String(fila[c] ?? "")).join(" · "),
  }));
}

function traducirError(def: DefRecurso, error: PostgrestError): string {
  switch (error.code) {
    case "23505":
      return def.mensajes?.duplicado ?? "Ya existe un registro con esos datos.";
    case "23503":
      return def.mensajes?.enUso ?? "No se puede completar: hay registros relacionados.";
    case "23514":
      return "Algún valor está fuera del rango permitido.";
    case "23502":
      return "Falta un dato obligatorio.";
    case "42501":
      return "No tenés permiso para modificar estos datos.";
    case "P0001":
      // Reglas de negocio de los triggers: el mensaje ya viene en español.
      return error.message;
    default:
      console.error("[recursos]", def.id, error);
      return "No se pudo guardar. Intentá de nuevo.";
  }
}

export async function guardarRecurso(
  id: string,
  clave: string | number | null,
  valores: Valores,
): Promise<ResultadoGuardar> {
  const def = obtenerRecurso(id);
  if (!permite(def, clave === null ? "crear" : "editar")) {
    return { ok: false, error: "Esta acción no está disponible." };
  }
  const bloqueo = await bloqueoGlobal(def);
  if (bloqueo) return { ok: false, error: bloqueo };

  const validacion = validarValores(def.campos, valores, { edicion: clave !== null });
  if (!validacion.ok) return { ok: false, error: "Revisá los campos marcados.", errores: validacion.errores };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Tu sesión expiró. Volvé a entrar." };

  const empresa = await empresaDe(def);
  if (empresa === null) return { ok: false, error: "No hay una empresa activa." };

  const tabla = supabase.from(def.tabla);
  const { data, error } =
    clave === null
      ? await tabla.insert(empresa ? { ...validacion.datos, id_empresa: empresa } : validacion.datos).select(def.clave)
      : await deLaEmpresa(tabla.update(validacion.datos).eq(def.clave, clave), def, empresa).select(def.clave);

  if (error) return { ok: false, error: traducirError(def, error) };
  const fila = (data as unknown as Record<string, unknown>[] | null)?.[0];
  if (!fila) return { ok: false, error: "No tenés permiso para modificar estos datos." };
  return { ok: true, id: fila[def.clave] as string | number };
}

export async function eliminarRecurso(
  id: string,
  clave: string | number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const def = obtenerRecurso(id);
  if (!permite(def, "eliminar")) return { ok: false, error: "Esta acción no está disponible." };
  const bloqueo = await bloqueoGlobal(def);
  if (bloqueo) return { ok: false, error: bloqueo };
  const empresa = await empresaDe(def);
  if (empresa === null) return { ok: false, error: "No hay una empresa activa." };

  const supabase = await createClient();
  const base = supabase.from(def.tabla).delete().eq(def.clave, clave);
  const { data, error } = await deLaEmpresa(base, def, empresa).select(def.clave);
  if (error) return { ok: false, error: traducirError(def, error) };
  if (!data?.length) return { ok: false, error: "No tenés permiso para eliminar este registro." };
  return { ok: true };
}

export async function leerRegistro(id: string, clave: string | number) {
  const def = obtenerRecurso(id);
  const empresa = await empresaDe(def);
  if (empresa === null) return null;
  const supabase = await createClient();
  const base = supabase.from(def.vista).select([...columnasPermitidas(def)].join(",")).eq(def.clave, clave);
  const { data } = await deLaEmpresa(base, def, empresa).maybeSingle();
  return (data as Record<string, unknown> | null) ?? null;
}
