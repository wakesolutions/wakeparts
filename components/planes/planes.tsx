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
              {p.precio_mensual ? `L ${p.precio_mensual.toLocaleString("es-HN")}/mes` : p.precio_mensual === 0 ? "Gratis" : "Precio sin definir"}
            </span>
            <span className={styles.tarjetaDato}>
              {cuantas(p.codigo)} empresa{cuantas(p.codigo) === 1 ? "" : "s"}
              {p.predeterminado && " · predeterminado"}
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
            className={ui.campoMono}
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
          <span>Precio mensual (L, referencial)</span>
          <input
            className={ui.campoMono}
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
            className={ui.campoMono}
            type="number"
            min={0}
            value={f.orden}
            onChange={(e) => cambiar("orden", Number(e.target.value))}
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
        <p className={styles.nota}>Inicio y Mi usuario siempre están. Lo que no esté marcado desaparece del dock de esas empresas.</p>
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
                className={ui.campoMono}
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
            onClick={() => correr(() => fijarPredeterminado(plan.codigo), "Las empresas nuevas arrancan con este plan.", plan.codigo)}
          >
            Usar para empresas nuevas
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
  { clave: "puntos_emision", limite: "puntos_emision", nombre: "Puntos" },
  { clave: "facturas_mes", limite: "facturas_mes", nombre: "Facturas (mes)" },
  { clave: "cotizaciones_mes", limite: "cotizaciones_mes", nombre: "Cotiz. (mes)" },
];

function FilaEmpresa({ empresa: e, planes, onGuardado }: { empresa: UsoEmpresa; planes: Plan[]; onGuardado: () => Promise<void> }) {
  const [plan, setPlan] = useState(e.plan);
  const [nota, setNota] = useState(e.nota ?? "");
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const limites = planes.find((p) => p.codigo === e.plan)?.limites ?? {};
  const cambio = plan !== e.plan || nota !== (e.nota ?? "");

  async function guardar() {
    setOcupado(true);
    const r = await asignarPlan(e.id_empresa, plan, nota).catch(() => ({ ok: false as const, error: "Sin conexión." }));
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
          <p className={styles.nota}>{e.asignado_en ? `Plan desde ${fechaDia(e.asignado_en)}` : "Plan predeterminado"}</p>
        </div>
        <select className={ui.campo} value={plan} onChange={(x) => setPlan(x.target.value)} aria-label={`Plan de ${e.empresa}`}>
          {planes.map((p) => (
            <option key={p.codigo} value={p.codigo}>
              {p.nombre}
            </option>
          ))}
        </select>
      </div>
      <dl className={styles.usos}>
        {USOS.map((u) => {
          const usado = e[u.clave] as number | null;
          if (usado === null) return null;
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
        <input
          className={ui.campo}
          placeholder="Nota interna (por qué este plan, pruebas…)"
          value={nota}
          maxLength={500}
          onChange={(x) => setNota(x.target.value)}
        />
        <button type="button" className={`${ui.boton} ${ui.primario}`} disabled={!cambio || ocupado} onClick={guardar}>
          Guardar
        </button>
        {aviso && (
          <span className={styles.nota} role="status">
            {aviso}
          </span>
        )}
      </div>
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
