"use client";

import { useCallback, useEffect, useState } from "react";
import {
  asignarPlan,
  cargarPlanes,
  eliminarPlan,
  fijarPredeterminado,
  guardarPermisosRol,
  guardarPlan,
  type DatosPlanes,
  type Plan,
  type UsoEmpresa,
} from "@/app/acciones/planes";
import ui from "@/components/ui/controles.module.css";
import { fechaDia } from "@/lib/formato";
import {
  CAPACIDADES,
  LIMITES,
  MODULOS_CONTROLADOS,
  PERMISOS_POR_DEFECTO,
  ROLES_CONFIGURABLES,
  type Permiso,
} from "@/lib/permisos";
import styles from "./planes.module.css";

/**
 * Módulo Planes (solo admin de plataforma, 0023): planes y sus límites, plan de
 * cada empresa con su consumo, permisos por rol y lista de administradores.
 * Como Seguimiento, llama Server Actions directo: no existe en la demo pública.
 */

function useDatos() {
  const [datos, setDatos] = useState<DatosPlanes | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recargar = useCallback(async () => {
    const r = await cargarPlanes().catch(() => ({ ok: false as const, error: "Sin conexión." }));
    if (r.ok) {
      setDatos(r.datos);
      setError(null);
    } else setError(r.error);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    recargar();
  }, [recargar]);
  return { datos, error, recargar };
}

function Estado({ error }: { error: string | null }) {
  return <p className={styles.estado}>{error ?? "Cargando…"}</p>;
}

/* ------------------------------------------------------------ planes ---- */

const PLAN_NUEVO: Plan = {
  codigo: "",
  nombre: "",
  descripcion: "",
  precio_mensual: null,
  precio_anual: null,
  n1co_plan_mensual: null,
  n1co_plan_anual: null,
  publico: false,
  solo_admins: false,
  etiqueta: "",
  caracteristicas: [],
  orden: 9,
  modulos: ["inicio", "mi-usuario", "taller"],
  limites: {},
  predeterminado: false,
  activo: true,
};

export function PlanesLimites() {
  const { datos, error, recargar } = useDatos();
  const [elegido, setElegido] = useState<string | null>(null);
  if (!datos) return <Estado error={error} />;
  const plan = elegido === "" ? PLAN_NUEVO : datos.planes.find((p) => p.codigo === elegido) ?? datos.planes[0];
  const cuantas = (codigo: string) => datos.empresas.filter((e) => e.plan === codigo).length;

  return (
    <div className={styles.planes}>
      <div className={styles.tarjetas} role="tablist" aria-label="Planes">
        {datos.planes.map((p) => (
          <button
            key={p.codigo}
            type="button"
            role="tab"
            aria-selected={plan?.codigo === p.codigo && elegido !== ""}
            className={styles.tarjeta}
            onClick={() => setElegido(p.codigo)}
          >
            <span className={styles.tarjetaNombre}>{p.nombre}</span>
            <span className={styles.tarjetaDato}>
              {p.precio_mensual ? `$${p.precio_mensual.toLocaleString("en-US")}/mes` : p.precio_mensual === 0 ? "Gratis" : "Precio sin definir"}
              {p.solo_admins ? " · solo admins" : p.publico ? "" : " · oculto"}
            </span>
            <span className={styles.tarjetaDato}>
              {cuantas(p.codigo)} empresa{cuantas(p.codigo) === 1 ? "" : "s"}
              {p.predeterminado && " · sin pago"}
            </span>
          </button>
        ))}
        <button
          type="button"
          role="tab"
          aria-selected={elegido === ""}
          className={`${styles.tarjeta} ${styles.tarjetaNueva}`}
          onClick={() => setElegido("")}
        >
          + Nuevo plan
        </button>
      </div>
      {plan && (
        <EditorPlan
          key={elegido === "" ? "nuevo" : plan.codigo}
          plan={plan}
          nuevo={elegido === ""}
          empresas={cuantas(plan.codigo)}
          onGuardado={async (codigo) => {
            await recargar();
            setElegido(codigo);
          }}
        />
      )}
    </div>
  );
}

