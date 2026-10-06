"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { useApi } from "@/components/datos/apis";
import { MantenimientoRecurso } from "@/components/mantenimiento/mantenimiento-recurso";
import { useVentanaActual } from "@/components/ventanas/ventana";
import { VentanaFlotante } from "@/components/ventanas/ventana-flotante";
import { Odometro } from "@/components/ventas/odometro";
import { BANDAS, resumirCartera, type ResumenCartera } from "@/lib/cobros";
import { moneda } from "@/lib/formato";
import { EstadoCuenta } from "./estado-cuenta";
import styles from "./cobros.module.css";

/**
 * Ventas › Cuentas por cobrar: tablero de la cartera (total, vencido y
 * antigüedad de saldos) sobre la tabla de clientes con crédito. Abrir un
 * cliente muestra su estado de cuenta, donde se registran los abonos.
 */
export function CuentasPorCobrar() {
  const api = useApi("cobros");
  const madre = useVentanaActual() ?? undefined;
  const [resumen, setResumen] = useState<ResumenCartera | null>(null);
  const [version, setVersion] = useState(0);
  const [abierto, setAbierto] = useState<{ id: number; nombre: string } | null>(null);

  const cargar = useCallback(() => {
    let vivo = true;
    api
      .cartera()
      .then((f) => vivo && setResumen(resumirCartera(f)))
      .catch(() => vivo && setResumen(resumirCartera([])));
    return () => {
      vivo = false;
    };
  }, [api]);

  useEffect(() => cargar(), [cargar, version]);

  return (
    <div className={styles.cartera}>
      <Tablero resumen={resumen} />
      <div className={styles.tabla}>
        <MantenimientoRecurso
          recurso="cuentas_clientes"
          puedeEditar={false}
          version={version}
          onAbrir={(f) => setAbierto({ id: Number(f.id), nombre: String(f.nombre) })}
        />
      </div>
      {abierto && (
        <VentanaFlotante
          id="estado-cuenta"
          titulo={`Estado de cuenta · ${abierto.nombre}`}
          padre={madre}
          tamano={{ w: 980, h: 760 }}
          foco={abierto.id}
          onCerrar={() => setAbierto(null)}
        >
          <EstadoCuenta key={abierto.id} idCliente={abierto.id} onCambio={() => setVersion((v) => v + 1)} />
        </VentanaFlotante>
      )}
    </div>
  );
}

/** Textos del tablero: lo mismo sirve para lo que te deben y para lo que debés. */
export type TextosTablero = {
  total: string;
  vacio: string;
  documento: [string, string];
  persona: [string, string];
  semana: string;
};

const TEXTOS_COBRAR: TextosTablero = {
  total: "Por cobrar",
  vacio: "Nadie te debe.",
  documento: ["factura", "facturas"],
  persona: ["cliente", "clientes"],
  semana: "Para llamar esta semana",
};

/** Momento firma: la antigüedad de saldos como una banda de tablero, de verde (al día) a rojo (+90 días). */
export function Tablero({ resumen, textos = TEXTOS_COBRAR }: { resumen: ResumenCartera | null; textos?: TextosTablero }) {
  if (!resumen) return <div className={styles.tableroCargando} aria-label="Cargando cartera" />;
  const { total, vencido, por_vencer, clientes, facturas, bandas } = resumen;
  const vacio = total <= 0;
  return (
    <section className={styles.tablero} aria-label="Resumen de la cartera">
      <div className={styles.lcd}>
        <span className={styles.etiqueta}>{textos.total}</span>
        <Odometro valor={total} etiqueta={`Total ${textos.total.toLowerCase()}`} />
        <p className={styles.lcdPie}>
          {vacio
            ? textos.vacio
            : `${facturas} ${textos.documento[facturas === 1 ? 0 : 1]} · ${clientes} ${textos.persona[clientes === 1 ? 0 : 1]}`}
        </p>
      </div>
      <div className={styles.indicadores}>
        <div data-tono={vencido > 0 ? "mal" : undefined}>
          <span className={styles.etiqueta}>Vencido</span>
          <strong>{moneda(vencido)}</strong>
          <small>{total > 0 ? `${Math.round((vencido / total) * 100)} % del total` : "—"}</small>
        </div>
        <div data-tono={por_vencer > 0 ? "aviso" : undefined}>
          <span className={styles.etiqueta}>Vence en 7 días</span>
          <strong>{moneda(por_vencer)}</strong>
          <small>{textos.semana}</small>
        </div>
      </div>
      <div className={styles.antiguedad}>
        <span className={styles.etiqueta}>Antigüedad de saldos</span>
        <div className={styles.banda} data-vacia={vacio || undefined} role="img" aria-label={
          vacio ? "Sin saldos" : BANDAS.map((b) => `${b.etiqueta}: ${moneda(bandas[b.clave])}`).join(", ")
        }>
          {BANDAS.map((b) =>
            bandas[b.clave] > 0 ? (
              <span
                key={b.clave}
                className={styles.tramo}
                data-banda={b.clave}
                style={{ flexGrow: bandas[b.clave] } as CSSProperties}
                title={`${b.etiqueta}: ${moneda(bandas[b.clave])}`}
              />
            ) : null,
          )}
        </div>
        <ul className={styles.leyenda}>
          {BANDAS.map((b) => (
            <li key={b.clave} data-banda={b.clave} data-cero={bandas[b.clave] <= 0 || undefined}>
              <span className={styles.led} aria-hidden="true" />
              <span>{b.etiqueta}</span>
              <strong>{moneda(bandas[b.clave])}</strong>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
