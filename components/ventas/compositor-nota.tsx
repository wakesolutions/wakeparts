"use client";

import { useEffect, useRef, useState } from "react";
import { useApi } from "@/components/datos/apis";
import ui from "@/components/ui/controles.module.css";
import { fechaYHora, moneda } from "@/lib/formato";
import { CODIGO_TIPO_DOCUMENTO, type Documento, type FacturaParaNota, type TipoNota } from "@/lib/ventas";
import { NotaEditor, saldoFactura } from "./nota-editor";
import styles from "./compositor-nota.module.css";

type Relacion = "factura" | "libre";

const TIPOS: readonly { tipo: TipoNota; nombre: string; signo: string; resumen: string }[] = [
  { tipo: "nota_credito", nombre: "Nota de crédito", signo: "−", resumen: "Le devolvés o le rebajás al cliente" },
  { tipo: "nota_debito", nombre: "Nota de débito", signo: "+", resumen: "Le cobrás algo más: flete, intereses, gastos" },
];

/**
 * Módulo Notas › Nueva nota: se elige el tipo (06 crédito · 07 débito) y si va
 * sobre una factura (buscador) o sin factura (0019); debajo, el NotaEditor.
 */
export function CompositorNota({ onEmitida }: { onEmitida: (id: string, numero: string) => void }) {
  const api = useApi("ventas");
  const [tipo, setTipo] = useState<TipoNota>("nota_credito");
  const [relacion, setRelacion] = useState<Relacion>("libre");
  const [factura, setFactura] = useState<Documento | null>(null);
  const [cargando, setCargando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  // Cambia al emitir o cancelar: el editor vuelve a empezar en limpio.
  const [vuelta, setVuelta] = useState(0);

  async function elegirFactura(f: FacturaParaNota) {
    setCargando(true);
    setAviso(null);
    const doc = await api.documento(f.id).catch(() => null);
    setCargando(false);
    if (!doc) return setAviso("No se pudo abrir la factura.");
    setFactura(doc);
  }

  function reiniciar() {
    setFactura(null);
    setVuelta((v) => v + 1);
  }

  const sinSaldo = tipo === "nota_credito" && factura != null && saldoFactura(factura) <= 0;

  return (
    <div className={styles.compositor} data-tipo={tipo}>
      <header className={styles.tablero}>
        <div className={styles.tipos} role="radiogroup" aria-label="Tipo de nota">
          {TIPOS.map((t) => (
            <button
              key={t.tipo}
              type="button"
              role="radio"
              aria-checked={tipo === t.tipo}
              aria-label={`${t.nombre} (${CODIGO_TIPO_DOCUMENTO[t.tipo]}): ${t.resumen.toLowerCase()}`}
              className={styles.tipo}
              data-tipo={t.tipo}
              onClick={() => {
                setTipo(t.tipo);
                setVuelta((v) => v + 1);
              }}
            >
              <span className={styles.codigo} aria-hidden="true">
                {CODIGO_TIPO_DOCUMENTO[t.tipo]}
                <span className={styles.signo}>{t.signo}</span>
              </span>
              <span className={styles.tipoTexto}>
                <strong>{t.nombre}</strong>
                <small>{t.resumen}</small>
              </span>
              <span className={styles.led} aria-hidden="true" />
            </button>
          ))}
        </div>

        <div className={styles.relacion} role="radiogroup" aria-label="Factura relacionada">
          <span className={styles.etiqueta}>Factura relacionada</span>
          <div className={styles.palanca}>
            <button
              type="button"
              role="radio"
              aria-checked={relacion === "libre"}
              onClick={() => {
                setRelacion("libre");
                reiniciar();
              }}
            >
              Sin factura
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={relacion === "factura"}
              onClick={() => {
                setRelacion("factura");
                reiniciar();
              }}
            >
              Sobre una factura
            </button>
          </div>
        </div>
      </header>

      <div className={styles.mesa}>
        {relacion === "libre" ? (
          <NotaEditor
            key={`libre-${tipo}-${vuelta}`}
            factura={null}
            tipo={tipo}
            onCancelar={reiniciar}
            onEmitida={(id, numero) => {
              reiniciar();
              onEmitida(id, numero);
            }}
          />
        ) : factura ? (
          <div className={styles.conFactura}>
            <div className={styles.elegida}>
              <button type="button" className={`${ui.boton} ${ui.fantasma}`} onClick={() => setFactura(null)}>
                ← Elegir otra factura
              </button>
            </div>
            {sinSaldo ? (
              <p className={styles.vacio}>
                A esta factura ya no le queda saldo: no admite más notas de crédito. Una nota de débito sí.
              </p>
            ) : (
              <NotaEditor
                key={`${factura.id}-${tipo}-${vuelta}`}
                factura={factura}
                tipo={tipo}
                onCancelar={() => setFactura(null)}
                onEmitida={(id, numero) => {
                  reiniciar();
                  onEmitida(id, numero);
                }}
              />
            )}
          </div>
        ) : (
          <BuscadorFacturas cargando={cargando} aviso={aviso} onElegir={elegirFactura} />
        )}
      </div>
    </div>
  );
}

function BuscadorFacturas({
  cargando,
  aviso,
  onElegir,
}: {
  cargando: boolean;
  aviso: string | null;
  onElegir: (f: FacturaParaNota) => void;
}) {
  const api = useApi("ventas");
  const [texto, setTexto] = useState("");
  const [facturas, setFacturas] = useState<FacturaParaNota[] | null>(null);
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    campo.current?.focus();
  }, []);

  useEffect(() => {
    let vivo = true;
    const t = setTimeout(() => {
      api
        .facturasParaNota(texto)
        .then((f) => vivo && setFacturas(f))
        .catch(() => vivo && setFacturas([]));
    }, 180);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [api, texto]);

  return (
    <div className={styles.buscador} aria-busy={cargando || undefined}>
      <input
        ref={campo}
        className={ui.campo}
        type="search"
        placeholder="Número de factura o cliente"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        aria-label="Buscar factura"
      />
      {aviso && <p className={styles.vacio}>{aviso}</p>}
      {facturas === null ? (
        <div className={styles.cargando} aria-label="Buscando facturas" />
      ) : facturas.length === 0 ? (
        <p className={styles.vacio}>
          {texto.trim() ? "Ninguna factura emitida coincide." : "Todavía no hay facturas emitidas."} Para un cargo o crédito
          suelto, usá «Sin factura».
        </p>
      ) : (
        <ul className={styles.facturas}>
          {facturas.map((f, i) => (
            <li key={f.id} style={{ animationDelay: `${i * 30}ms` }}>
              <button type="button" disabled={cargando} onClick={() => onElegir(f)}>
                <span className={styles.facturaNumero}>{f.numero}</span>
                <span className={styles.facturaCliente}>
                  {f.cliente_nombre}
                  <small>{fechaYHora(f.fecha)}</small>
                </span>
                <span className={styles.facturaSaldo}>
                  <small>Saldo</small>
                  {moneda(f.saldo)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
