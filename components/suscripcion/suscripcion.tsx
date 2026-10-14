"use client";

import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useSesion } from "@/app/inicio/_components/sesion-contexto";
import { useApi } from "@/components/datos/apis";
import ui from "@/components/ui/controles.module.css";
import { useVentanaActual } from "@/components/ventanas/ventana";
import { VentanaFlotante } from "@/components/ventanas/ventana-flotante";
import { LIMITES } from "@/lib/permisos";
import {
  diasHasta,
  ETIQUETA_ESTADO,
  formatoTarjeta,
  precioDe,
  soloDigitos,
  usd,
  validarPago,
  type Ciclo,
  type DatosSuscripcion,
  type PeticionPago,
  type PlanPublico,
  type ResultadoPago,
} from "@/lib/suscripcion";
import styles from "./suscripcion.module.css";

/**
 * Módulo Suscripción (0024): estado del plan, consumo contra los límites,
 * planes al mes o al año y pago con tarjeta (n1co). Solo el dueño paga o cancela.
 */

const fecha = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("es-HN", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso)) : "—";

export function Suscripcion() {
  const api = useApi("suscripcion");
  const sesion = useSesion();
  const [datos, setDatos] = useState<DatosSuscripcion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ciclo, setCiclo] = useState<Ciclo>("mensual");
  const [pagando, setPagando] = useState<PlanPublico | null>(null);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);

  const cargar = useCallback(async () => {
    const r = await api.leer().catch(() => ({ ok: false as const, error: "Sin conexión. Intentá de nuevo." }));
    if (r.ok) {
      setDatos(r.datos);
      setError(null);
    } else setError(r.error);
  }, [api]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- primera lectura al abrir la pestaña
    cargar();
  }, [cargar]);

  if (!datos) {
    return error ? <p className={styles.aviso}>{error}</p> : <div className={styles.cargando} aria-label="Cargando" />;
  }

  const s = datos.suscripcion;
  const pagables = datos.planes.filter((p) => (p.precio_mensual ?? 0) > 0 || (p.precio_anual ?? 0) > 0);
  const actual = datos.planes.find((p) => p.codigo === s?.plan_efectivo);

  return (
    <div className={styles.suscripcion}>
      {s && <Estado datos={datos} />}

      {datos.uso && actual && <Consumo datos={datos} plan={actual} />}

      {aviso && (
        <p className={aviso.ok ? styles.avisoOk : styles.aviso} role="status">
          {aviso.texto}
        </p>
      )}

      {!datos.puedeGestionar && (
        <p className={styles.aviso}>Solo el dueño del taller puede elegir, pagar o cancelar el plan.</p>
      )}
      {datos.puedeGestionar && !datos.cobrosActivos && (
        <p className={styles.aviso}>Los pagos con tarjeta todavía no están activos. Escribinos para cambiar de plan.</p>
      )}

      <section className={styles.seccion} aria-labelledby="planes-titulo">
        <div className={styles.seccionCabeza}>
          <h4 id="planes-titulo" className={styles.titulo}>
            Planes
          </h4>
          <div className={styles.ciclo} role="radiogroup" aria-label="Forma de pago">
            {(["mensual", "anual"] as const).map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={ciclo === c}
                className={styles.tecla}
                onClick={() => setCiclo(c)}
              >
                {c === "mensual" ? "Mensual" : "Anual"}
                {c === "anual" && <span className={styles.teclaNota}>2 meses gratis</span>}
              </button>
            ))}
          </div>
        </div>

        <ul className={styles.planes}>
          {pagables.map((p, i) => {
            const precio = precioDe(p, ciclo);
            const disponible = ciclo === "anual" ? p.anual_disponible : p.mensual_disponible;
            const esActual = s?.estado === "activa" && s.plan === p.codigo && s.ciclo === ciclo;
            return (
              <li
                key={p.codigo}
                className={styles.plan}
                data-actual={esActual || undefined}
                data-admin={p.solo_admins || undefined}
                style={{ animationDelay: `${120 + i * 70}ms` }}
              >
                {p.solo_admins && <span className={styles.sello}>Solo admins</span>}
                <p className={styles.planNombre}>{p.nombre}</p>
                <p className={styles.planEtiqueta}>{p.etiqueta}</p>
                <p className={styles.precio}>
                  {precio === null ? (
                    <span className={styles.precioNo}>Solo mensual</span>
                  ) : (
                    <>
                      <span className={styles.precioCifra}>{usd(precio)}</span>
                      <span className={styles.precioCiclo}>/{ciclo === "anual" ? "año" : "mes"}</span>
                    </>
                  )}
                </p>
                <ul className={styles.caracteristicas}>
                  {p.caracteristicas.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
                <Limites plan={p} />
                <button
                  type="button"
                  className={`${ui.boton} ${esActual ? "" : ui.primario} ${styles.elegir}`}
                  disabled={!datos.puedeGestionar || !datos.cobrosActivos || !disponible || esActual || precio === null}
                  onClick={() => {
                    setAviso(null);
                    setPagando(p);
                  }}
                >
                  {esActual ? "Tu plan" : !disponible ? "Próximamente" : `Elegir ${p.nombre}`}
                </button>
              </li>
            );
          })}
        </ul>
        <p className={styles.nota}>
          Precios en dólares, cobro recurrente con tarjeta. Cancelás cuando quieras y seguís con tu plan hasta el fin
          del periodo pagado; después el taller pasa al plan Gratis sin perder datos.
        </p>
      </section>

      {datos.eventos.length > 0 && <Historial datos={datos} />}

      {datos.puedeGestionar && s?.con_tarjeta && (s.estado === "activa" || s.estado === "vencida") && (
        <Cancelar
          hasta={s.periodo_fin}
          onListo={async (texto) => {
            setAviso({ ok: true, texto });
            await cargar();
          }}
          onSincronizado={async (texto, ok) => {
            setAviso({ ok, texto });
            await cargar();
          }}
        />
      )}

      {datos.modo === "sandbox" && sesion.usuario.esAdminPlataforma && (
        <p className={styles.nota}>n1co en modo sandbox: los cobros no son reales.</p>
      )}

      {pagando && (
        <Pago
          plan={pagando}
          ciclo={pagando.precio_anual === null ? "mensual" : ciclo}
          cambio={Boolean(s?.con_tarjeta && s.estado === "activa")}
          onCerrar={() => setPagando(null)}
          onPagado={async (texto) => {
            setPagando(null);
            setAviso({ ok: true, texto });
            await cargar();
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------- estado ---- */

function Estado({ datos }: { datos: DatosSuscripcion }) {
  const s = datos.suscripcion!;
  const dias = s.estado === "prueba" ? diasHasta(s.prueba_hasta) : null;
  const enPrueba = s.estado === "prueba" && dias !== null && dias > 0;
  const tono =
    s.estado === "activa" || s.estado === "cortesia"
      ? "ok"
      : s.estado === "vencida" || enPrueba
        ? "aviso"
        : "apagado";

  return (
    <section className={styles.estado} aria-label="Tu plan">
      <div className={styles.estadoTexto}>
        <p className={styles.estadoEtiqueta}>
          <span className={styles.led} data-tono={tono} aria-hidden="true" />
          {enPrueba ? "Prueba con todo incluido" : ETIQUETA_ESTADO[s.estado]}
        </p>
        <p className={styles.estadoPlan}>{s.plan_efectivo_nombre ?? s.plan_efectivo}</p>
        <p className={styles.estadoDetalle}>
          {enPrueba
            ? `Hasta el ${fecha(s.prueba_hasta)}. Después pasás al plan Gratis si no elegís otro.`
            : s.estado === "activa"
              ? `${s.ciclo === "anual" ? "Anual" : "Mensual"} · se renueva el ${fecha(s.periodo_fin)}`
              : s.estado === "cancelada"
                ? `Cancelada · seguís con este plan hasta el ${fecha(s.periodo_fin)}`
                : s.estado === "vencida"
                  ? "El último cobro no pasó. Revisá tu tarjeta o elegí el plan de nuevo."
                  : s.estado === "cortesia"
                    ? "Plan asignado por Wake Parts."
                    : "Elegí un plan para quitar los límites."}
        </p>
      </div>
      {enPrueba && <Tanque dias={dias!} total={7} />}
    </section>
  );
}

/** Medidor de tanque: los días de prueba que quedan, de E a F. La aguja barre una vez al abrir. */
function Tanque({ dias, total }: { dias: number; total: number }) {
  const fraccion = Math.max(0, Math.min(1, dias / total));
  const angulo = -60 + fraccion * 120;
  const marcas = Array.from({ length: 9 }, (_, i) => -60 + i * 15);
  return (
    <figure className={styles.tanque} aria-label={`Quedan ${dias} días de prueba`}>
      <svg viewBox="0 0 120 78" aria-hidden="true">
        <path d="M14 66 A52 52 0 0 1 106 66" className={styles.tanqueArco} />
        <path d="M14 66 A52 52 0 0 1 27 36" className={styles.tanqueReserva} />
        {marcas.map((a) => (
          <line
            key={a}
            x1="60"
            y1="18"
            x2="60"
            y2={a % 30 === 0 ? 25 : 22}
            transform={`rotate(${a} 60 66)`}
            className={styles.tanqueMarca}
          />
        ))}
        <text x="14" y="76" className={styles.tanqueLetra}>
          E
        </text>
        <text x="100" y="76" className={styles.tanqueLetra}>
          F
        </text>
        <g className={styles.aguja} style={{ "--angulo": `${angulo}deg` } as React.CSSProperties}>
          <line x1="60" y1="66" x2="60" y2="24" />
        </g>
        <circle cx="60" cy="66" r="5" className={styles.tanqueEje} />
      </svg>
      <figcaption className={styles.tanqueLcd}>
        <span>{dias}</span> {dias === 1 ? "día" : "días"}
      </figcaption>
    </figure>
  );
}

/* ------------------------------------------------------------ consumo ---- */

const USO_POR_LIMITE: Record<string, keyof NonNullable<DatosSuscripcion["uso"]>> = {
  sucursales: "sucursales",
  puntos_emision: "puntos_emision",
  usuarios: "usuarios",
  productos: "productos",
  clientes: "clientes",
  proveedores: "proveedores",
  facturas_mes: "facturas_mes",
  cotizaciones_mes: "cotizaciones_mes",
  almacenamiento_mb: "almacenamiento_bytes",
};

function Consumo({ datos, plan }: { datos: DatosSuscripcion; plan: PlanPublico }) {
  const uso = datos.uso!;
  const filas = LIMITES.filter((l) => USO_POR_LIMITE[l.clave] && uso[USO_POR_LIMITE[l.clave]] !== null);
  return (
    <section className={styles.seccion} aria-labelledby="consumo-titulo">
      <h4 id="consumo-titulo" className={styles.titulo}>
        Lo que usás
      </h4>
      <dl className={styles.consumo}>
        {filas.map((l) => {
          const bruto = Number(uso[USO_POR_LIMITE[l.clave]] ?? 0);
          const usado = l.clave === "almacenamiento_mb" ? Math.round(bruto / 1048576) : bruto;
          const tope = plan.limites[l.clave];
          const fraccion = tope ? Math.min(1, usado / tope) : 0;
          const nivel = tope === undefined ? "libre" : fraccion >= 1 ? "lleno" : fraccion >= 0.8 ? "alto" : "normal";
          return (
            <div key={l.clave} data-nivel={nivel}>
              <dt>{l.nombre.replace(" (MB)", "")}</dt>
              <dd>
                {usado.toLocaleString("es-HN")}
                {l.clave === "almacenamiento_mb" && " MB"}
                <span>{tope === undefined ? " / sin límite" : ` / ${tope.toLocaleString("es-HN")}`}</span>
              </dd>
              {tope !== undefined && (
                <span className={styles.barra} aria-hidden="true">
                  <span style={{ transform: `scaleX(${fraccion})` }} />
                </span>
              )}
            </div>
          );
        })}
      </dl>
    </section>
  );
}

function Limites({ plan }: { plan: PlanPublico }) {
  const claves = ["sucursales", "usuarios", "productos", "clientes", "almacenamiento_mb"];
  return (
    <dl className={styles.limites}>
      {claves.map((c) => {
        const v = plan.limites[c];
        const texto =
          v === undefined
            ? "Ilimitado"
            : c === "almacenamiento_mb"
              ? v >= 1024
                ? `${Math.round(v / 1024)} GB`
                : `${v} MB`
              : v.toLocaleString("es-HN");
        return (
          <div key={c}>
            <dt>{LIMITES.find((l) => l.clave === c)?.nombre.replace(" (MB)", "")}</dt>
            <dd>{texto}</dd>
          </div>
        );
      })}
    </dl>
  );
}

/* ---------------------------------------------------------- historial ---- */

const TIPOS_EVENTO: Record<string, string> = {
  pago: "Pago",
  renovacion: "Renovación",
  cambio_plan: "Cambio de plan",
  pago_fallido: "Pago rechazado",
  cancelada: "Cancelación",
  vencida: "Pago pendiente",
  prueba_fin: "Fin de la prueba",
};

function Historial({ datos }: { datos: DatosSuscripcion }) {
  return (
    <section className={styles.seccion} aria-labelledby="historial-titulo">
      <h4 id="historial-titulo" className={styles.titulo}>
        Historial
      </h4>
      <ul className={styles.historial}>
        {datos.eventos.map((e) => (
          <li key={e.id} data-tipo={e.tipo}>
            <span className={styles.historialFecha}>{fecha(e.creado_en)}</span>
            <span>{TIPOS_EVENTO[e.tipo] ?? e.tipo}</span>
            <span className={styles.historialDetalle}>{e.mensaje ?? e.plan ?? ""}</span>
            <span className={styles.historialMonto}>{e.monto ? usd(e.monto) : ""}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ----------------------------------------------------------- cancelar ---- */

function Cancelar({
  hasta,
  onListo,
  onSincronizado,
}: {
  hasta: string | null;
  onListo: (texto: string) => Promise<void>;
  onSincronizado: (texto: string, ok: boolean) => Promise<void>;
}) {
  const api = useApi("suscripcion");
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancelar() {
    setOcupado(true);
    setError(null);
    const r = await api.cancelar(motivo).catch(() => ({ ok: false as const, error: "Sin conexión." }));
    setOcupado(false);
    if (!r.ok) return setError(r.error);
    setAbierto(false);
    await onListo(r.mensaje);
  }

  async function sincronizar() {
    setOcupado(true);
    const r = await api.sincronizar().catch(() => ({ ok: false as const, error: "Sin conexión." }));
    setOcupado(false);
    await onSincronizado(r.ok ? r.mensaje : r.error, r.ok);
  }

  return (
    <section className={styles.seccion}>
      <div className={styles.bloqueFila}>
        <div>
          <p className={styles.bloqueTitulo}>Tu suscripción con tarjeta</p>
          <p className={styles.bloqueTexto}>
            Si cancelás, no se hacen más cobros y seguís con tu plan hasta el {fecha(hasta)}.
          </p>
        </div>
        <div className={styles.fila}>
          <button type="button" className={`${ui.boton} ${ui.fantasma}`} disabled={ocupado} onClick={sincronizar}>
            Verificar estado
          </button>
          {!abierto && (
            <button type="button" className={`${ui.boton} ${ui.peligro}`} onClick={() => setAbierto(true)}>
              Cancelar suscripción
            </button>
          )}
        </div>
      </div>
      {abierto && (
        <div className={styles.confirmar} role="group" aria-label="Confirmar cancelación">
          <label className={styles.campo}>
            <span>¿Por qué cancelás? (opcional)</span>
            <textarea
              className={ui.campo}
              rows={2}
              maxLength={280}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Nos ayuda a mejorar"
            />
          </label>
          <div className={styles.fila}>
            <button type="button" className={`${ui.boton} ${ui.peligro}`} disabled={ocupado} onClick={cancelar}>
              {ocupado ? "Cancelando…" : "Sí, cancelar"}
            </button>
            <button type="button" className={`${ui.boton} ${ui.fantasma}`} disabled={ocupado} onClick={() => setAbierto(false)}>
              Seguir suscrito
            </button>
            {error && (
              <span className={styles.error} role="alert">
                {error}
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/* --------------------------------------------------------------- pago ---- */

const PAISES = [
  ["HN", "Honduras"],
  ["SV", "El Salvador"],
  ["GT", "Guatemala"],
  ["NI", "Nicaragua"],
  ["CR", "Costa Rica"],
  ["PA", "Panamá"],
  ["MX", "México"],
  ["US", "Estados Unidos"],
  ["CA", "Canadá"],
  ["ES", "España"],
  ["CO", "Colombia"],
] as const;

function marca(numero: string) {
  const d = soloDigitos(numero);
  if (/^4/.test(d)) return "VISA";
  if (/^(5[1-5]|2[2-7])/.test(d)) return "MASTERCARD";
  if (/^3[47]/.test(d)) return "AMEX";
  return "";
}

/** Dominios desde los que n1co (o su procesador) avisa el resultado del 3D Secure. */
const ORIGEN_3DS = /^https:\/\/([a-z0-9-]+\.)*(n1co\.com|n1co\.shop|h4b\.dev)$/i;

/**
 * Aviso del 3D Secure: debe venir de la ventana que abrimos (o de una página
 * dentro de ella) y de un dominio de n1co. El banco puede pasar por varias
 * páginas, así que no se exige el origen exacto de la URL inicial.
 */
function mensaje3ds(evento: MessageEvent, ventana: Window | null | undefined) {
  if (!ventana || !ORIGEN_3DS.test(evento.origin)) return null;
  let fuente = evento.source as Window | null;
  let propia = false;
  for (let n = 0; fuente && n < 4; n++) {
    if (fuente === ventana) {
      propia = true;
      break;
    }
    if (fuente === fuente.parent) break;
    fuente = fuente.parent;
  }
  if (!propia) return null;
  let d: unknown = evento.data;
  if (typeof d === "string") {
    try {
      d = JSON.parse(d);
    } catch {
      return null;
    }
  }
  if (!d || typeof d !== "object") return null;
  const o = d as Record<string, unknown>;
  const tipo = String(o.MessageType ?? o.messageType ?? o.type ?? "").trim().toLowerCase();
  const estado = String(o.Status ?? o.status ?? "").trim().toUpperCase();
  const id = (o.AuthenticationId ?? o.authenticationId) as string | undefined;
  const error = String(o.ErrorTitle ?? o.errorTitle ?? o.ErrorDetail ?? o.errorDetail ?? "");
  return { tipo, estado, id: id ? String(id) : undefined, error, origen: evento.origin };
}

function Pago({
  plan,
  ciclo,
  cambio,
  onCerrar,
  onPagado,
}: {
  plan: PlanPublico;
  ciclo: Ciclo;
  cambio: boolean;
  onCerrar: () => void;
  onPagado: (texto: string) => Promise<void>;
}) {
  const api = useApi("suscripcion");
  const madre = useVentanaActual() ?? undefined;
  const id = useId();
  const precio = precioDe(plan, ciclo) ?? 0;
  const [f, setF] = useState({
    telefono: "",
    numero: "",
    titular: "",
    mes: "",
    anio: "",
    cvv: "",
    pais: "HN",
    estado: "",
    codigoPostal: "",
  });
  const [error, setError] = useState<{ texto: string; campo?: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [tresDs, setTresDs] = useState<{ intento: string; url: string } | null>(null);
  const [intentoFacturacion, setIntentoFacturacion] = useState<string | null>(null);
  const enCurso = useRef(false);
  const urlRef = useRef<string | null>(null);
  /** Autenticaciones ya enviadas: el iframe puede avisar más de una vez. */
  const enviadas = useRef(new Set<string>());
  const marco = useRef<HTMLIFrameElement>(null);
  const avisados = useRef(new Set<string>());
  /** El banco ya terminó de su lado pero n1co todavía no confirma (PENDING). */
  const [verificando, setVerificando] = useState(false);
  /** AuthenticationId del último «SUCCESS» de la ventana del banco (lo que n1co pide para cobrar). */
  const confirmada = useRef<string | null>(null);
  const [esperando, setEsperando] = useState(false);

  const cambiar = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const pideDireccion = ["US", "CA"].includes(f.pais);
  const anios = Array.from({ length: 12 }, (_, i) => String(new Date().getFullYear() + i));

  // Otra petición ya está cobrando: se pregunta el resultado en vez de mostrar un error.
  const esperar = useCallback(async (intento: string) => {
    setTresDs(null);
    urlRef.current = null;
    setEsperando(true);
    const limite = Date.now() + 90_000;
    while (Date.now() < limite) {
      await new Promise((ok) => setTimeout(ok, 2500));
      const r: ResultadoPago = await api.estadoPago(intento).catch(() => ({ ok: true as const, estado: "procesando" as const, intento, mensaje: "" }));
      if (r.ok && r.estado === "procesando") continue;
      setEsperando(false);
      if (!r.ok) return setError({ texto: r.error });
      if (r.estado === "exitoso") {
        setF((x) => ({ ...x, numero: "", cvv: "", mes: "", anio: "" }));
        return onPagado(r.mensaje);
      }
      return;
    }
    setEsperando(false);
    setError({
      texto:
        "n1co todavía no confirma. No repitas el pago: si el cobro pasó, tu plan se activa solo en unos minutos (n1co nos avisa). Si en 30 minutos no aparece, escribinos.",
    });
  }, [api, onPagado]);

  const enviar = useCallback(
    async (p: PeticionPago) => {
      if (enCurso.current) return;
      enCurso.current = true;
      setOcupado(true);
      setError(null);
      const r: ResultadoPago = await api.pagar(p).catch(() => ({ ok: false as const, error: "Sin conexión. Intentá de nuevo." }));
      enCurso.current = false;
      setOcupado(false);
      if (!r.ok) {
        setTresDs(null);
        urlRef.current = null;
        return setError({ texto: r.error, campo: r.campo });
      }
      if (r.estado === "exitoso") {
        // La tarjeta se borra de la memoria del formulario en cuanto termina.
        setF((x) => ({ ...x, numero: "", cvv: "", mes: "", anio: "" }));
        return onPagado(r.mensaje);
      }
      if (r.estado === "procesando") return esperar(r.intento);
      if (r.estado === "autenticacion") {
        urlRef.current = r.url;
        setTresDs({ intento: r.intento, url: r.url });
        setF((x) => ({ ...x, numero: "", cvv: "" }));
        return;
      }
      setIntentoFacturacion(r.intento);
      setF((x) => ({ ...x, numero: "", cvv: "", pais: "US" }));
      setError({ texto: r.mensaje, campo: "estado" });
    },
    [api, onPagado, esperar],
  );


  const base = (): Omit<PeticionPago, "tarjeta"> => ({
    plan: plan.codigo,
    ciclo,
    telefono: f.telefono,
    facturacion: { pais: f.pais, estado: f.estado, codigoPostal: f.codigoPostal },
  });

  // Respuesta del 3D Secure dentro del iframe.
  useEffect(() => {
    if (!tresDs) return;
    function alRecibir(e: MessageEvent) {
      const m = mensaje3ds(e, marco.current?.contentWindow);
      if (!m || !tresDs) return;
      // Rastro en Actividad de cada aviso distinto (sin datos de la tarjeta).
      const firma = `${m.tipo}|${m.estado}|${m.id ?? ""}`;
      if (!avisados.current.has(firma)) {
        avisados.current.add(firma);
        void api
          .avisarTresDs(tresDs.intento, { origen: m.origen, tipo: m.tipo, estado: m.estado, conId: Boolean(m.id), error: m.error })
          .catch(() => {});
      }
      if (m.tipo === "authentication.failed" || ["FAILED", "EXPIRED", "ERROR"].includes(m.estado)) {
        setTresDs(null);
        urlRef.current = null;
        setError({
          texto:
            m.estado === "EXPIRED"
              ? "La verificación de tu banco venció. Volvé a ingresar la tarjeta."
              : "Tu banco no confirmó el pago. Probá de nuevo o con otra tarjeta.",
        });
        return;
      }
      // n1co avisa PENDING mientras el banco verifica: solo se cobra con
      // «authentication.complete» + SUCCESS, y una sola vez por autenticación.
      if (m.estado === "PENDING") setVerificando(true);
      if (m.tipo !== "authentication.complete" || m.estado !== "SUCCESS") return;
      if (!m.id) return;
      confirmada.current = m.id;
      if (enviadas.current.has(m.id)) return;
      enviadas.current.add(m.id);
      void enviar({ ...base(), intento: tresDs.intento, autenticacion: m.id });
    }
    window.addEventListener("message", alRecibir);
    return () => window.removeEventListener("message", alRecibir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tresDs, enviar]);

  function alEnviar(e: FormEvent) {
    e.preventDefault();
    const p: PeticionPago = intentoFacturacion
      ? { ...base(), intento: intentoFacturacion }
      : { ...base(), tarjeta: { numero: f.numero, titular: f.titular, mes: f.mes, anio: f.anio, cvv: f.cvv } };
    const invalido = validarPago(p);
    if (invalido) return setError({ texto: invalido.error, campo: invalido.campo });
    void enviar(p);
  }

  const campo = (k: string) => (error?.campo === k ? { "aria-invalid": true, "aria-describedby": `${id}-error` } : {});

  return (
    <VentanaFlotante
      id="suscripcion-pago"
      titulo={`Plan ${plan.nombre}`}
      padre={madre}
      tamano={{ w: 560, h: tresDs ? 720 : 760 }}
      foco={plan.codigo}
      onCerrar={() => {
        if (!enCurso.current && !esperando) onCerrar();
      }}
    >
      <div className={styles.pago}>
        <div className={styles.resumen}>
          <div>
            <p className={styles.resumenPlan}>{plan.nombre}</p>
            <p className={styles.nota}>{ciclo === "anual" ? "Pago anual, se renueva cada año" : "Pago mensual, se renueva cada mes"}</p>
          </div>
          <p className={styles.resumenLcd}>
            {usd(precio)}
            <span>/{ciclo === "anual" ? "año" : "mes"}</span>
          </p>
        </div>
        {cambio && (
          <p className={styles.aviso}>
            Ya tenés una suscripción: al pagar este plan, la anterior se cancela en el acto para que no te cobren dos
            veces. Lo que quedaba del periodo anterior no se reembolsa.
          </p>
        )}

        {esperando ? (
          <div className={styles.tresDs} role="status">
            <div className={styles.cargando} style={{ height: 72 }} aria-hidden="true" />
            <p className={styles.nota}>Estamos confirmando el pago con tu banco. No cierres esta ventana.</p>
          </div>
        ) : tresDs ? (
          <div className={styles.tresDs}>
            <p className={styles.nota}>
              Tu banco pide confirmar el pago. Completá la verificación abajo (código por SMS, app del banco o
              clave); cuando el banco diga que terminó, si no avanza solo, tocá «Ya confirmé».
            </p>
            {verificando && (
              <p className={styles.nota} role="status">
                Tu banco está terminando la verificación. Si en unos segundos no avanza, tocá «Ya confirmé».
              </p>
            )}
            {error && (
              <p className={styles.error} role="alert">
                {error.texto}
              </p>
            )}
            <iframe
              ref={marco}
              title="Verificación de tu banco (3D Secure)"
              src={tresDs.url}
              className={styles.iframe}
              referrerPolicy="no-referrer"
            />
            <div className={styles.fila}>
              <button
                type="button"
                className={`${ui.boton} ${ui.primario}`}
                disabled={ocupado}
                onClick={() => {
                  // Sin la confirmación del banco no se llama a n1co: evitaría gastar otra verificación.
                  if (!confirmada.current)
                    return setError({
                      texto: "Todavía no recibimos la confirmación de tu banco. Terminá la verificación en la ventana.",
                    });
                  void enviar({ ...base(), intento: tresDs.intento, autenticacion: confirmada.current });
                }}
              >
                {ocupado ? "Confirmando…" : "Ya confirmé"}
              </button>
              <button
                type="button"
                className={`${ui.boton} ${ui.fantasma}`}
                disabled={ocupado}
                onClick={() => {
                  setTresDs(null);
                  urlRef.current = null;
                }}
              >
                Volver
              </button>
            </div>
          </div>
        ) : (
          <form className={styles.formulario} onSubmit={alEnviar} noValidate autoComplete="on">
            {!intentoFacturacion && (
              <fieldset className={styles.tarjeta}>
                <legend className={ui.etiquetaSeccion}>Tarjeta</legend>
                <label className={`${styles.campo} ${styles.ancho}`}>
                  <span>
                    Número <em className={styles.marca}>{marca(f.numero)}</em>
                  </span>
                  <input
                    className={`${ui.campo} ${ui.campoMono}`}
                    inputMode="numeric"
                    autoComplete="cc-number"
                    placeholder="0000 0000 0000 0000"
                    value={formatoTarjeta(f.numero)}
                    onChange={(e) => cambiar("numero", soloDigitos(e.target.value).slice(0, 19))}
                    {...campo("numero")}
                  />
                </label>
                <label className={`${styles.campo} ${styles.ancho}`}>
                  <span>Nombre en la tarjeta</span>
                  <input
                    className={ui.campo}
                    autoComplete="cc-name"
                    maxLength={120}
                    value={f.titular}
                    onChange={(e) => cambiar("titular", e.target.value)}
                    {...campo("titular")}
                  />
                </label>
                <label className={styles.campo}>
                  <span>Mes</span>
                  <select
                    className={ui.campo}
                    autoComplete="cc-exp-month"
                    value={f.mes}
                    onChange={(e) => cambiar("mes", e.target.value)}
                    {...campo("mes")}
                  >
                    <option value="">MM</option>
                    {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")).map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.campo}>
                  <span>Año</span>
                  <select
                    className={ui.campo}
                    autoComplete="cc-exp-year"
                    value={f.anio}
                    onChange={(e) => cambiar("anio", e.target.value)}
                    {...campo("anio")}
                  >
                    <option value="">AAAA</option>
                    {anios.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.campo}>
                  <span>Código (CVV)</span>
                  <input
                    className={`${ui.campo} ${ui.campoMono}`}
                    inputMode="numeric"
                    autoComplete="cc-csc"
                    type="password"
                    maxLength={4}
                    value={f.cvv}
                    onChange={(e) => cambiar("cvv", soloDigitos(e.target.value).slice(0, 4))}
                    {...campo("cvv")}
                  />
                </label>
              </fieldset>
            )}

            <fieldset className={styles.tarjeta}>
              <legend className={ui.etiquetaSeccion}>Contacto y facturación</legend>
              <label className={`${styles.campo} ${styles.ancho}`}>
                <span>Teléfono</span>
                <input
                  className={`${ui.campo} ${ui.campoMono}`}
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="9876 5432 o +504 9876 5432"
                  value={f.telefono}
                  onChange={(e) => cambiar("telefono", e.target.value.slice(0, 20))}
                  {...campo("telefono")}
                />
              </label>
              <label className={`${styles.campo} ${pideDireccion ? "" : styles.ancho}`}>
                <span>País de la tarjeta</span>
                <select className={ui.campo} value={f.pais} onChange={(e) => cambiar("pais", e.target.value)} {...campo("pais")}>
                  {PAISES.map(([c, n]) => (
                    <option key={c} value={c}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              {pideDireccion && (
                <>
                  <label className={styles.campo}>
                    <span>Estado / provincia</span>
                    <input
                      className={ui.campo}
                      autoComplete="address-level1"
                      maxLength={10}
                      placeholder="TX"
                      value={f.estado}
                      onChange={(e) => cambiar("estado", e.target.value.toUpperCase())}
                      {...campo("estado")}
                    />
                  </label>
                  <label className={styles.campo}>
                    <span>Código postal</span>
                    <input
                      className={`${ui.campo} ${ui.campoMono}`}
                      autoComplete="postal-code"
                      maxLength={10}
                      value={f.codigoPostal}
                      onChange={(e) => cambiar("codigoPostal", e.target.value)}
                      {...campo("codigoPostal")}
                    />
                  </label>
                </>
              )}
            </fieldset>

            {error && (
              <p id={`${id}-error`} className={styles.error} role="alert">
                {error.texto}
              </p>
            )}

            <button type="submit" className={`${ui.boton} ${ui.primario} ${styles.pagar}`} disabled={ocupado}>
              {ocupado ? "Procesando…" : `Pagar ${usd(precio)}`}
            </button>
            <p className={styles.seguro}>
              <span className={styles.candado} aria-hidden="true" />
              Pago procesado por n1co. Wake Parts no guarda los datos de tu tarjeta.
            </p>
          </form>
        )}
      </div>
    </VentanaFlotante>
  );
}
