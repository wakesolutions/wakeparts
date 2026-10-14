"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { leerEmpresa, ResultadoDemo } from "@/app/acciones/empresa";
import { useApi } from "@/components/datos/apis";
import { ExportarDatos } from "@/components/exportacion/exportar-datos";
import { Formulario } from "@/components/formulario/formulario";
import { AparienciaEmpresa } from "@/components/identidad/apariencia-empresa";
import { useIdentidad } from "@/components/identidad/contexto";
import { EditorFormato } from "@/components/identidad/editor-formato";
import idStyles from "@/components/identidad/identidad.module.css";
import ui from "@/components/ui/controles.module.css";
import { CAMPOS_TALLER } from "@/lib/empresa";
import { ROLES } from "@/lib/recursos/equipo";
import { useSesion } from "../sesion-contexto";
import styles from "./modulos.module.css";

type Pestana = "datos" | "apariencia" | "factura";

const PESTANAS: { id: Pestana; nombre: string }[] = [
  { id: "datos", nombre: "Datos" },
  { id: "apariencia", nombre: "Apariencia" },
  { id: "factura", nombre: "Factura" },
];

type Empresa = NonNullable<Awaited<ReturnType<typeof leerEmpresa>>>;

const fecha = new Intl.DateTimeFormat("es-HN", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function formatoRtn(rtn: string | null) {
  return rtn && rtn.length === 14 ? `${rtn.slice(0, 4)}-${rtn.slice(4, 8)}-${rtn.slice(8)}` : "Sin RTN";
}

/**
 * Taller: datos de la empresa activa, su apariencia (logo, fondo, tema) y el
 * formato de sus facturas. Editan dueño y administradores; el resto solo ve Datos.
 */
export function ModuloTaller() {
  const { empresa, rol, usuario } = useSesion();
  const { identidad } = useIdentidad();
  const router = useRouter();
  const api = useApi("empresa");
  const [pestana, setPestana] = useState<Pestana>("datos");
  const [datos, setDatos] = useState<Empresa | null>(null);
  const [error, setError] = useState(false);
  const editable = rol === "dueno" || rol === "admin";
  const [cargando, setCargando] = useState(false);
  const [demo, setDemo] = useState<ResultadoDemo | null>(null);

  async function cargarDemo() {
    setCargando(true);
    setDemo(null);
    const r = await api.cargarDemo().catch(() => ({
      ok: false as const,
      error: "Sin conexión. Intentá de nuevo.",
    }));
    setDemo(r);
    setCargando(false);
  }

  useEffect(() => {
    let vivo = true;
    api
      .leer()
      .then((d) => {
        if (!vivo) return;
        if (d) setDatos(d);
        else setError(true);
      })
      .catch(() => vivo && setError(true));
    return () => {
      vivo = false;
    };
  }, [api, empresa?.id]);

  return (
    <div className={styles.hojaModulo}>
      <header className={styles.ficha}>
        {identidad.logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={identidad.logo} alt="" className={idStyles.fichaLogo} />
        )}
        <p className={styles.fichaEtiqueta}>Tu taller</p>
        <h3 className={styles.fichaTitulo}>{datos?.nombre ?? empresa?.nombre}</h3>
        <dl className={styles.fichaDatos}>
          <div>
            <dt>RTN</dt>
            <dd>{datos ? formatoRtn(datos.rtn) : error ? "—" : "…"}</dd>
          </div>
          <div>
            <dt>Tu rol</dt>
            <dd>{ROLES.find((r) => r.valor === rol)?.etiqueta ?? "—"}</dd>
          </div>
          <div>
            <dt>En Wake Parts desde</dt>
            <dd>{datos ? fecha.format(new Date(datos.creado_en)) : error ? "—" : "…"}</dd>
          </div>
        </dl>
      </header>

      {editable && (
        <div className={idStyles.pestanas} role="tablist" aria-label="Secciones del taller">
          {PESTANAS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              id={`taller-${p.id}`}
              aria-selected={pestana === p.id}
              aria-controls={`taller-panel-${p.id}`}
              className={idStyles.pestana}
              onClick={() => setPestana(p.id)}
            >
              {p.nombre}
            </button>
          ))}
        </div>
      )}

      {pestana === "apariencia" && editable && empresa && (
        <div
          role="tabpanel"
          id="taller-panel-apariencia"
          aria-labelledby="taller-apariencia"
          className={idStyles.panel}
        >
          <AparienciaEmpresa nombreEmpresa={datos?.nombre ?? empresa.nombre} paletaGuardada={empresa.paleta} />
        </div>
      )}

      {pestana === "factura" && editable && (
        <div role="tabpanel" id="taller-panel-factura" aria-labelledby="taller-factura" className={idStyles.panel}>
          <EditorFormato
            emisor={{
              nombre: datos?.nombre ?? empresa?.nombre,
              razon_social: datos?.razon_social,
              rtn: datos?.rtn,
              telefono: datos?.telefono,
              correo: datos?.correo,
              direccion: datos?.direccion,
            }}
            vendedor={usuario.nombre}
          />
        </div>
      )}

      {pestana === "datos" && (
        <section
          className={styles.fichaCuerpo}
          role={editable ? "tabpanel" : undefined}
          id="taller-panel-datos"
          aria-labelledby={editable ? "taller-datos" : undefined}
        >
          {error && <p className={styles.aviso}>No se pudieron cargar los datos del taller.</p>}
          {!datos && !error && <div className={styles.cargando} aria-label="Cargando" />}
          {datos && (
            <>
              {!editable && (
                <p className={styles.aviso}>Solo el dueño o un administrador pueden cambiar estos datos.</p>
              )}
              <Formulario
                key={empresa?.id}
                campos={CAMPOS_TALLER}
                valoresIniciales={datos}
                soloLectura={!editable}
                textoGuardar="Guardar cambios"
                onGuardar={async (valores) => {
                  const r = await api.actualizar(valores);
                  if (r.ok) {
                    setDatos((d) => (d ? { ...d, ...(valores as Partial<Empresa>) } : d));
                    router.refresh();
                  }
                  return r;
                }}
              />
            </>
          )}
          {editable && (
            <div className={styles.bloque}>
              <p className={ui.etiquetaSeccion}>Datos de ejemplo</p>
              <div className={styles.bloqueFila}>
                <div>
                  <p className={styles.bloqueTitulo}>Productos para probar</p>
                  <p className={styles.bloqueTexto}>
                    Carga 45 repuestos, lubricantes y servicios con precios, existencias y vehículos (Corolla, Hilux,
                    Civic, Frontier…), más 3 clientes. No borra ni cambia nada tuyo; si ya están, no los repite.
                  </p>
                </div>
                <button type="button" className={ui.boton} disabled={cargando} onClick={cargarDemo}>
                  {cargando ? "Cargando…" : "Cargar datos de ejemplo"}
                </button>
              </div>
              {demo && (
                <p className={demo.ok ? styles.avisoOk : styles.aviso} role="status">
                  {!demo.ok
                    ? demo.error
                    : demo.productos + demo.compatibilidades + demo.clientes === 0
                      ? "Los datos de ejemplo ya estaban cargados."
                      : `Listo: ${demo.productos} productos, ${demo.compatibilidades} compatibilidades y ${demo.clientes} clientes. Probalos en Cotizar y facturar.`}
                </p>
              )}
            </div>
          )}
          {editable && (
            <div className={styles.bloque}>
              <p className={ui.etiquetaSeccion}>Tus datos</p>
              <div className={styles.bloqueFila}>
                <ExportarDatos />
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
