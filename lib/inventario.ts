// Entradas de inventario e importación de productos: tipos y utilidades
// compartidas entre el cliente, las acciones y el sandbox.

export type ModoCosto = "promedio" | "ultimo" | "mantener";

export type LineaEntrada = { id_producto: number; cantidad: number; costo: number | null };

export type CampoImportacion =
  | "codigo"
  | "nombre"
  | "categoria"
  | "marca"
  | "oem"
  | "numero_parte"
  | "codigo_barras"
  | "referencias"
  | "descripcion"
  | "condicion"
  | "unidad"
  | "costo"
  | "precio"
  | "existencia"
  | "existencia_minima"
  | "ubicacion"
  | "garantia_dias"
  | "exento";

export type FilaImportacion = Partial<Record<CampoImportacion, string | number | boolean | null>> & { _fila: number };

export type ResultadoImportacion = {
  creados: number;
  actualizados: number;
  saltados: number;
  marcas_nuevas: string[];
  errores: { fila: number; mensaje: string }[];
  probado: boolean;
};

type DefColumna = { campo: CampoImportacion; titulo: string; tipo: "texto" | "numero" | "booleano"; alias: string[]; ejemplo: string | number };

/** Columnas de la plantilla, en orden. `alias` = otros encabezados que se reconocen. */
export const COLUMNAS_IMPORTACION: readonly DefColumna[] = [
  { campo: "codigo", titulo: "Código", tipo: "texto", alias: ["sku", "cod", "codigo interno", "clave"], ejemplo: "PF-0101" },
  { campo: "nombre", titulo: "Nombre", tipo: "texto", alias: ["producto", "descripcion corta", "articulo", "item"], ejemplo: "Pastillas de freno delanteras" },
  { campo: "categoria", titulo: "Categoría", tipo: "texto", alias: ["categoria", "familia", "linea", "rubro", "tipo"], ejemplo: "Pastillas de freno" },
  { campo: "marca", titulo: "Marca", tipo: "texto", alias: ["fabricante", "marca repuesto"], ejemplo: "BOSCH" },
  { campo: "oem", titulo: "OEM", tipo: "texto", alias: ["numero oem", "codigo oem", "original"], ejemplo: "04465-0K240" },
  { campo: "numero_parte", titulo: "Número de parte", tipo: "texto", alias: ["no parte", "n parte", "part number", "numero parte", "parte"], ejemplo: "0986AB1234" },
  { campo: "codigo_barras", titulo: "Código de barras", tipo: "texto", alias: ["barras", "ean", "upc"], ejemplo: "" },
  { campo: "referencias", titulo: "Equivalencias", tipo: "texto", alias: ["referencias", "equivalentes", "cruces", "intercambios"], ejemplo: "D1303, 0986AB1234" },
  { campo: "descripcion", titulo: "Descripción", tipo: "texto", alias: ["detalle", "observaciones"], ejemplo: "" },
  { campo: "condicion", titulo: "Condición", tipo: "texto", alias: ["estado"], ejemplo: "nuevo" },
  { campo: "unidad", titulo: "Unidad", tipo: "texto", alias: ["unidad de medida", "um", "medida"], ejemplo: "unidad" },
  { campo: "costo", titulo: "Costo", tipo: "numero", alias: ["costo unitario", "precio costo", "precio de compra", "compra"], ejemplo: 480 },
  { campo: "precio", titulo: "Precio", tipo: "numero", alias: ["precio venta", "precio de venta", "venta", "pvp"], ejemplo: 820 },
  { campo: "existencia", titulo: "Existencia", tipo: "numero", alias: ["stock", "cantidad", "inventario", "exist"], ejemplo: 6 },
  { campo: "existencia_minima", titulo: "Mínimo", tipo: "numero", alias: ["existencia minima", "stock minimo", "minimo", "min"], ejemplo: 2 },
  { campo: "ubicacion", titulo: "Ubicación", tipo: "texto", alias: ["bodega", "estante", "ubic"], ejemplo: "A1" },
  { campo: "garantia_dias", titulo: "Garantía (días)", tipo: "numero", alias: ["garantia", "dias garantia"], ejemplo: 30 },
  { campo: "exento", titulo: "Exento de ISV", tipo: "booleano", alias: ["exento", "sin isv"], ejemplo: "no" },
];

const normal = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Para cada columna del archivo, el campo al que corresponde (o null si se ignora). */
export function mapearEncabezados(encabezados: string[]): (CampoImportacion | null)[] {
  const usados = new Set<CampoImportacion>();
  return encabezados.map((e) => {
    const n = normal(String(e ?? ""));
    if (!n) return null;
    const col = COLUMNAS_IMPORTACION.find(
      (c) => !usados.has(c.campo) && (normal(c.titulo) === n || c.campo.replace(/_/g, " ") === n || c.alias.some((a) => normal(a) === n)),
    );
    if (!col) return null;
    usados.add(col.campo);
    return col.campo;
  });
}

/** «L 1,250.50», «1250,50» o 1250.5 → 1250.5. Vacío → null. */
export function aNumero(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = String(v).replace(/[^\d,.-]/g, "");
  if (!s) return null;
  // Con coma y punto, el último es el decimal; con solo coma, coma decimal si tiene 1–2 decimales.
  if (s.includes(",") && s.includes(".")) s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  else if (s.includes(",")) s = /,\d{1,2}$/.test(s) ? s.replace(",", ".") : s.replace(/,/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

export function aBooleano(v: unknown): boolean | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "boolean") return v;
  const n = normal(String(v));
  if (["si", "s", "x", "1", "true", "verdadero", "exento"].includes(n)) return true;
  if (["no", "n", "0", "false", "falso"].includes(n)) return false;
  return null;
}

/** Convierte las filas crudas del archivo en filas para la base, con su número de fila original. */
export function construirFilas(filas: unknown[][], mapa: (CampoImportacion | null)[], primeraFila = 2): FilaImportacion[] {
  const salida: FilaImportacion[] = [];
  filas.forEach((f, i) => {
    if (!f || f.every((c) => c === null || c === undefined || String(c).trim() === "")) return;
    const fila: FilaImportacion = { _fila: i + primeraFila };
    mapa.forEach((campo, j) => {
      if (!campo) return;
      const def = COLUMNAS_IMPORTACION.find((c) => c.campo === campo)!;
      const crudo = f[j];
      if (def.tipo === "numero") {
        const n = aNumero(crudo);
        // Un número ilegible se manda como texto: la base lo reporta en esa fila.
        if (n !== null) fila[campo] = Number.isNaN(n) ? String(crudo) : n;
      } else if (def.tipo === "booleano") {
        const b = aBooleano(crudo);
        if (b !== null) fila[campo] = b;
      } else if (crudo !== null && crudo !== undefined && String(crudo).trim() !== "") {
        fila[campo] = String(crudo).trim();
      }
    });
    salida.push(fila);
  });
  return salida;
}
