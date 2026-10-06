"use client";

import { useEffect, useState } from "react";
import { useApi } from "@/components/datos/apis";
import { MantenimientoRecurso } from "@/components/mantenimiento/mantenimiento-recurso";
import ui from "@/components/ui/controles.module.css";
import { useVentanaActual } from "@/components/ventanas/ventana";
import { VentanaFlotante } from "@/components/ventanas/ventana-flotante";
import { hoyIso, sumarDiasIso } from "@/lib/compras";
import { ORIGENES, type Asiento, type DiaContable } from "@/lib/contabilidad";
import { fechaDia, moneda } from "@/lib/formato";
import { Nivel } from "./nivel";
import styles from "./contabilidad.module.css";

const DIA_LARGO = new Intl.DateTimeFormat("es-HN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/**
 * Contabilidad › Día: el libro diario de una fecha, con el nivel que dice si
 * cuadra. Cada asiento se ve como en el libro: el debe a la izquierda y el
 * haber sangrado.
 */
export function DiarioDia() {
  const api = useApi("contabilidad");
  const [fecha, setFecha] = useState(hoyIso);
  const [dia, setDia] = useState<DiaContable | null | undefined>(undefined);
  const [abierto, setAbierto] = useState<Asiento | null>(null);
  const [version, setVersion] = useState(0);
  const madre = useVentanaActual() ?? undefined;

  useEffect(() => {
    let vivo = true;
    api
      .diario(fecha)
      .then((d) => vivo && setDia(d))
      .catch(() => vivo && setDia(null));
    return () => {
      vivo = false;
    };
  }, [api, fecha, version]);

  const hoy = hoyIso();
  return (
    <div className={styles.dia}>
      <header className={styles.diaCabecera}>
        <div className={styles.calendario}>
          <button type="button" className={`${ui.boton} ${ui.fantasma} ${ui.icono}`} aria-label="Día anterior" onClick={() => setFecha((f) => sumarDiasIso(f, -1))}>
            ←
          </button>
          <label>
            <span className={styles.etiqueta}>Libro del día</span>
            <input
              type="date"
              className={`${ui.campo} ${ui.campoMono}`}
              value={fecha}
              max={hoy}
              onChange={(e) => e.target.value && setFecha(e.target.value)}
            />
          </label>
          <button
            type="button"
            className={`${ui.boton} ${ui.fantasma} ${ui.icono}`}
            aria-label="Día siguiente"
            disabled={fecha >= hoy}
            onClick={() => setFecha((f) => sumarDiasIso(f, 1))}
          >
            →
          </button>
          {fecha !== hoy && (
            <button type="button" className={`${ui.boton} ${ui.fantasma}`} onClick={() => setFecha(hoy)}>
              Hoy
            </button>
          )}
        </div>
        <p className={styles.fechaLarga}>
          {DIA_LARGO.format(new Date(`${fecha}T12:00:00Z`))}
          {dia?.cerrado && <span className={styles.cerrado}>Mes cerrado</span>}
        </p>
        {dia && <Nivel debe={dia.debe} haber={dia.haber} />}
      </header>

      {dia === undefined ? (
        <div className={styles.cargando} aria-label="Cargando" />
      ) : dia === null ? (
        <p className={styles.vacio}>No se pudo leer la contabilidad. ¿Falta ejecutar la migración 0022?</p>
      ) : dia.asientos.length === 0 ? (
        <p className={styles.vacio}>
          Sin asientos este día. Las ventas, compras, cobros, pagos y la caja se asientan solos; lo demás, en Nuevo asiento.
        </p>
      ) : (
        <ol className={styles.libro}>
          {dia.asientos.map((a, i) => (
            <li key={a.id} style={{ animationDelay: `${Math.min(i, 12) * 28}ms` }}>
              <button type="button" className={styles.asiento} data-revertido={a.revertido || undefined} onClick={() => setAbierto(a)}>
                <PartidaAsiento asiento={a} />
              </button>
            </li>
          ))}
        </ol>
      )}

      {abierto && (
        <VentanaFlotante
          id="asiento"
          titulo={`Asiento ${abierto.numero}`}
          padre={madre}
          tamano={{ w: 760, h: 600 }}
          foco={abierto.id}
          onCerrar={() => setAbierto(null)}
        >
          <AsientoVista
            key={abierto.id}
            id={abierto.id}
            onCambio={() => {
              setVersion((v) => v + 1);
              setAbierto(null);
            }}
          />
        </VentanaFlotante>
      )}
    </div>
  );
}

/** Un asiento como en el libro diario. */
export function PartidaAsiento({ asiento: a }: { asiento: Asiento }) {
  const total = a.lineas.reduce((s, l) => s + l.debe, 0);
  return (
    <>
      <span className={styles.asientoCabeza}>
        <span className={styles.asientoNumero}>{a.numero}</span>
        <span className={styles.asientoConcepto}>{a.concepto}</span>
        <span className={styles.origen} data-origen={a.origen}>
          {a.es_reversa ? "Reversa" : ORIGENES[a.origen]}
        </span>
      </span>
      <span className={styles.partidas}>
        {a.lineas.map((l) => (
          <span key={l.id} className={styles.partida} data-lado={l.debe > 0 ? "debe" : "haber"}>
            <span className={styles.partidaCuenta}>
              <b>{l.codigo}</b> {l.cuenta}
              {l.descripcion && <small> · {l.descripcion}</small>}
            </span>
            <span className={styles.monto}>{l.debe > 0 ? moneda(l.debe) : ""}</span>
            <span className={styles.monto}>{l.haber > 0 ? moneda(l.haber) : ""}</span>
          </span>
        ))}
      </span>
      <span className={styles.asientoPie}>
        <span>
          {a.referencia ?? ""}
          {a.revertido && " · revertido"}
        </span>
        <span className={styles.monto}>{moneda(total)}</span>
      </span>
    </>
  );
}

/** Un asiento abierto: su partida y, si es manual, la reversa. */
export function AsientoVista({ id, onCambio }: { id: string; onCambio?: () => void }) {
  const api = useApi("contabilidad");
  const [a, setA] = useState<Asiento | null | undefined>(undefined);
  const [revirtiendo, setRevirtiendo] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    api
      .asiento(id)
      .then((x) => vivo && setA(x))
      .catch(() => vivo && setA(null));
    return () => {
      vivo = false;
    };
  }, [api, id]);

  async function revertir() {
    const r = await api.revertir(id, motivo);
    if (!r.ok) return setAviso(r.error);
    onCambio?.();
  }

  if (a === undefined) return <div className={styles.cargando} aria-label="Cargando" />;
  if (a === null) return <p className={styles.vacio}>No se encontró el asiento.</p>;
  const manual = a.origen === "manual" || a.origen === "apertura_inventario";

  return (
    <div className={styles.vista}>
      <p className={styles.ayuda}>
        {fechaDia(a.fecha)} · {a.es_reversa ? "Reversa" : ORIGENES[a.origen]}
        {a.registro && ` · ${a.registro}`}
      </p>
      <div className={styles.asiento} data-estatico="">
        <PartidaAsiento asiento={a} />
      </div>
      {!manual && !a.es_reversa && (
        <p className={styles.ayuda}>Lo generó un documento: para corregirlo, anulá el documento y la reversa sale sola.</p>
      )}
      {manual && !a.es_reversa && !a.revertido && !revirtiendo && (
        <button type="button" className={`${ui.boton} ${ui.fantasma} ${ui.peligro}`} onClick={() => setRevirtiendo(true)}>
          Revertir asiento
        </button>
      )}
      {revirtiendo && (
        <form
          className={styles.revertir}
          onSubmit={(e) => {
            e.preventDefault();
            void revertir();
          }}
        >
          <input
            className={ui.campo}
            placeholder="Por qué se revierte"
            value={motivo}
            autoFocus
            aria-label="Motivo de la reversa"
            onChange={(e) => setMotivo(e.target.value)}
          />
          <button type="button" className={`${ui.boton} ${ui.fantasma}`} onClick={() => setRevirtiendo(false)}>
            Cancelar
          </button>
          <button type="submit" className={`${ui.boton} ${ui.peligro}`} disabled={!motivo.trim()}>
            Sí, revertir
          </button>
        </form>
      )}
      {aviso && <p className={styles.error}>{aviso}</p>}
    </div>
  );
}

/** Contabilidad › Asientos: todos, para buscar y filtrar. */
export function ListaAsientos() {
  const [abierto, setAbierto] = useState<{ id: string; numero: string } | null>(null);
  const [version, setVersion] = useState(0);
  const madre = useVentanaActual() ?? undefined;
  return (
    <>
      <MantenimientoRecurso
        recurso="asientos"
        puedeEditar={false}
        version={version}
        onAbrir={(f) => setAbierto({ id: String(f.id), numero: String(f.numero) })}
      />
      {abierto && (
        <VentanaFlotante
          id="asiento"
          titulo={`Asiento ${abierto.numero}`}
          padre={madre}
          tamano={{ w: 760, h: 600 }}
          foco={abierto.id}
          onCerrar={() => setAbierto(null)}
        >
          <AsientoVista
            key={abierto.id}
            id={abierto.id}
            onCambio={() => {
              setVersion((v) => v + 1);
              setAbierto(null);
            }}
          />
        </VentanaFlotante>
      )}
    </>
  );
}
