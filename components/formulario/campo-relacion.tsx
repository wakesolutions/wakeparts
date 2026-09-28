"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { accionOpciones } from "@/app/acciones/recursos";
import ui from "@/components/ui/controles.module.css";
import { IconoChevron } from "@/components/ui/iconos";
import type { FuenteOpciones, Opcion } from "@/lib/recursos/tipos";
import styles from "./formulario.module.css";

type Props = {
  id: string;
  fuente: FuenteOpciones;
  valor: unknown;
  /** Valor del campo del que depende (si aplica). */
  valorPadre?: unknown;
  etiquetaPadre?: string;
  invalido?: boolean;
  deshabilitado?: boolean;
  onCambiar: (valor: string | number | null) => void;
};

/** Combobox con búsqueda en el servidor. */
export function CampoRelacion({
  id,
  fuente,
  valor,
  valorPadre,
  etiquetaPadre,
  invalido,
  deshabilitado,
  onCambiar,
}: Props) {
  const listaId = useId();
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [opciones, setOpciones] = useState<Opcion[]>([]);
  const [cargando, setCargando] = useState(false);
  const [activa, setActiva] = useState(0);
  const [etiqueta, setEtiqueta] = useState<string | null>(null);
  const contenedor = useRef<HTMLDivElement>(null);

  const bloqueado = deshabilitado || (fuente.dependeDe !== undefined && (valorPadre ?? "") === "");

  // Etiqueta del valor actual (al editar un registro existente)
  const valorTexto = valor === null || valor === undefined ? "" : String(valor);
  useEffect(() => {
    if (!valorTexto) return;
    let vivo = true;
    accionOpciones(fuente.recurso, { valor: fuente.valor, etiqueta: fuente.etiqueta, valores: [valorTexto], limite: 1 })
      .then((o) => vivo && setEtiqueta(o[0]?.etiqueta ?? `#${valorTexto}`))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [fuente, valorTexto]);

  // Búsqueda
  const padreTexto = valorPadre === null || valorPadre === undefined ? "" : String(valorPadre);
  useEffect(() => {
    if (!abierto) return;
    let vivo = true;
    const t = setTimeout(() => {
      setCargando(true);
      accionOpciones(fuente.recurso, {
        valor: fuente.valor,
        etiqueta: fuente.etiqueta,
        busqueda: texto,
        filtro: fuente.dependeDe ? { columna: fuente.dependeDe.columna, valor: padreTexto } : undefined,
        fijo: fuente.fijo,
        limite: 60,
      })
        .then((o) => {
          if (!vivo) return;
          setOpciones(o);
          setActiva(0);
        })
        .catch(() => {})
        .finally(() => vivo && setCargando(false));
    }, 180);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [abierto, texto, fuente, padreTexto]);

  useEffect(() => {
    if (!abierto) return;
    const cerrar = (e: PointerEvent) => {
      if (!contenedor.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("pointerdown", cerrar);
    return () => document.removeEventListener("pointerdown", cerrar);
  }, [abierto]);

  function elegir(o: Opcion) {
    onCambiar(o.valor);
    setEtiqueta(o.etiqueta);
    setTexto("");
    setAbierto(false);
  }

  function alTeclear(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAbierto(true);
      setActiva((a) => Math.min(a + 1, opciones.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiva((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && abierto) {
      e.preventDefault();
      if (opciones[activa]) elegir(opciones[activa]);
    } else if (e.key === "Escape" && abierto) {
      e.stopPropagation();
      setAbierto(false);
    }
  }

  const mostrado = abierto ? texto : valorTexto ? (etiqueta ?? "…") : "";

  return (
    <div className={styles.combo} ref={contenedor}>
      <input
        id={id}
        role="combobox"
        aria-expanded={abierto}
        aria-controls={listaId}
        aria-autocomplete="list"
        aria-invalid={invalido || undefined}
        autoComplete="off"
        disabled={bloqueado}
        className={ui.campo}
        placeholder={
          bloqueado && fuente.dependeDe ? `Elegí primero ${etiquetaPadre?.toLowerCase() ?? "el campo anterior"}` : "Buscar…"
        }
        value={mostrado}
        onFocus={() => setAbierto(true)}
        onClick={() => setAbierto(true)}
        onChange={(e) => {
          setTexto(e.target.value);
          setAbierto(true);
        }}
        onKeyDown={alTeclear}
      />
      <span className={styles.comboFlecha} aria-hidden="true">
        <IconoChevron tamano={14} />
      </span>
      {abierto && !bloqueado && (
        <ul id={listaId} role="listbox" className={styles.comboLista}>
          {cargando && opciones.length === 0 && <li className={styles.comboVacio}>Buscando…</li>}
          {!cargando && opciones.length === 0 && <li className={styles.comboVacio}>Sin coincidencias</li>}
          {opciones.map((o, i) => (
            <li
              key={String(o.valor)}
              role="option"
              aria-selected={String(o.valor) === valorTexto}
              data-activa={i === activa || undefined}
              onPointerDown={(e) => {
                e.preventDefault();
                elegir(o);
              }}
              onPointerEnter={() => setActiva(i)}
            >
              {o.etiqueta}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
