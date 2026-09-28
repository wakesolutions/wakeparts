import type { Calculo, Valores } from "./tipos";

const num = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/** Resultado de un campo «calculado» con los valores actuales del formulario. */
export function calcular(calculo: Calculo, valores: Valores): number | null {
  switch (calculo.tipo) {
    case "resta": {
      const a = num(valores[calculo.a]);
      const b = num(valores[calculo.b]);
      return a === null || b === null ? null : Math.round((a - b) * 100) / 100;
    }
    case "margen": {
      const p = num(valores[calculo.precio]);
      const c = num(valores[calculo.costo]);
      return p === null || c === null || p <= 0 ? null : Math.round(((p - c) / p) * 10000) / 100;
    }
    case "conImpuesto": {
      const base = num(valores[calculo.base]);
      if (base === null) return null;
      const exento = calculo.exento ? valores[calculo.exento] === true : false;
      return Math.round(base * (exento ? 1 : 1 + calculo.tasa) * 100) / 100;
    }
  }
}
