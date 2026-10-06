"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useApi } from "@/components/datos/apis";
import ui from "@/components/ui/controles.module.css";
import { IconoMas, IconoPapelera } from "@/components/ui/iconos";
import { hoyIso } from "@/lib/compras";
import { TIPOS_CUENTA, type CuentaBreve } from "@/lib/contabilidad";
import { centavos } from "@/lib/formato";
import { Nivel } from "./nivel";
import styles from "./contabilidad.module.css";

type Fila = { clave: number; cuenta: CuentaBreve | null; debe: string; haber: string; descripcion: string };

const num = (s: string) => {
  const n = Number(String(s).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const filaVacia = (clave: number): Fila => ({ clave, cuenta: null, debe: "", haber: "", descripcion: "" });

/**
 * Contabilidad › Nuevo asiento: gastos que no pasaron por compras, sueldos,
 * depreciación, aportes, ajustes. Solo se guarda si el nivel cuadra.
 */
export function NuevoAsiento({ onGuardado }: { onGuardado: (numero: number) => void }) {
  const api = useApi("contabilidad");
  const [cuentas, setCuentas] = useState<CuentaBreve[] | null>(null);
  const [fecha, setFecha] = useState(hoyIso);
  const [concepto, setConcepto] = useState("");
  const [filas, setFilas] = useState<Fila[]>([filaVacia(1), filaVacia(2)]);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    api
      .cuentas()
      .then((c) => vivo && setCuentas(c))
      .catch(() => vivo && setCuentas([]));
    return () => {
      vivo = false;
    };
  }, [api]);

  const debe = centavos(filas.reduce((s, f) => s + num(f.debe), 0));
  const haber = centavos(filas.reduce((s, f) => s + num(f.haber), 0));
  const usadas = filas.filter((f) => num(f.debe) > 0 || num(f.haber) > 0);
  const sinCuenta = usadas.some((f) => !f.cuenta);
  const puede = usadas.length >= 2 && !sinCuenta && debe > 0 && debe === haber && concepto.trim() && !ocupado;

  const cambiar = (clave: number, c: Partial<Fila>) => {
    setFilas((fs) => fs.map((f) => (f.clave === clave ? { ...f, ...c } : f)));
    setError(null);
  };

  /** Completa la última línea con la diferencia, del lado que falta. */
  function cuadrar() {
    const dif = centavos(debe - haber);
    if (dif === 0) return;
    const libre = [...filas].reverse().find((f) => !num(f.debe) && !num(f.haber));
    const destino = libre ?? filaVacia(Math.max(...filas.map((f) => f.clave)) + 1);
    const valor = { debe: dif < 0 ? String(-dif) : "", haber: dif > 0 ? String(dif) : "" };
    setFilas((fs) => (libre ? fs.map((f) => (f.clave === destino.clave ? { ...f, ...valor } : f)) : [...fs, { ...destino, ...valor }]));
  }

  async function guardar() {
    setOcupado(true);
    setError(null);
    const r = await api
      .crearAsiento({
        fecha,
        concepto,
        lineas: usadas.map((f) => ({ id_cuenta: f.cuenta!.id, debe: num(f.debe), haber: num(f.haber), descripcion: f.descripcion || null })),
      })
      .catch(() => ({ ok: false as const, error: "Sin conexión. Intentá de nuevo." }));
    setOcupado(false);
    if (!r.ok) return setError(r.error);
    setConcepto("");
    setFilas([filaVacia(1), filaVacia(2)]);
    onGuardado(r.numero);
  }

  return (
    <div className={styles.editor}>
      <header className={styles.editorCabecera}>
        <label className={styles.campo}>
          <span className={styles.etiqueta}>Fecha</span>
          <input type="date" className={`${ui.campo} ${ui.campoMono}`} value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)} />
        </label>
        <label className={styles.campo}>
          <span className={styles.etiqueta}>Concepto</span>
          <input
            className={ui.campo}
            placeholder="Pago de planilla de la primera quincena de octubre"
            value={concepto}
            maxLength={300}
            autoFocus
            onChange={(e) => setConcepto(e.target.value)}
          />
        </label>
      </header>

      <div className={styles.editorCuerpo}>
        <div className={styles.renglonTitulos} aria-hidden="true">
          <span>Cuenta</span>
          <span>Debe</span>
          <span>Haber</span>
          <span />
        </div>
        <ul className={styles.renglones}>
          {filas.map((f) => (
            <li key={f.clave}>
              <ElegirCuenta cuentas={cuentas} cuenta={f.cuenta} onElegir={(c) => cambiar(f.clave, { cuenta: c })} />
              <input
                className={`${ui.campo} ${ui.campoMono} ${styles.importe}`}
                inputMode="decimal"
                placeholder="0.00"
                value={f.debe}
                aria-label="Debe"
                onChange={(e) => cambiar(f.clave, { debe: e.target.value.replace(/[^\d.,]/g, ""), haber: e.target.value ? "" : f.haber })}
              />
              <input
                className={`${ui.campo} ${ui.campoMono} ${styles.importe}`}
                inputMode="decimal"
                placeholder="0.00"
                value={f.haber}
                aria-label="Haber"
                onChange={(e) => cambiar(f.clave, { haber: e.target.value.replace(/[^\d.,]/g, ""), debe: e.target.value ? "" : f.debe })}
              />
              <button
                type="button"
                className={`${ui.boton} ${ui.fantasma} ${ui.icono}`}
                aria-label="Quitar línea"
                disabled={filas.length <= 2}
                onClick={() => setFilas((fs) => fs.filter((x) => x.clave !== f.clave))}
              >
                <IconoPapelera tamano={13} />
              </button>
              <input
                className={`${ui.campo} ${styles.detalle}`}
                placeholder="Detalle (opcional)"
                value={f.descripcion}
                maxLength={200}
                aria-label="Detalle de la línea"
                onChange={(e) => cambiar(f.clave, { descripcion: e.target.value })}
              />
            </li>
          ))}
        </ul>
        <div className={styles.renglonAcciones}>
          <button
            type="button"
            className={styles.otraLinea}
            disabled={filas.length >= 60}
            onClick={() => setFilas((fs) => [...fs, filaVacia(Math.max(...fs.map((x) => x.clave)) + 1)])}
          >
            <IconoMas tamano={11} /> Otra línea
          </button>
          {debe !== haber && (debe > 0 || haber > 0) && (
            <button type="button" className={styles.otraLinea} onClick={cuadrar}>
              Cuadrar con la diferencia
            </button>
          )}
        </div>
      </div>

      <footer className={styles.editorPie}>
        <Nivel debe={debe} haber={haber} />
        {sinCuenta && <p className={styles.ayuda}>Elegí la cuenta de cada línea con monto.</p>}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <button type="button" className={`${ui.boton} ${ui.primario}`} disabled={!puede} onClick={guardar}>
          {ocupado ? "Guardando…" : "Guardar asiento"}
        </button>
      </footer>
    </div>
  );
}

