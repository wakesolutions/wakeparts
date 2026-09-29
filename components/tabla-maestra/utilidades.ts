"use client";

import { useEffect, useRef, useState } from "react";
import { fechaHoraExacta, moneda, pct } from "@/lib/formato";
import type { DefColumna, DefRecurso, Operador, PreferenciasTabla } from "@/lib/recursos/tipos";

const numero = new Intl.NumberFormat("es-HN");
const fecha = new Intl.DateTimeFormat("es-HN", { day: "numeric", month: "short", year: "numeric" });
const litros = new Intl.NumberFormat("es-HN", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function formatearCelda(col: DefColumna, valor: unknown): string | null {
  if (col.vacio && (valor === null || valor === undefined || valor === "" || valor === 0)) return col.vacio;
  if (valor === null || valor === undefined || valor === "") return null;
  if (col.opciones) {
    const op = col.opciones.find((o) => String(o.valor) === String(valor));
    if (op) return op.etiqueta;
  }
  switch (col.formato) {
    case "miles":
      return numero.format(Number(valor));
    case "litros":
      return `${litros.format(Number(valor))} L`;
    case "cc":
      return `${numero.format(Number(valor))} cc`;
    case "anio":
    case "codigo":
    case "imagen":
      return String(valor);
    case "moneda":
      return moneda(Number(valor));
    case "porcentaje":
      return pct(Number(valor));
    case "fechaHora": {
      const d = new Date(String(valor));
      return Number.isNaN(d.getTime()) ? String(valor) : fechaHoraExacta(d);
    }
  }
  if (col.tipo === "booleano") return valor ? "Sí" : "No";
  if (col.tipo === "fecha") {
    const d = new Date(String(valor));
    return Number.isNaN(d.getTime()) ? String(valor) : fecha.format(d);
  }
  if (col.tipo === "entero" || col.tipo === "decimal") return numero.format(Number(valor));
  return String(valor);
}

export const esNumerica = (col: DefColumna) => col.tipo === "entero" || col.tipo === "decimal";

export const ETIQUETAS_OPERADOR: Record<Operador, string> = {
  contiene: "contiene",
  igual: "es igual a",
  distinto: "no es",
  empieza: "empieza con",
  vacio: "está vacío",
  no_vacio: "no está vacío",
  mayor: "mayor que",
  mayor_igual: "mayor o igual a",
  menor: "menor que",
  menor_igual: "menor o igual a",
  entre: "entre",
  en: "es alguno de",
  verdadero: "es sí",
  falso: "es no",
};

export const SIMBOLO_OPERADOR: Partial<Record<Operador, string>> = {
  igual: "=",
  distinto: "≠",
  mayor: ">",
  mayor_igual: "≥",
  menor: "<",
  menor_igual: "≤",
};

export type TipoFiltroEfectivo = "texto" | "numero" | "opciones" | "booleano";

export function tipoFiltro(col: DefColumna): TipoFiltroEfectivo | null {
  if (col.filtro === false) return null;
  if (col.filtro) return col.filtro.tipo;
  if (col.tipo === "fecha") return null;
  if (col.tipo === "booleano") return "booleano";
  if (esNumerica(col)) return "numero";
  return "texto";
}

export function operadoresPara(tipo: TipoFiltroEfectivo): Operador[] {
  switch (tipo) {
    case "texto":
      return ["contiene", "igual", "empieza", "distinto", "vacio", "no_vacio"];
    case "numero":
      return ["igual", "distinto", "mayor", "mayor_igual", "menor", "menor_igual", "entre", "vacio", "no_vacio"];
    case "opciones":
      return ["en", "vacio", "no_vacio"];
    case "booleano":
      return ["verdadero", "falso"];
  }
}

export const sinValor = (op: Operador) => ["vacio", "no_vacio", "verdadero", "falso"].includes(op);

export type ColumnaCfg = { clave: string; visible: boolean; ancho: number };

/** Combina la definición con las preferencias guardadas (orden, visibilidad, anchos). */
export function columnasIniciales(def: DefRecurso, pref: PreferenciasTabla | null): ColumnaCfg[] {
  const porClave = new Map(def.columnas.map((c) => [c.clave, c]));
  const resultado: ColumnaCfg[] = [];
  for (const p of pref?.columnas ?? []) {
    const col = porClave.get(p.clave);
    if (!col) continue;
    resultado.push({ clave: p.clave, visible: p.visible, ancho: p.ancho ?? col.ancho ?? 160 });
    porClave.delete(p.clave);
  }
  for (const col of porClave.values()) {
    resultado.push({ clave: col.clave, visible: !col.oculta, ancho: col.ancho ?? 160 });
  }
  return resultado;
}

export function columnasPorDefecto(def: DefRecurso): ColumnaCfg[] {
  return columnasIniciales(def, null);
}

/** Valor que se actualiza `ms` después del último cambio. */
export function useDiferido<T>(valor: T, ms: number): T {
  const [diferido, setDiferido] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setDiferido(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return diferido;
}

/** Ejecuta `fn` como máximo una vez cada `ms` tras el último llamado. */
export function useRetrasar<A extends unknown[]>(fn: (...args: A) => void, ms: number) {
  const ref = useRef(fn);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    ref.current = fn;
  });
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  return (...args: A) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => ref.current(...args), ms);
  };
}

let contador = 0;
export const nuevoId = () => `f${Date.now().toString(36)}${(contador++).toString(36)}`;
