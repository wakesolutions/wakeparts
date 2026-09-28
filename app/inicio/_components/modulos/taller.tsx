"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { actualizarEmpresa, leerEmpresa } from "@/app/acciones/empresa";
import { Formulario } from "@/components/formulario/formulario";
import { CAMPOS_TALLER } from "@/lib/empresa";
import { paletaValida } from "@/lib/paletas";
import { aplicarPaleta } from "@/lib/paletas-cliente";
import { ROLES } from "@/lib/recursos/equipo";
import { useSesion } from "../sesion-contexto";
import styles from "./modulos.module.css";

type Empresa = NonNullable<Awaited<ReturnType<typeof leerEmpresa>>>;

const fecha = new Intl.DateTimeFormat("es-HN", { day: "numeric", month: "long", year: "numeric" });

function formatoRtn(rtn: string | null) {
  return rtn && rtn.length === 14 ? `${rtn.slice(0, 4)}-${rtn.slice(4, 8)}-${rtn.slice(8)}` : "Sin RTN";
}

/** Datos del taller (la empresa activa). Editan dueño y administradores. */
export function ModuloTaller() {
  const { empresa, rol } = useSesion();
  const router = useRouter();
  const [datos, setDatos] = useState<Empresa | null>(null);
  const [error, setError] = useState(false);
  const editable = rol === "dueno" || rol === "admin";

  useEffect(() => {
    let vivo = true;
    leerEmpresa()
      .then((d) => {
        if (!vivo) return;
        if (d) setDatos(d);
        else setError(true);
      })
      .catch(() => vivo && setError(true));
    return () => {
      vivo = false;
    };
  }, [empresa?.id]);

  return (
    <div className={styles.hojaModulo}>
      <header className={styles.ficha}>
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

      <section className={styles.fichaCuerpo}>
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
              // La paleta se ve en vivo antes de guardar.
              onCambio={(v) => aplicarPaleta(paletaValida(String(v.paleta)))}
              onGuardar={async (valores) => {
                const r = await actualizarEmpresa(valores);
                if (r.ok) {
                  setDatos((d) => (d ? { ...d, ...(valores as Partial<Empresa>) } : d));
                  router.refresh();
                }
                return r;
              }}
            />
          </>
        )}
      </section>
    </div>
  );
}
