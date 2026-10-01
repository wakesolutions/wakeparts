"use client";

import { useState } from "react";
import { guardarContacto } from "@/app/acciones/seguimiento";
import { useSesion } from "@/app/inicio/_components/sesion-contexto";
import { MantenimientoRecurso } from "@/components/mantenimiento/mantenimiento-recurso";
import ui from "@/components/ui/controles.module.css";
import { useVentanaActual } from "@/components/ventanas/ventana";
import { VentanaFlotante } from "@/components/ventanas/ventana-flotante";
import { fechaDia } from "@/lib/formato";
import { ETAPAS } from "@/lib/recursos/plataforma";
import { enlaceWhatsapp } from "@/lib/sitio-web";
import styles from "./seguimiento.module.css";

type Taller = {
  id_empresa: string;
  empresa: string;
  registrada_en: string;
  dueno: string | null;
  correo: string | null;
  telefono: string | null;
  telefono_empresa: string | null;
  productos: number;
  cotizaciones: number;
  facturas: number;
  dias_sin_entrar: number | null;
  sitio_publicado: boolean;
  pedidos_web: number;
  etapa: "sin_productos" | "sin_cotizar" | "cotizando" | "facturando";
  contactado_en: string | null;
  nota: string | null;
};

/** Mensaje sugerido según dónde se quedó cada taller (se edita antes de mandarlo). */
function mensaje(t: Taller, yo: string) {
  const nombre = t.dueno?.split(" ")[0] ?? "";
  const hola = `Hola${nombre ? ` ${nombre}` : ""}, te saluda ${yo} de Wake Parts.`;
  switch (t.etapa) {
    case "sin_productos":
      return `${hola} Vi que registraste ${t.empresa}. ¿Te ayudo a cargar tus productos? Si los tenés en Excel, mandámelo y te los dejo listos hoy mismo.`;
    case "sin_cotizar":
      return `${hola} Ya tenés tus productos en ${t.empresa}. ¿Querés que hagamos juntos tu primera cotización? Son cinco minutos por videollamada o aquí mismo.`;
    case "cotizando":
      return `${hola} Vi que ya estás cotizando en ${t.empresa}. ¿Te ayudo a registrar tu CAI para que también factures desde el sistema?`;
    default:
      return `${hola} ¿Cómo te ha ido con ${t.empresa}? Si querés, publicamos tu catálogo web para que tus clientes te manden pedidos.`;
  }
}

/** Módulo Seguimiento: talleres registrados y qué tanto lo usan (admin de plataforma). */
export function Seguimiento() {
  const [abierto, setAbierto] = useState<Taller | null>(null);
  const [version, setVersion] = useState(0);
  const madre = useVentanaActual() ?? undefined;
  return (
    <>
      <MantenimientoRecurso
        recurso="seguimiento"
        puedeEditar={false}
        version={version}
        onAbrir={(f) => setAbierto(f as unknown as Taller)}
      />
      {abierto && (
        <VentanaFlotante
          id="seguimiento-taller"
          titulo={abierto.empresa}
          padre={madre}
          tamano={{ w: 640, h: 660 }}
          foco={abierto.id_empresa}
          onCerrar={() => setAbierto(null)}
        >
          <Detalle key={abierto.id_empresa} taller={abierto} onGuardado={() => setVersion((v) => v + 1)} />
        </VentanaFlotante>
      )}
    </>
  );
}

function Detalle({ taller: t, onGuardado }: { taller: Taller; onGuardado: () => void }) {
  const { usuario } = useSesion();
  const [texto, setTexto] = useState(() => mensaje(t, usuario.nombre.split(" ")[0]));
  const [nota, setNota] = useState(t.nota ?? "");
  const [contactado, setContactado] = useState(t.contactado_en);
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const telefono = (t.telefono ?? t.telefono_empresa ?? "").replace(/\D/g, "");
  const wa = telefono ? enlaceWhatsapp(telefono, texto) : null;
  const correo = t.correo
    ? `mailto:${t.correo}?subject=${encodeURIComponent(`Wake Parts · ${t.empresa}`)}&body=${encodeURIComponent(texto)}`
    : null;

  async function guardar(marcar: boolean) {
    setGuardando(true);
    const r = await guardarContacto(t.id_empresa, { contactado: marcar, nota }).catch(() => ({
      ok: false as const,
      error: "Sin conexión.",
    }));
    setGuardando(false);
    if (!r.ok) return setAviso(r.error);
    if (marcar) setContactado(r.contactadoEn);
    setAviso(marcar ? "Marcado como contactado hoy." : "Nota guardada.");
    onGuardado();
  }

  const datos: [string, string | number][] = [
    ["Registro", fechaDia(t.registrada_en)],
    ["Etapa", ETAPAS.find((e) => e.valor === t.etapa)?.etiqueta ?? t.etapa],
    ["Productos", t.productos],
    ["Cotizaciones · facturas", `${t.cotizaciones} · ${t.facturas}`],
    ["Último acceso", t.dias_sin_entrar === null ? "Nunca entró" : t.dias_sin_entrar === 0 ? "Hoy" : `Hace ${t.dias_sin_entrar} días`],
    ["Sitio web", t.sitio_publicado ? `Publicado · ${t.pedidos_web} pedidos` : "Sin publicar"],
  ];

  return (
    <div className={styles.detalle}>
      <div>
        <p className={styles.dueno}>{t.dueno ?? "Sin dueño"}</p>
        <p className={styles.contacto}>
          {[t.telefono ?? t.telefono_empresa, t.correo].filter(Boolean).join(" · ") || "Sin teléfono ni correo"}
        </p>
      </div>

      <dl className={styles.datos}>
        {datos.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>

      <label className={styles.campo}>
        <span>Mensaje (editalo antes de mandarlo)</span>
        <textarea className={ui.campo} rows={5} value={texto} onChange={(e) => setTexto(e.target.value)} />
      </label>

      <div className={styles.fila}>
        {wa ? (
          <a href={wa} target="_blank" rel="noopener noreferrer" className={`${ui.boton} ${ui.primario}`}>
            Abrir WhatsApp
          </a>
        ) : (
          <span className={styles.nota}>Sin teléfono: pedile que lo agregue en Mi usuario.</span>
        )}
        {correo && (
          <a href={correo} className={ui.boton}>
            Escribir correo
          </a>
        )}
      </div>

      <label className={styles.campo}>
        <span>Nota interna {contactado && `· contactado el ${fechaDia(contactado)}`}</span>
        <textarea
          className={ui.campo}
          rows={3}
          maxLength={1000}
          value={nota}
          placeholder="Qué le dijiste, qué respondió, cuándo volver a escribir…"
          onChange={(e) => setNota(e.target.value)}
        />
      </label>

      <div className={styles.fila}>
        <button type="button" className={`${ui.boton} ${ui.primario}`} disabled={guardando} onClick={() => guardar(true)}>
          Marcar contactado hoy
        </button>
        <button type="button" className={`${ui.boton} ${ui.fantasma}`} disabled={guardando} onClick={() => guardar(false)}>
          Solo guardar nota
        </button>
        {aviso && (
          <span className={styles.nota} role="status">
            {aviso}
          </span>
        )}
      </div>
    </div>
  );
}
