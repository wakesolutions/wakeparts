"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useApi } from "@/components/datos/apis";
import { Formulario } from "@/components/formulario/formulario";
import ui from "@/components/ui/controles.module.css";
import { IconoCandado } from "@/components/ui/iconos";
import { DocumentoVista } from "@/components/ventas/documento-vista";
import {
  FORMATO_POR_DEFECTO,
  LARGO_LEMA,
  LARGO_MENSAJE,
  normalizarFormato,
  type FormatoDocumento,
} from "@/lib/identidad";
import type { DefCampo } from "@/lib/recursos/tipos";
import type { Documento, TipoDocumento } from "@/lib/ventas";
import { useIdentidad } from "./contexto";
import { documentoEjemplo } from "./documento-ejemplo";
import styles from "./identidad.module.css";

const ANCHO_HOJA = 820;

/** Lo que el SAR pide en la factura: no se puede ocultar (docs/negocio.md §3.5). */
const FIJOS = [
  "Nombre, razón social, RTN y datos del emisor",
  "CAI, rango autorizado y fecha límite",
  "Número y fecha del documento",
  "Cliente y su RTN (o consumidor final)",
  "Detalle con precio, descuento y total por línea",
  "Importes exento, exonerado y gravado, ISV y total",
  "Total en letras y leyendas del SAR",
];

function campos(hayLogo: boolean): readonly DefCampo[] {
  return [
    {
      nombre: "estilo",
      etiqueta: "Estilo",
      tipo: "opciones",
      presentacion: "segmentos",
      opciones: [
        { valor: "moderno", etiqueta: "Moderno" },
        { valor: "clasico", etiqueta: "Clásico" },
        { valor: "compacto", etiqueta: "Compacto" },
      ],
      ancho: "completo",
      seccion: "Diseño",
    },
    {
      nombre: "color",
      etiqueta: "Color",
      tipo: "opciones",
      presentacion: "segmentos",
      opciones: [
        { valor: "marca", etiqueta: "De tu marca" },
        { valor: "tinta", etiqueta: "Solo negro" },
      ],
      ayuda: "«Solo negro» si imprimís en blanco y negro.",
      ancho: "completo",
    },
    {
      nombre: "logo",
      etiqueta: "Logo",
      tipo: "opciones",
      presentacion: "segmentos",
      opciones: [
        { valor: "izquierda", etiqueta: "Izquierda" },
        { valor: "centro", etiqueta: "Centrado" },
        { valor: "oculto", etiqueta: "Sin logo" },
      ],
      ayuda: hayLogo ? undefined : "Todavía no subiste un logo: hacelo en la pestaña Apariencia.",
      ancho: "completo",
    },
    {
      nombre: "logoTamano",
      etiqueta: "Tamaño del logo",
      tipo: "opciones",
      presentacion: "segmentos",
      opciones: [
        { valor: "chico", etiqueta: "Chico" },
        { valor: "mediano", etiqueta: "Mediano" },
        { valor: "grande", etiqueta: "Grande" },
      ],
      ancho: "completo",
    },
    {
      nombre: "tabla",
      etiqueta: "Detalle",
      tipo: "opciones",
      presentacion: "segmentos",
      opciones: [
        { valor: "lineas", etiqueta: "Líneas" },
        { valor: "rayas", etiqueta: "Rayas" },
        { valor: "cuadricula", etiqueta: "Cuadrícula" },
      ],
      ancho: "completo",
    },
    {
      nombre: "lema",
      etiqueta: "Lema bajo el nombre",
      tipo: "texto",
      maxLargo: LARGO_LEMA,
      placeholder: "Repuestos japoneses desde 1998",
      ancho: "completo",
      seccion: "Textos",
    },
    {
      nombre: "mensaje",
      etiqueta: "Mensaje al pie",
      tipo: "textoLargo",
      maxLargo: LARGO_MENSAJE,
      placeholder: "Gracias por su compra. Garantía de 30 días en piezas eléctricas con esta factura.",
      ancho: "completo",
    },
    {
      nombre: "mostrarVehiculo",
      etiqueta: "Vehículo del cliente",
      tipo: "booleano",
      ancho: "completo",
      seccion: "Qué mostrar",
    },
    { nombre: "mostrarCodigo", etiqueta: "Código de cada producto", tipo: "booleano", ancho: "completo" },
    { nombre: "mostrarVendedor", etiqueta: "Quién atendió", tipo: "booleano", ancho: "completo" },
  ];
}