/** Buscador de cuentas de detalle por código o nombre. */
export function ElegirCuenta({
  cuentas,
  cuenta,
  onElegir,
}: {
  cuentas: CuentaBreve[] | null;
  cuenta: CuentaBreve | null;
  onElegir: (c: CuentaBreve | null) => void;
}) {
  const [texto, setTexto] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [indice, setIndice] = useState(0);
  const campo = useRef<HTMLInputElement>(null);

  const lista = useMemo(() => {
    const t = texto.trim().toLowerCase();
    return (cuentas ?? []).filter((c) => !t || c.codigo.startsWith(t) || c.nombre.toLowerCase().includes(t)).slice(0, 12);
  }, [cuentas, texto]);

  if (cuenta && !abierto) {
    return (
      <button
        type="button"
        className={styles.cuentaElegida}
        onClick={() => {
          setAbierto(true);
          setTexto("");
          setTimeout(() => campo.current?.focus(), 0);
        }}
      >
        <b>{cuenta.codigo}</b> {cuenta.nombre}
      </button>
    );
  }

  return (
    <div className={styles.elegirCuenta}>
      <input
        ref={campo}
        className={ui.campo}
        placeholder={cuentas === null ? "Cargando cuentas…" : "Código o nombre de la cuenta"}
        value={texto}
        aria-label="Cuenta"
        onFocus={() => setAbierto(true)}
        onBlur={() => setTimeout(() => setAbierto(false), 120)}
        onChange={(e) => {
          setTexto(e.target.value);
          setIndice(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setIndice((i) => Math.min(i + 1, lista.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setIndice((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter" && lista[indice]) {
            e.preventDefault();
            onElegir(lista[indice]);
            setAbierto(false);
          }
        }}
      />
      {abierto && lista.length > 0 && (
        <ul className={styles.cuentasLista} role="listbox" aria-label="Cuentas">
          {lista.map((c, i) => (
            <li key={c.id}>
              <button
                type="button"
                role="option"
                aria-selected={i === indice}
                onMouseDown={(e) => e.preventDefault()}
                onPointerEnter={() => setIndice(i)}
                onClick={() => {
                  onElegir(c);
                  setAbierto(false);
                }}
              >
                <b>{c.codigo}</b>
                <span>{c.nombre}</span>
                <small>{TIPOS_CUENTA.find((t) => t.valor === c.tipo)?.etiqueta}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

