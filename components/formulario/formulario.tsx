"use client";

import { Fragment, useId, useState, useTransition, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import ui from "@/components/ui/controles.module.css";
import { IconoPapelera } from "@/components/ui/iconos";
import { moneda, pct } from "@/lib/formato";
import { calcular } from "@/lib/recursos/calculos";
import type { DefCampo, ResultadoGuardar, Valores } from "@/lib/recursos/tipos";
import { validarValores } from "@/lib/recursos/validar";
import { CampoRelacion } from "./campo-relacion";
import styles from "./formulario.module.css";

export type FormularioProps = {
  campos: readonly DefCampo[];
  /** Valores del registro a editar; vacío para crear. */
  valoresIniciales?: Valores;
  onGuardar: (valores: Valores) => Promise<ResultadoGuardar>;
  /** Si existe, muestra «Guardar y seguir» (limpia el formulario tras guardar). */
  onGuardarYSeguir?: (valores: Valores) => Promise<ResultadoGuardar>;
  onCancelar?: () => void;
  onEliminar?: () => Promise<{ ok: true } | { ok: false; error: string }>;
  /** Notifica cada cambio (p. ej. para vista previa en vivo). */
  onCambio?: (valores: Valores) => void;
  textoGuardar?: string;
  soloLectura?: boolean;
  /** Editando un registro existente: bloquea los campos `soloAlCrear`. */
  edicion?: boolean;
  /** Clases extra para el contenedor. */
  className?: string;
  /** Contenido extra entre los campos y los botones (p. ej. avisos). */
  pie?: ReactNode;
};

function valoresPorDefecto(campos: readonly DefCampo[], iniciales?: Valores): Valores {
  const v: Valores = {};
  for (const c of campos) {
    const inicial = iniciales?.[c.nombre];
    v[c.nombre] = inicial !== undefined && inicial !== null ? inicial : (c.porDefecto ?? (c.tipo === "booleano" ? false : ""));
  }
  return v;
}

/** Campos que dependen (directa o indirectamente) de `nombre`. */
function dependientes(campos: readonly DefCampo[], nombre: string): string[] {
  const directos = campos.filter((c) => c.relacion?.dependeDe?.campo === nombre).map((c) => c.nombre);
  return directos.flatMap((d) => [d, ...dependientes(campos, d)]);
}

export function Formulario({
  campos,
  valoresIniciales,
  onGuardar,
  onGuardarYSeguir,
  onCancelar,
  onEliminar,
  onCambio,
  textoGuardar = "Guardar",
  soloLectura = false,
  edicion = false,
  className,
  pie,
}: FormularioProps) {
  const prefijo = useId();
  const [valores, setValores] = useState<Valores>(() => valoresPorDefecto(campos, valoresIniciales));
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);
  const [guardando, iniciar] = useTransition();

  function cambiar(nombre: string, valor: unknown) {
    const siguiente = { ...valores, [nombre]: valor };
    for (const d of dependientes(campos, nombre)) siguiente[d] = "";
    setValores(siguiente);
    if (errores[nombre]) {
      setErrores((e) => {
        const resto = { ...e };
        delete resto[nombre];
        return resto;
      });
    }
    setErrorGeneral(null);
    onCambio?.(siguiente);
  }

  function enviar(accion: (v: Valores) => Promise<ResultadoGuardar>, limpiar: boolean) {
    const validacion = validarValores(campos, valores, { edicion });
    if (!validacion.ok) {
      setErrores(validacion.errores);
      setErrorGeneral("Revisá los campos marcados.");
      document.getElementById(`${prefijo}-${Object.keys(validacion.errores)[0]}`)?.focus();
      return;
    }
    iniciar(async () => {
      const r = await accion(valores).catch(
        (): ResultadoGuardar => ({ ok: false, error: "Sin conexión con el servidor." }),
      );
      if (!r.ok) {
        setErrores(r.errores ?? {});
        setErrorGeneral(r.error);
        return;
      }
      if (limpiar) {
        // Conserva los campos de contexto (p. ej. marca y modelo) para cargar en serie.
        const conservar = new Set(campos.filter((c) => dependientes(campos, c.nombre).length).map((c) => c.nombre));
        const base = valoresPorDefecto(campos);
        for (const c of campos) if (conservar.has(c.nombre)) base[c.nombre] = valores[c.nombre];
        setValores(base);
        setErrores({});
        setErrorGeneral(null);
        const primero = campos.find((c) => !conservar.has(c.nombre));
        if (primero) document.getElementById(`${prefijo}-${primero.nombre}`)?.focus();
      }
    });
  }

  function alEnviar(e: FormEvent) {
    e.preventDefault();
    if (!soloLectura) enviar(onGuardar, false);
  }

  function alTeclear(e: KeyboardEvent<HTMLFormElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !soloLectura) {
      e.preventDefault();
      enviar(onGuardar, false);
    } else if (e.key === "Escape" && onCancelar) {
      e.preventDefault();
      onCancelar();
    }
  }

  function eliminar() {
    if (!onEliminar) return;
    iniciar(async () => {
      const r = await onEliminar();
      if (!r.ok) {
        setErrorGeneral(r.error);
        setConfirmarEliminar(false);
      }
    });
  }

  return (
    <form className={`${styles.formulario} ${className ?? ""}`} onSubmit={alEnviar} onKeyDown={alTeclear} noValidate>
      <fieldset className={styles.campos} disabled={soloLectura || guardando}>
        {campos.map((campo, i) => {
          const id = `${prefijo}-${campo.nombre}`;
          const error = errores[campo.nombre];
          const padre = campo.relacion?.dependeDe
            ? campos.find((c) => c.nombre === campo.relacion!.dependeDe!.campo)
            : undefined;
          return (
            <Fragment key={campo.nombre}>
            {campo.seccion && (
              <p className={styles.seccion} style={{ animationDelay: `${40 + i * 35}ms` }}>
                {campo.seccion}
              </p>
            )}
            <div
              className={styles.campo}
              data-ancho={campo.ancho}
              data-tipo={campo.tipo}
              style={{ animationDelay: `${60 + i * 35}ms` }}
            >
              <label htmlFor={id} className={styles.etiqueta}>
                {campo.etiqueta}
                {campo.requerido && <span className={styles.requerido} aria-label="obligatorio">•</span>}
              </label>
              <Control
                id={id}
                campo={campo}
                bloqueado={edicion && campo.soloAlCrear}
                valor={campo.tipo === "calculado" && campo.calculo ? calcular(campo.calculo, valores) : valores[campo.nombre]}
                valorPadre={padre ? valores[padre.nombre] : undefined}
                etiquetaPadre={padre?.etiqueta}
                invalido={Boolean(error)}
                describedBy={error || campo.ayuda ? `${id}-ayuda` : undefined}
                onCambiar={(v) => cambiar(campo.nombre, v)}
              />
              {(error || campo.ayuda) && (
                <p id={`${id}-ayuda`} className={error ? styles.error : styles.ayuda}>
                  {error ?? campo.ayuda}
                </p>
              )}
            </div>
            </Fragment>
          );
        })}
      </fieldset>

      {pie}

      {errorGeneral && (
        <p className={styles.errorGeneral} role="alert">
          {errorGeneral}
        </p>
      )}

      {!soloLectura && (
        <div className={styles.acciones}>
          {onEliminar &&
            (confirmarEliminar ? (
              <span className={styles.confirmar}>
                ¿Eliminar definitivamente?
                <button type="button" className={`${ui.boton} ${ui.peligro}`} onClick={eliminar} disabled={guardando}>
                  Sí, eliminar
                </button>
                <button type="button" className={`${ui.boton} ${ui.fantasma}`} onClick={() => setConfirmarEliminar(false)}>
                  No
                </button>
              </span>
            ) : (
              <button
                type="button"
                className={`${ui.boton} ${ui.fantasma} ${ui.peligro}`}
                onClick={() => setConfirmarEliminar(true)}
              >
                <IconoPapelera tamano={14} /> Eliminar
              </button>
            ))}
          <span className={styles.espacio} />
          {onCancelar && (
            <button type="button" className={`${ui.boton} ${ui.fantasma}`} onClick={onCancelar}>
              Cancelar
            </button>
          )}
          {onGuardarYSeguir && (
            <button
              type="button"
              className={ui.boton}
              disabled={guardando}
              onClick={() => enviar(onGuardarYSeguir, true)}
            >
              Guardar y seguir
            </button>
          )}
          <button type="submit" className={`${ui.boton} ${ui.primario}`} disabled={guardando}>
            {guardando ? "Guardando…" : textoGuardar}
            <kbd className={styles.atajo}>Ctrl ↵</kbd>
          </button>
        </div>
      )}
    </form>
  );
}

