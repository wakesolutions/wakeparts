"use client";

import { useMemo, useState } from "react";
import ui from "@/components/ui/controles.module.css";
import { IconoBuscar, IconoCerrar, IconoMas } from "@/components/ui/iconos";
import type { DefColumna, DefRecurso, Filtro, Opcion, Operador } from "@/lib/recursos/tipos";
import { useOpcionesFuente } from "./opciones-cache";
import styles from "./tabla-maestra.module.css";
import { ETIQUETAS_OPERADOR, nuevoId, operadoresPara, sinValor, tipoFiltro } from "./utilidades";

type Props = {
  def: DefRecurso;
  filtros: Filtro[];
  onCambiar: (filtros: Filtro[]) => void;
};

export function PanelFiltros({ def, filtros, onCambiar }: Props) {
  const filtrables = def.columnas.filter((c) => tipoFiltro(c));

  function agregar() {
    const libres = filtrables.filter((c) => !filtros.some((f) => f.columna === c.clave));
    const col = libres.find((c) => !c.oculta) ?? libres[0] ?? filtrables[0];
    if (!col) return;
    const tipo = tipoFiltro(col)!;
    onCambiar([...filtros, { id: nuevoId(), columna: col.clave, operador: operadoresPara(tipo)[0] }]);
  }

  function actualizar(id: string, cambios: Partial<Filtro>) {
    onCambiar(filtros.map((f) => (f.id === id ? { ...f, ...cambios } : f)));
  }

  return (
    <div className={styles.panelFiltros}>
      <div className={styles.panelEncabezado}>
        <span className={ui.etiquetaSeccion}>Filtros</span>
        {filtros.length > 0 && (
          <button type="button" className={`${ui.boton} ${ui.fantasma}`} onClick={() => onCambiar([])}>
            Quitar todos
          </button>
        )}
      </div>

      {filtros.length === 0 && (
        <p className={styles.panelVacio}>Sin filtros. Agregá uno para acotar la lista.</p>
      )}

      <ul className={styles.listaFiltros}>
        {filtros.map((f, i) => {
          const col = def.columnas.find((c) => c.clave === f.columna) ?? filtrables[0];
          return (
            <li key={f.id} className={styles.filaFiltro}>
              <span className={styles.conector}>{i === 0 ? "Donde" : "y"}</span>
              <select
                className={`${ui.campo} ${styles.selColumna}`}
                aria-label="Columna"
                value={f.columna}
                onChange={(e) => {
                  const nueva = def.columnas.find((c) => c.clave === e.target.value)!;
                  actualizar(f.id, {
                    columna: nueva.clave,
                    operador: operadoresPara(tipoFiltro(nueva)!)[0],
                    valor: undefined,
                    valor2: undefined,
                    valores: undefined,
                  });
                }}
              >
                {filtrables.map((c) => (
                  <option key={c.clave} value={c.clave}>
                    {c.etiqueta}
                  </option>
                ))}
              </select>
              <select
                className={`${ui.campo} ${styles.selOperador}`}
                aria-label="Condición"
                value={f.operador}
                onChange={(e) => actualizar(f.id, { operador: e.target.value as Operador })}
              >
                {operadoresPara(tipoFiltro(col)!).map((op) => (
                  <option key={op} value={op}>
                    {ETIQUETAS_OPERADOR[op]}
                  </option>
                ))}
              </select>
              <div className={styles.valorFiltro}>
                <ValorFiltro col={col} filtro={f} onCambiar={(c) => actualizar(f.id, c)} />
              </div>
              <button
                type="button"
                className={`${ui.boton} ${ui.fantasma} ${ui.icono}`}
                aria-label="Quitar filtro"
                onClick={() => onCambiar(filtros.filter((x) => x.id !== f.id))}
              >
                <IconoCerrar tamano={14} />
              </button>
            </li>
          );
        })}
      </ul>

      <button type="button" className={`${ui.boton} ${styles.agregarFiltro}`} onClick={agregar}>
        <IconoMas tamano={14} /> Agregar filtro
      </button>
    </div>
  );
}

function ValorFiltro({
  col,
  filtro,
  onCambiar,
}: {
  col: DefColumna;
  filtro: Filtro;
  onCambiar: (c: Partial<Filtro>) => void;
}) {
  if (sinValor(filtro.operador)) return null;
  const tipo = tipoFiltro(col);

  if (tipo === "opciones") {
    return <SelectorMultiple col={col} valores={filtro.valores ?? []} onCambiar={(v) => onCambiar({ valores: v })} />;
  }

  const numerico = tipo === "numero";
  const input = (valor: string | number | undefined, campo: "valor" | "valor2", placeholder: string) => (
    <input
      className={`${ui.campo} ${numerico ? ui.campoMono : ""}`}
      type={numerico ? "number" : "text"}
      inputMode={numerico ? "decimal" : undefined}
      placeholder={placeholder}
      aria-label={placeholder}
      value={valor ?? ""}
      onChange={(e) => onCambiar({ [campo]: e.target.value })}
    />
  );

  if (filtro.operador === "entre") {
    return (
      <div className={styles.rango}>
        {input(filtro.valor, "valor", "Desde")}
        <span>y</span>
        {input(filtro.valor2, "valor2", "Hasta")}
      </div>
    );
  }
  return input(filtro.valor, "valor", "Valor");
}

function SelectorMultiple({
  col,
  valores,
  onCambiar,
}: {
  col: DefColumna;
  valores: (string | number)[];
  onCambiar: (v: (string | number)[]) => void;
}) {
  const [texto, setTexto] = useState("");
  const [abierto, setAbierto] = useState(false);
  const filtro = col.filtro && col.filtro.tipo === "opciones" ? col.filtro : undefined;
  const remotas = useOpcionesFuente(filtro?.fuente);
  const estaticas = filtro?.opciones;
  const opciones: readonly Opcion[] | null = useMemo(() => estaticas ?? remotas, [estaticas, remotas]);

  const visibles = useMemo(() => {
    const t = texto.trim().toUpperCase();
    return (opciones ?? []).filter((o) => !t || o.etiqueta.toUpperCase().includes(t)).slice(0, 80);
  }, [opciones, texto]);

  const seleccion = new Set(valores.map(String));
  const alternar = (v: string | number) =>
    onCambiar(seleccion.has(String(v)) ? valores.filter((x) => String(x) !== String(v)) : [...valores, v]);

  return (
    <div className={styles.multiple}>
      <button
        type="button"
        className={`${ui.campo} ${styles.multipleResumen}`}
        aria-expanded={abierto}
        onClick={() => setAbierto((a) => !a)}
      >
        {valores.length === 0
          ? "Elegí valores…"
          : valores.length <= 2
            ? valores.map((v) => opciones?.find((o) => String(o.valor) === String(v))?.etiqueta ?? v).join(", ")
            : `${valores.length} seleccionados`}
      </button>
      {abierto && (
        <div className={styles.multipleLista}>
          <label className={styles.multipleBuscar}>
            <IconoBuscar tamano={13} />
            <input
              autoFocus
              value={texto}
              placeholder="Buscar…"
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setAbierto(false)}
            />
          </label>
          <ul role="listbox" aria-multiselectable="true">
            {opciones === null && <li className={styles.panelVacio}>Cargando…</li>}
            {visibles.map((o) => (
              <li key={String(o.valor)}>
                <label className={styles.opcionCheck}>
                  <input
                    type="checkbox"
                    className={ui.casilla}
                    checked={seleccion.has(String(o.valor))}
                    onChange={() => alternar(o.valor)}
                  />
                  {o.etiqueta}
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
