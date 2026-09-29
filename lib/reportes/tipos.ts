/**
 * Reportes genéricos (TableroReporte). Un reporte = una DefReporte + una
 * función SQL `(p_empresa uuid, p_desde date, p_hasta date) returns jsonb`
 * que devuelve DatosReporte. Ver docs/componentes.md › «Reportes».
 */

export type FormatoReporte = "moneda" | "entero" | "cantidad" | "porcentaje" | "texto" | "codigo";

export type DefIndicador = {
  clave: string;
  etiqueta: string;
  formato: FormatoReporte;
  /** El indicador principal se dibuja grande, como visor LCD. */
  destacado?: boolean;
  /** Menos es mejor (anuladas, descuentos): invierte el color de la variación. */
  inverso?: boolean;
  ayuda?: string;
};

export type DefSerie = {
  clave: string;
  etiqueta: string;
  formato: FormatoReporte;
  /** Dato que acompaña al principal en el detalle de cada barra (p. ej. cantidad de facturas). */
  secundaria?: { clave: string; etiqueta: string; formato: FormatoReporte };
};

export type DefColumnaRanking = {
  clave: string;
  etiqueta: string;
  formato: FormatoReporte;
  /** Columna de texto principal (se trunca y lleva la barra debajo). */
  principal?: boolean;
  /** Texto chico bajo el principal (p. ej. el código). */
  secundaria?: boolean;
};

export type DefRanking = {
  clave: string;
  titulo: string;
  columnas: readonly DefColumnaRanking[];
  /** Columna numérica que define el largo de la barra. */
  medida: string;
  ancho?: "completo" | "mitad";
  vacio?: string;
};

export type PeriodoId = "hoy" | "7d" | "30d" | "mes" | "mes_anterior" | "anio";

export type DefReporte = {
  id: string;
  titulo: string;
  descripcion: string;
  /** Función SQL (RPC) que arma el reporte. */
  funcion: string;
  indicadores: readonly DefIndicador[];
  serie?: DefSerie;
  rankings: readonly DefRanking[];
  periodo?: PeriodoId;
  vacio?: string;
};

export type ValorIndicador = { valor: number | null; anterior: number | null } | null;

export type DatosReporte = {
  periodo: { desde: string; hasta: string; dias: number };
  indicadores: Record<string, ValorIndicador>;
  serie: Record<string, number | string>[];
  rankings: Record<string, Record<string, number | string | null>[]>;
};