function EditorPlan({
  plan,
  nuevo,
  empresas,
  onGuardado,
}: {
  plan: Plan;
  nuevo: boolean;
  empresas: number;
  onGuardado: (codigo: string | null) => Promise<void>;
}) {
  const [f, setF] = useState(plan);
  const [limites, setLimites] = useState<Record<string, string>>(() =>
    Object.fromEntries(LIMITES.map((l) => [l.clave, plan.limites[l.clave]?.toString() ?? ""])),
  );
  const [caracteristicas, setCaracteristicas] = useState(plan.caracteristicas.join("\n"));
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const cambiar = <K extends keyof Plan>(k: K, v: Plan[K]) => setF((x) => ({ ...x, [k]: v }));
  const alternar = (id: string) =>
    cambiar("modulos", f.modulos.includes(id) ? f.modulos.filter((m) => m !== id) : [...f.modulos, id]);

  async function correr(accion: () => Promise<{ ok: boolean; error?: string }>, ok: string, codigo: string | null) {
    setOcupado(true);
    setAviso(null);
    const r = await accion().catch(() => ({ ok: false, error: "Sin conexión." }));
    setOcupado(false);
    if (!r.ok) return setAviso(r.error ?? "No se pudo.");
    setAviso(ok);
    await onGuardado(codigo);
  }

  const guardar = () =>
    correr(
      () =>
        guardarPlan({
          nuevo,
          codigo: f.codigo,
          nombre: f.nombre,
          descripcion: f.descripcion,
          precio_mensual: f.precio_mensual,
          precio_anual: f.precio_anual,
          n1co_plan_mensual: f.n1co_plan_mensual,
          n1co_plan_anual: f.n1co_plan_anual,
          publico: f.publico,
          solo_admins: f.solo_admins,
          etiqueta: f.etiqueta,
          caracteristicas: caracteristicas.split("\n"),
          orden: f.orden,
          modulos: f.modulos,
          limites: Object.fromEntries(
            Object.entries(limites)
              .filter(([, v]) => v.trim() !== "")
              .map(([k, v]) => [k, Number(v)]),
          ),
        }),
      "Plan guardado. Las empresas lo ven al recargar.",
      f.codigo.trim().toLowerCase(),
    );

  return (
    <div className={styles.editor}>
      <div className={styles.rejilla}>
        <label className={styles.campo}>
          <span>Código</span>
          <input
            className={`${ui.campo} ${ui.campoMono}`}
            value={f.codigo}
            disabled={!nuevo}
            placeholder="p. ej. pro"
            maxLength={30}
            onChange={(e) => cambiar("codigo", e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
          />
        </label>
        <label className={styles.campo}>
          <span>Nombre</span>
          <input className={ui.campo} value={f.nombre} maxLength={60} onChange={(e) => cambiar("nombre", e.target.value)} />
        </label>
        <label className={styles.campo}>
          <span>Precio mensual (USD)</span>
          <input
            className={`${ui.campo} ${ui.campoMono}`}
            type="number"
            min={0}
            step="0.01"
            value={f.precio_mensual ?? ""}
            onChange={(e) => cambiar("precio_mensual", e.target.value === "" ? null : Number(e.target.value))}
          />
        </label>
        <label className={styles.campo}>
          <span>Orden</span>
          <input
            className={`${ui.campo} ${ui.campoMono}`}
            type="number"
            min={0}
            value={f.orden}
            onChange={(e) => cambiar("orden", Number(e.target.value))}
          />
        </label>
        <label className={styles.campo}>
          <span>Precio anual (USD)</span>
          <input
            className={`${ui.campo} ${ui.campoMono}`}
            type="number"
            min={0}
            step="0.01"
            value={f.precio_anual ?? ""}
            onChange={(e) => cambiar("precio_anual", e.target.value === "" ? null : Number(e.target.value))}
          />
        </label>
        <label className={styles.campo}>
          <span>ID n1co mensual</span>
          <input
            className={`${ui.campo} ${ui.campoMono}`}
            inputMode="numeric"
            placeholder="Sin cobro"
            value={f.n1co_plan_mensual ?? ""}
            onChange={(e) => cambiar("n1co_plan_mensual", e.target.value.replace(/\D/g, "") ? Number(e.target.value.replace(/\D/g, "")) : null)}
          />
        </label>
        <label className={styles.campo}>
          <span>ID n1co anual</span>
          <input
            className={`${ui.campo} ${ui.campoMono}`}
            inputMode="numeric"
            placeholder="Sin cobro"
            value={f.n1co_plan_anual ?? ""}
            onChange={(e) => cambiar("n1co_plan_anual", e.target.value.replace(/\D/g, "") ? Number(e.target.value.replace(/\D/g, "")) : null)}
          />
        </label>
        <div className={`${styles.campo} ${styles.ancho}`}>
          <span>Quién lo ve</span>
          <div className={styles.casillas}>
            <label className={styles.casillaFila}>
              <input
                type="radio"
                className={ui.casilla}
                name={`visible-${plan.codigo || "nuevo"}`}
                checked={f.publico}
                onChange={() => setF((x) => ({ ...x, publico: true, solo_admins: false }))}
              />
              Todos los talleres
            </label>
            <label className={styles.casillaFila}>
              <input
                type="radio"
                className={ui.casilla}
                name={`visible-${plan.codigo || "nuevo"}`}
                checked={f.solo_admins}
                onChange={() => setF((x) => ({ ...x, publico: false, solo_admins: true }))}
              />
              Solo admins (pruebas)
            </label>
            <label className={styles.casillaFila}>
              <input
                type="radio"
                className={ui.casilla}
                name={`visible-${plan.codigo || "nuevo"}`}
                checked={!f.publico && !f.solo_admins}
                onChange={() => setF((x) => ({ ...x, publico: false, solo_admins: false }))}
              />
              Oculto (solo por asignación)
            </label>
          </div>
        </div>
        <label className={`${styles.campo} ${styles.ancho}`}>
          <span>Para quién es (texto de venta)</span>
          <input
            className={ui.campo}
            value={f.etiqueta ?? ""}
            maxLength={160}
            onChange={(e) => cambiar("etiqueta", e.target.value)}
          />
        </label>
        <label className={`${styles.campo} ${styles.ancho}`}>
          <span>Qué incluye (una línea por punto)</span>
          <textarea
            className={ui.campo}
            rows={4}
            value={caracteristicas}
            onChange={(e) => setCaracteristicas(e.target.value)}
          />
        </label>
        <label className={`${styles.campo} ${styles.ancho}`}>
          <span>Descripción interna</span>
          <input
            className={ui.campo}
            value={f.descripcion ?? ""}
            maxLength={300}
            onChange={(e) => cambiar("descripcion", e.target.value)}
          />
        </label>
      </div>

      <section>
        <p className={ui.etiquetaSeccion}>Módulos incluidos</p>
        <p className={styles.nota}>
          Inicio y Mi usuario siempre están. Lo que no esté marcado desaparece del dock de esas empresas. Los precios
          que cobra n1co salen del plan creado allá: mantenelos iguales a los de aquí.
        </p>
        <div className={styles.casillas}>
          {MODULOS_CONTROLADOS.map((m) => (
            <label key={m.id} className={styles.casillaFila}>
              <input type="checkbox" className={ui.casilla} checked={f.modulos.includes(m.id)} onChange={() => alternar(m.id)} />
              {m.nombre}
            </label>
          ))}
        </div>
      </section>

      <section>
        <p className={ui.etiquetaSeccion}>Límites</p>
        <p className={styles.nota}>Vacío = sin límite. La base rechaza el alta cuando se llega al tope, con un aviso que no menciona el plan.</p>
        <div className={styles.rejilla}>
          {LIMITES.map((l) => (
            <label key={l.clave} className={styles.campo} title={l.detalle}>
              <span>{l.nombre}</span>
              <input
                className={`${ui.campo} ${ui.campoMono}`}
                type="number"
                min={0}
                placeholder="Sin límite"
                value={limites[l.clave]}
                onChange={(e) => setLimites((x) => ({ ...x, [l.clave]: e.target.value }))}
              />
            </label>
          ))}
        </div>
      </section>

      <div className={styles.fila}>
        <button type="button" className={`${ui.boton} ${ui.primario}`} disabled={ocupado} onClick={guardar}>
          {nuevo ? "Crear plan" : "Guardar plan"}
        </button>
        {!nuevo && !plan.predeterminado && (
          <button
            type="button"
            className={ui.boton}
            disabled={ocupado}
            onClick={() => correr(() => fijarPredeterminado(plan.codigo), "Las empresas sin pago (y al terminar la prueba) quedan en este plan.", plan.codigo)}
          >
            Usar como plan sin pago
          </button>
        )}
        {!nuevo && !plan.predeterminado && empresas === 0 && (
          <button
            type="button"
            className={`${ui.boton} ${ui.peligro}`}
            disabled={ocupado}
            onClick={() => correr(() => eliminarPlan(plan.codigo), "Plan eliminado.", null)}
          >
            Eliminar
          </button>
        )}
        {aviso && (
          <span className={styles.nota} role="status">
            {aviso}
          </span>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- empresas ---- */

export function EmpresasPlanes() {
  const { datos, error, recargar } = useDatos();
  const [filtro, setFiltro] = useState("");
  if (!datos) return <Estado error={error} />;
  const lista = datos.empresas.filter((e) => e.empresa.toLowerCase().includes(filtro.trim().toLowerCase()));

  return (
    <div className={styles.empresas}>
      <input
        className={ui.campo}
        placeholder="Buscar empresa…"
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
        aria-label="Buscar empresa"
      />
      <ul className={styles.listaEmpresas}>
        {lista.map((e) => (
          <FilaEmpresa key={e.id_empresa} empresa={e} planes={datos.planes} onGuardado={recargar} />
        ))}
        {!lista.length && <li className={styles.estado}>Sin empresas.</li>}
      </ul>
    </div>
  );
}

const USOS: { clave: keyof UsoEmpresa; limite: string; nombre: string }[] = [
  { clave: "productos", limite: "productos", nombre: "Productos" },
  { clave: "clientes", limite: "clientes", nombre: "Clientes" },
  { clave: "proveedores", limite: "proveedores", nombre: "Proveedores" },
  { clave: "usuarios", limite: "usuarios", nombre: "Usuarios" },
  { clave: "sucursales", limite: "sucursales", nombre: "Sucursales" },
  { clave: "puntos_emision", limite: "puntos_emision", nombre: "Puntos" },
  { clave: "facturas_mes", limite: "facturas_mes", nombre: "Facturas (mes)" },
  { clave: "cotizaciones_mes", limite: "cotizaciones_mes", nombre: "Cotiz. (mes)" },
  { clave: "almacenamiento_bytes", limite: "almacenamiento_mb", nombre: "MB usados" },
];

const ESTADOS: Record<string, string> = {
  prueba: "En prueba",
  activa: "Pagando",
  vencida: "Pago pendiente",
  cancelada: "Cancelada",
  gratis: "Gratis",
  cortesia: "Cortesía",
};

function detalleEstado(e: UsoEmpresa) {
  if (e.estado === "prueba" && e.prueba_hasta) return `prueba hasta ${fechaDia(e.prueba_hasta)}`;
  if ((e.estado === "activa" || e.estado === "cancelada" || e.estado === "vencida") && e.periodo_fin)
    return `${e.ciclo ?? ""} · periodo hasta ${fechaDia(e.periodo_fin)}`;
  return e.asignado_en ? `desde ${fechaDia(e.asignado_en)}` : "";
}

function FilaEmpresa({ empresa: e, planes, onGuardado }: { empresa: UsoEmpresa; planes: Plan[]; onGuardado: () => Promise<void> }) {
  const [modo, setModo] = useState<"cortesia" | "prueba" | "gratis">("cortesia");
  const [plan, setPlan] = useState(e.plan_efectivo ?? e.plan);
  const [dias, setDias] = useState(7);
  const [nota, setNota] = useState(e.nota ?? "");
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const efectivo = planes.find((p) => p.codigo === (e.plan_efectivo ?? e.plan));
  const limites = efectivo?.limites ?? {};

  async function guardar() {
    setOcupado(true);
    const r = await asignarPlan(e.id_empresa, plan, nota, modo, dias).catch(() => ({ ok: false as const, error: "Sin conexión." }));
    setOcupado(false);
    if (!r.ok) return setAviso(r.error);
    setAviso("Guardado.");
    await onGuardado();
  }

  return (
    <li className={styles.empresa}>
      <div className={styles.empresaCabeza}>
        <div>
          <p className={styles.empresaNombre}>{e.empresa}</p>
          <p className={styles.nota}>
            <span className={styles.estadoChip} data-estado={e.estado ?? "gratis"}>
              {ESTADOS[e.estado ?? "gratis"] ?? e.estado}
            </span>{" "}
            {efectivo?.nombre ?? e.plan_efectivo} · {detalleEstado(e)}
            {e.n1co_suscripcion_id && <code className={styles.n1co}> n1co #{e.n1co_suscripcion_id}</code>}
          </p>
        </div>
      </div>
      <dl className={styles.usos}>
        {USOS.map((u) => {
          const bruto = e[u.clave] as number | null;
          if (bruto === null || bruto === undefined) return null;
          const usado = u.clave === "almacenamiento_bytes" ? Math.round(bruto / 1048576) : bruto;
          const tope = limites[u.limite];
          const lleno = tope !== undefined && usado >= tope;
          return (
            <div key={u.clave} data-lleno={lleno || undefined}>
              <dt>{u.nombre}</dt>
              <dd>
                {usado.toLocaleString("es-HN")}
                <span>{tope === undefined ? " / ∞" : ` / ${tope.toLocaleString("es-HN")}`}</span>
              </dd>
            </div>
          );
        })}
      </dl>
      <div className={styles.fila}>
        <select className={ui.campo} value={modo} onChange={(x) => setModo(x.target.value as typeof modo)} aria-label="Qué hacer">
          <option value="cortesia">Dar plan de cortesía</option>
          <option value="prueba">Dar prueba</option>
          <option value="gratis">Pasar a Gratis</option>
        </select>
        {modo !== "gratis" && (
          <select className={ui.campo} value={plan} onChange={(x) => setPlan(x.target.value)} aria-label={`Plan de ${e.empresa}`}>
            {planes.map((p) => (
              <option key={p.codigo} value={p.codigo}>
                {p.nombre}
              </option>
            ))}
          </select>
        )}
        {modo === "prueba" && (
          <label className={styles.casillaFila}>
            <input
              className={`${ui.campo} ${ui.campoMono}`}
              type="number"
              min={1}
              max={90}
              value={dias}
              style={{ width: "4.5rem" }}
              onChange={(x) => setDias(Number(x.target.value))}
              aria-label="Días de prueba"
            />
            días
          </label>
        )}
      </div>
      <div className={styles.fila}>
        <input
          className={ui.campo}
          placeholder="Nota interna (por qué, pruebas…)"
          value={nota}
          maxLength={500}
          onChange={(x) => setNota(x.target.value)}
        />
        <button type="button" className={`${ui.boton} ${ui.primario}`} disabled={ocupado} onClick={guardar}>
          Aplicar
        </button>
        {aviso && (
          <span className={styles.nota} role="status">
            {aviso}
          </span>
        )}
      </div>
      {e.n1co_suscripcion_id && modo !== "cortesia" && (
        <p className={styles.nota}>
          Tiene suscripción con tarjeta: esto no la cancela en n1co y la próxima renovación la vuelve a activar.
        </p>
      )}
    </li>
  );
}

/* ------------------------------------------------------------ roles ---- */

export function PermisosRoles() {
  const { datos, error, recargar } = useDatos();
  if (!datos) return <Estado error={error} />;
  return (
    <div className={styles.roles}>
      <p className={styles.nota}>
        El dueño siempre tiene todo lo que incluye el plan. Aquí decidís qué ve cada rol dentro de su plan; vale para todas
        las empresas. Los módulos marcados con ◆ los ve el rol, pero la base solo deja escribir en ellos a dueño y
        administrador.
      </p>
      <div className={styles.matrices}>
        {ROLES_CONFIGURABLES.map(({ rol, nombre }) => (
          <MatrizRol
            key={`${rol}-${datos.permisos[rol]?.configurado}-${datos.permisos[rol]?.permisos.join()}`}
            rol={rol}
            nombre={nombre}
            inicial={datos.permisos[rol]?.permisos ?? PERMISOS_POR_DEFECTO[rol]}
            configurado={datos.permisos[rol]?.configurado ?? false}
            onGuardado={recargar}
          />
        ))}
      </div>
    </div>
  );
}

function MatrizRol({
  rol,
  nombre,
  inicial,
  configurado,
  onGuardado,
}: {
  rol: string;
  nombre: string;
  inicial: Permiso[];
  configurado: boolean;
  onGuardado: () => Promise<void>;
}) {
  const [permisos, setPermisos] = useState(inicial);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const alternar = (p: Permiso) => setPermisos((x) => (x.includes(p) ? x.filter((y) => y !== p) : [...x, p]));
  const cambio = permisos.slice().sort().join() !== inicial.slice().sort().join();

  async function guardar(lista: Permiso[] | null) {
    setOcupado(true);
    const r = await guardarPermisosRol(rol, lista).catch(() => ({ ok: false as const, error: "Sin conexión." }));
    setOcupado(false);
    if (!r.ok) return setAviso(r.error);
    setAviso(lista ? "Guardado. Lo ven al recargar." : "Volvió a lo de fábrica.");
    await onGuardado();
  }

  return (
    <section className={styles.matriz}>
      <header>
        <h4>{nombre}</h4>
        <span className={styles.nota}>{configurado ? "Configurado" : "De fábrica"}</span>
      </header>
      <p className={ui.etiquetaSeccion}>Módulos</p>
      <div className={styles.casillas}>
        {MODULOS_CONTROLADOS.map((m) => (
          <label key={m.id} className={styles.casillaFila}>
            <input
              type="checkbox"
              className={ui.casilla}
              checked={permisos.includes(`modulo:${m.id}`)}
              onChange={() => alternar(`modulo:${m.id}`)}
            />
            {m.nombre}
            {m.admin && rol === "vendedor" && <span title="La base solo deja escribir a dueño/administrador"> ◆</span>}
          </label>
        ))}
      </div>
      <p className={ui.etiquetaSeccion}>Capacidades</p>
      <div className={styles.casillas}>
        {CAPACIDADES.map((c) => (
          <label key={c.clave} className={styles.casillaFila} title={c.detalle}>
            <input type="checkbox" className={ui.casilla} checked={permisos.includes(c.clave)} onChange={() => alternar(c.clave)} />
            {c.nombre}
          </label>
        ))}
      </div>
      <div className={styles.fila}>
        <button type="button" className={`${ui.boton} ${ui.primario}`} disabled={!cambio || ocupado} onClick={() => guardar(permisos)}>
          Guardar
        </button>
        {configurado && (
          <button type="button" className={`${ui.boton} ${ui.fantasma}`} disabled={ocupado} onClick={() => guardar(null)}>
            Volver a fábrica
          </button>
        )}
        {aviso && (
          <span className={styles.nota} role="status">
            {aviso}
          </span>
        )}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- admins ---- */

export function AdministradoresPlataforma() {
  const { datos, error } = useDatos();
  if (!datos) return <Estado error={error} />;
  return (
    <div className={styles.roles}>
      <ul className={styles.admins}>
        {datos.admins.map((c) => (
          <li key={c} className={styles.casillaFila}>
            <span className={styles.led} aria-hidden="true" />
            <code>{c}</code>
          </li>
        ))}
      </ul>
      <p className={styles.nota}>
        Para agregar o quitar administradores, editá la variable <code>ADMINS_PLATAFORMA</code> (correos separados por coma)
        en <code>.env.local</code> y en el hosting, y volvé a desplegar. El permiso en la base se pone o se quita solo la
        próxima vez que esa persona entre.
      </p>
    </div>
  );
}
