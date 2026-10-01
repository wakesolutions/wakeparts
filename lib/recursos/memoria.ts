import type { Consulta, DefColumna, DefRecurso, Fila, Filtro, Opcion, ResultadoConsulta } from "./tipos";

/**
 * Las consultas de lib/recursos/servidor.ts, pero sobre filas en memoria:
 * búsqueda por palabras en columnas buscables, filtros, orden y páginas. Lo
 * usan el sandbox y la demo pública (/demo) para que TablaMaestra funcione
 * igual sin base de datos.
 */

const normal = (v: unknown) =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const numero = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(v);
  return v === null || v === undefined || v === "" || !Number.isFinite(n) ? null : n;
};

function cumple(fila: Fila, col: DefColumna, f: Filtro): boolean {
  const v = fila[col.clave];
  switch (f.operador) {
    case "vacio":
      return v === null || v === undefined || v === "";
    case "no_vacio":
      return !(v === null || v === undefined || v === "");
    case "verdadero":
      return v === true;
    case "falso":
      return v === false;
    case "en":
      return !f.valores?.length || f.valores.map(String).includes(String(v));
  }
  if (f.valor === undefined || f.valor === "") return true;

  if (col.tipo !== "entero" && col.tipo !== "decimal") {
    const a = normal(v);
    const b = normal(f.valor);
    switch (f.operador) {
      case "contiene":
        return a.includes(b);
      case "empieza":
        return a.startsWith(b);
      case "igual":
        return a === b;
      case "distinto":
        return a !== b;
      default:
        return true;
    }
  }

  const a = numero(v);
  const b = numero(f.valor);
  if (b === null) return true;
  if (a === null) return false;
  switch (f.operador) {
    case "igual":
      return a === b;
    case "distinto":
      return a !== b;
    case "mayor":
      return a > b;
    case "mayor_igual":
      return a >= b;
    case "menor":
      return a < b;
    case "menor_igual":
      return a <= b;
    case "entre": {
      const c = numero(f.valor2);
      return a >= b && (c === null || a <= c);
    }
    default:
      return true;
  }
}

function comparar(a: unknown, b: unknown) {
  // Nulos al final, como nullsFirst: false.
  if (a === null || a === undefined) return b === null || b === undefined ? 0 : 1;
  if (b === null || b === undefined) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
  return normal(a).localeCompare(normal(b), "es");
}

export function consultarEnMemoria(def: DefRecurso, filas: Fila[], consulta: Consulta): ResultadoConsulta {
  const columnas = new Map(def.columnas.map((c) => [c.clave, c]));
  const buscables = def.columnas.filter((c) => c.buscable);
  const terminos = normal(consulta.busqueda).split(/\s+/).filter(Boolean).slice(0, 6);

  let lista = filas.filter((f) =>
    terminos.every((t) =>
      buscables.some((c) =>
        c.tipo === "entero" || c.tipo === "decimal" ? String(f[c.clave] ?? "") === t : normal(f[c.clave]).includes(t),
      ),
    ),
  );
  for (const filtro of consulta.filtros ?? []) {
    const col = columnas.get(filtro.columna);
    if (col && col.filtro !== false) lista = lista.filter((f) => cumple(f, col, filtro));
  }

  const orden = (consulta.orden?.length ? consulta.orden : (def.orden ?? [])).filter((o) => columnas.has(o.columna));
  lista = [...lista].sort((a, b) => {
    for (const o of orden) {
      const r = comparar(a[o.columna], b[o.columna]);
      if (r) return o.dir === "desc" ? -r : r;
    }
    return comparar(a[def.clave], b[def.clave]);
  });

  const tamano = Math.min(Math.max(1, Math.floor(consulta.tamano) || 50), 200);
  const desde = Math.max(0, Math.floor(consulta.pagina) || 0) * tamano;
  return { ok: true, filas: lista.slice(desde, desde + tamano), total: lista.length };
}

export function opcionesEnMemoria(
  filas: Fila[],
  o: {
    valor: string;
    etiqueta: string | readonly string[];
    busqueda?: string;
    filtro?: { columna: string; valor: unknown };
    fijo?: { columna: string; valor: string | number | boolean };
    valores?: (string | number)[];
    limite?: number;
  },
): Opcion[] {
  const etiquetas = typeof o.etiqueta === "string" ? [o.etiqueta] : [...o.etiqueta];
  if (o.filtro && (o.filtro.valor === null || o.filtro.valor === undefined || o.filtro.valor === "")) return [];
  const termino = normal(o.busqueda);
  return filas
    .filter((f) => !o.fijo || String(f[o.fijo.columna]) === String(o.fijo.valor))
    .filter((f) => !o.filtro || String(f[o.filtro.columna]) === String(o.filtro.valor))
    .filter((f) => !o.valores?.length || o.valores.map(String).includes(String(f[o.valor])))
    .filter((f) => !termino || etiquetas.some((c) => normal(f[c]).includes(termino)))
    .sort((a, b) => etiquetas.reduce((r, c) => r || comparar(a[c], b[c]), 0))
    .slice(0, Math.min(o.limite ?? 50, 500))
    .map((f) => ({
      valor: f[o.valor] as string | number,
      etiqueta: etiquetas.map((c) => String(f[c] ?? "")).join(" · "),
    }));
}