/**
 * Taller › Factura: editor visual del formato de facturas y cotizaciones. A la
 * izquierda las opciones (Formulario genérico), a la derecha la hoja real
 * (DocumentoVista) con datos de ejemplo, que cambia con cada toque.
 */
export function EditorFormato({ emisor, vendedor }: { emisor: Documento["emisor"]; vendedor: string }) {
  const api = useApi("identidad");
  const { identidad, guardada, confirmar } = useIdentidad();
  const [formato, setFormato] = useState<FormatoDocumento>(guardada.formato);
  const [version, setVersion] = useState(0);
  const [tipo, setTipo] = useState<TipoDocumento>("factura");
  const [aviso, setAviso] = useState<string | null>(null);

  const doc = useMemo(() => documentoEjemplo(tipo, emisor, vendedor), [tipo, emisor, vendedor]);
  const camposEditor = useMemo(() => campos(Boolean(identidad.logo)), [identidad.logo]);
  const sinCambios = JSON.stringify(formato) === JSON.stringify(guardada.formato);
  const esOriginal = JSON.stringify(formato) === JSON.stringify(FORMATO_POR_DEFECTO);

  function restablecer() {
    setFormato(FORMATO_POR_DEFECTO);
    setVersion((v) => v + 1);
    setAviso("Volviste al diseño original. Guardá para aplicarlo.");
  }

  return (
    <div className={styles.editor}>
      <div className={styles.controles}>
        <Formulario
          key={version}
          campos={camposEditor}
          valoresIniciales={formato}
          textoGuardar={sinCambios ? "Guardado" : "Guardar formato"}
          onCambio={(v) => {
            setFormato(normalizarFormato(v));
            setAviso(null);
          }}
          onGuardar={async (v) => {
            const nuevo = normalizarFormato(v);
            const r = await api.guardarFormato(nuevo);
            if (!r.ok) return r;
            confirmar({ formato: nuevo });
            setAviso("Listo: las próximas facturas y cotizaciones salen así.");
            return { ok: true, id: "formato" };
          }}
          pie={
            <div className={styles.fijos}>
              <p className={styles.fijosTitulo}>
                <IconoCandado tamano={14} /> Siempre se imprimen
              </p>
              <ul>
                {FIJOS.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          }
        />
        {!esOriginal && (
          <button type="button" className={`${ui.boton} ${ui.fantasma}`} onClick={restablecer}>
            Restablecer el diseño original
          </button>
        )}
        {aviso && (
          <p className={styles.mensaje} role="status">
            {aviso}
          </p>
        )}
      </div>

      <div className={styles.vistaPrevia}>
        <div className={styles.vistaBarra}>
          <span className={styles.vistaEtiqueta}>Vista previa · datos de ejemplo</span>
          <div className={styles.segmentosVista} role="group" aria-label="Documento de ejemplo">
            <button type="button" aria-pressed={tipo === "factura"} onClick={() => setTipo("factura")}>
              Factura
            </button>
            <button type="button" aria-pressed={tipo === "cotizacion"} onClick={() => setTipo("cotizacion")}>
              Cotización
            </button>
          </div>
        </div>
        <HojaEscalada>
          <DocumentoVista doc={doc} identidad={{ logo: identidad.logo, acento: identidad.acento, formato }} />
        </HojaEscalada>
      </div>
    </div>
  );
}

/** Muestra la hoja a tamaño real (820 px) reducida para que entre en el panel. */
function HojaEscalada({ children }: { children: React.ReactNode }) {
  const mesa = useRef<HTMLDivElement>(null);
  const hoja = useRef<HTMLDivElement>(null);
  const [medidas, setMedidas] = useState({ escala: 1, alto: 0 });

  useLayoutEffect(() => {
    const m = mesa.current;
    const h = hoja.current;
    if (!m || !h) return;
    const medir = () => {
      const estilo = getComputedStyle(m);
      const disponible = m.clientWidth - parseFloat(estilo.paddingLeft) - parseFloat(estilo.paddingRight);
      const escala = Math.min(1, disponible / ANCHO_HOJA);
      setMedidas({ escala, alto: h.offsetHeight * escala });
    };
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(m);
    obs.observe(h);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={mesa} className={styles.mesa}>
      <div style={{ height: medidas.alto || undefined }}>
        <div ref={hoja} className={styles.escala} style={{ transform: `scale(${medidas.escala})`, width: ANCHO_HOJA }}>
          {children}
        </div>
      </div>
    </div>
  );
}