function Control({
  id,
  campo,
  bloqueado,
  valor,
  valorPadre,
  etiquetaPadre,
  invalido,
  describedBy,
  onCambiar,
}: {
  id: string;
  campo: DefCampo;
  bloqueado?: boolean;
  valor: unknown;
  valorPadre?: unknown;
  etiquetaPadre?: string;
  invalido: boolean;
  describedBy?: string;
  onCambiar: (v: unknown) => void;
}) {
  const comunes = {
    id,
    disabled: bloqueado || undefined,
    "aria-invalid": invalido || undefined,
    "aria-describedby": describedBy,
    "aria-required": campo.requerido || undefined,
  };
  const texto = valor === null || valor === undefined ? "" : String(valor);

  switch (campo.tipo) {
    case "calculado": {
      const n = typeof valor === "number" ? valor : null;
      return (
        <output id={id} className={styles.calculado} data-signo={n === null ? undefined : n < 0 ? "negativo" : "positivo"}>
          {n === null ? "—" : campo.formato === "porcentaje" ? pct(n) : moneda(n)}
        </output>
      );
    }

    case "fecha":
      return (
        <input
          {...comunes}
          className={`${ui.campo} ${ui.campoMono}`}
          type="date"
          value={texto.slice(0, 10)}
          onChange={(e) => onCambiar(e.target.value)}
        />
      );

    case "relacion":
      return (
        <CampoRelacion
          id={id}
          fuente={campo.relacion!}
          valor={valor}
          valorPadre={valorPadre}
          etiquetaPadre={etiquetaPadre}
          invalido={invalido}
          onCambiar={onCambiar}
        />
      );

    case "opciones":
      if (campo.presentacion === "tarjetas" || campo.presentacion === "segmentos") {
        const segmentos = campo.presentacion === "segmentos";
        return (
          <div
            role="radiogroup"
            aria-label={campo.etiqueta}
            aria-describedby={describedBy}
            className={segmentos ? styles.segmentos : styles.tarjetas}
          >
            {campo.opciones?.map((o) => (
              <label
                key={String(o.valor)}
                className={segmentos ? styles.segmento : styles.tarjeta}
                data-activa={String(o.valor) === texto || undefined}
              >
                <input
                  type="radio"
                  name={id}
                  id={String(o.valor) === texto ? id : undefined}
                  value={String(o.valor)}
                  checked={String(o.valor) === texto}
                  onChange={() => onCambiar(o.valor)}
                />
                {o.muestra && (
                  <span
                    className={styles.muestra}
                    style={{ background: `linear-gradient(135deg, ${o.muestra[0]} 50%, ${o.muestra[1]} 50%)` }}
                    aria-hidden="true"
                  />
                )}
                <span className={styles.tarjetaTexto}>
                  {!o.muestra && !segmentos && <span className={styles.tarjetaCodigo}>{o.valor}</span>}
                  {o.etiqueta}
                </span>
              </label>
            ))}
          </div>
        );
      }
      return (
        <select {...comunes} className={ui.campo} value={texto} onChange={(e) => onCambiar(e.target.value)}>
          <option value="">Elegí una opción…</option>
          {campo.opciones?.map((o) => (
            <option key={String(o.valor)} value={String(o.valor)}>
              {o.etiqueta}
            </option>
          ))}
        </select>
      );

    case "booleano":
      return (
        <label className={styles.interruptor}>
          <input
            {...comunes}
            type="checkbox"
            className={ui.casilla}
            checked={valor === true}
            onChange={(e) => onCambiar(e.target.checked)}
          />
          {valor === true ? "Sí" : "No"}
        </label>
      );

    case "textoLargo":
      return (
        <textarea
          {...comunes}
          className={ui.campo}
          rows={3}
          maxLength={campo.maxLargo}
          placeholder={campo.placeholder}
          value={texto}
          onChange={(e) => onCambiar(e.target.value)}
        />
      );

    case "entero":
    case "decimal":
      return (
        <div className={styles.conSufijo} data-prefijo={campo.prefijo ? "" : undefined}>
          {campo.prefijo && <span className={styles.prefijo}>{campo.prefijo}</span>}
          <input
            {...comunes}
            className={`${ui.campo} ${ui.campoMono}`}
            type="number"
            inputMode={campo.tipo === "entero" ? "numeric" : "decimal"}
            step={campo.tipo === "entero" ? 1 : "any"}
            min={campo.min}
            max={campo.max}
            placeholder={campo.placeholder}
            value={texto}
            onChange={(e) => onCambiar(e.target.value)}
          />
          {campo.sufijo && <span className={styles.sufijo}>{campo.sufijo}</span>}
        </div>
      );

    default:
      return (
        <input
          {...comunes}
          className={ui.campo}
          type="text"
          maxLength={campo.maxLargo}
          placeholder={campo.placeholder}
          value={texto}
          style={campo.mayusculas ? { textTransform: "uppercase" } : undefined}
          onChange={(e) => onCambiar(e.target.value)}
        />
      );
  }
}
