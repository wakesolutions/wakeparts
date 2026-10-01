"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import type { leerPerfil } from "@/app/acciones/perfil";
import { useApi } from "@/components/datos/apis";
import { cerrarSesion } from "@/app/auth/actions";
import { Formulario } from "@/components/formulario/formulario";
import { olvidarPreferenciasTablas } from "@/components/tabla-maestra/tabla-maestra";
import ui from "@/components/ui/controles.module.css";
import { CAMPOS_PERFIL } from "@/lib/perfil";
import { ROLES } from "@/lib/recursos/equipo";
import type { DefCampo } from "@/lib/recursos/tipos";
import { useRecorrido } from "../recorrido/recorrido";
import { useSesion } from "../sesion-contexto";
import styles from "./modulos.module.css";

type Perfil = NonNullable<Awaited<ReturnType<typeof leerPerfil>>>;

const etiquetaRol = (rol: string | null) => ROLES.find((r) => r.valor === rol)?.etiqueta ?? "—";

/** Perfil propio: nombre, teléfono, empresa activa y preferencias. */
export function ModuloMiUsuario() {
  const sesion = useSesion();
  const router = useRouter();
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [trabajando, iniciar] = useTransition();
  const recorrido = useRecorrido();
  const api = useApi("perfil");

  useEffect(() => {
    let vivo = true;
    const respaldo: Perfil = {
      nombre: sesion.usuario.nombre,
      telefono: null,
      id_empresa_activa: sesion.empresa?.id ?? null,
      creado_en: "",
    };
    api.leer()
      .catch(() => null)
      .then((p) => vivo && setPerfil(p ?? respaldo));
    return () => {
      vivo = false;
    };
  }, [api, sesion.usuario.nombre, sesion.empresa?.id]);

  // Con más de una empresa, se puede elegir con cuál trabajar.
  const campos = useMemo<readonly DefCampo[]>(
    () =>
      sesion.empresas.length > 1
        ? [
            ...CAMPOS_PERFIL,
            {
              nombre: "id_empresa_activa",
              etiqueta: "Empresa con la que trabajás",
              tipo: "opciones",
              requerido: true,
              presentacion: sesion.empresas.length <= 4 ? "tarjetas" : "lista",
              ancho: "completo",
              opciones: sesion.empresas.map((e) => ({ valor: e.id, etiqueta: `${e.nombre} · ${etiquetaRol(e.rol)}` })),
            },
          ]
        : CAMPOS_PERFIL,
    [sesion.empresas],
  );

  const iniciales = sesion.usuario.nombre
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  return (
    <div className={styles.hojaModulo}>
      <header className={`${styles.ficha} ${styles.fichaPerfil}`}>
        <span className={styles.retrato}>
          {sesion.usuario.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={sesion.usuario.avatar} alt="" referrerPolicy="no-referrer" />
          ) : (
            iniciales
          )}
        </span>
        <div>
          <p className={styles.fichaEtiqueta}>Mi usuario</p>
          <h3 className={styles.fichaTitulo}>{perfil?.nombre ?? sesion.usuario.nombre}</h3>
          <p className={styles.fichaCorreo}>{sesion.usuario.correo}</p>
          <ul className={styles.insignias}>
            <li>{etiquetaRol(sesion.rol)} · {sesion.empresa?.nombre}</li>
            {sesion.usuario.esAdminPlataforma && <li data-tono="acento">Admin de plataforma</li>}
          </ul>
        </div>
      </header>

      <section className={styles.fichaCuerpo}>
        {!perfil ? (
          <div className={styles.cargando} aria-label="Cargando" />
        ) : (
          <Formulario
            campos={campos}
            valoresIniciales={perfil}
            textoGuardar="Guardar perfil"
            onGuardar={async (valores) => {
              const r = await api.actualizar(valores);
              if (r.ok) {
                setPerfil((p) => (p ? { ...p, ...(valores as Partial<Perfil>) } : p));
                setAviso("Perfil guardado.");
                router.refresh();
              }
              return r;
            }}
          />
        )}

        <div className={styles.bloque}>
          <p className={ui.etiquetaSeccion}>Preferencias</p>
          <div className={styles.bloqueFila}>
            <div>
              <p className={styles.bloqueTitulo}>Tablas</p>
              <p className={styles.bloqueTexto}>
                Volver a las columnas, anchos y orden originales en todas las tablas.
              </p>
            </div>
            <button
              type="button"
              className={ui.boton}
              disabled={trabajando}
              onClick={() =>
                iniciar(async () => {
                  const r = await api.restablecerTablas();
                  if (r.ok) olvidarPreferenciasTablas();
                  setAviso(r.ok ? "Tablas restablecidas." : "No se pudieron restablecer las tablas.");
                })
              }
            >
              Restablecer
            </button>
          </div>
          <div className={styles.bloqueFila}>
            <div>
              <p className={styles.bloqueTitulo}>Recorrido guiado</p>
              <p className={styles.bloqueTexto}>
                Volver a ver el paseo por lo básico: cotizar, facturar, inventario y ventas. ¿Dudas puntuales? Leé el{" "}
                <a href="/ayuda" target="_blank" rel="noopener" className="underline underline-offset-2">
                  manual
                </a>
                .
              </p>
            </div>
            <button type="button" className={ui.boton} onClick={recorrido.iniciar}>
              Repetir recorrido
            </button>
          </div>
          <div className={styles.bloqueFila}>
            <div>
              <p className={styles.bloqueTitulo}>Sesión</p>
              <p className={styles.bloqueTexto}>Cerrar la sesión en este equipo.</p>
            </div>
            {sesion.demo ? (
              <Link href="/" className={`${ui.boton} ${ui.peligro}`}>
                Salir de la demo
              </Link>
            ) : (
              <form action={cerrarSesion}>
                <button type="submit" className={`${ui.boton} ${ui.peligro}`}>
                  Cerrar sesión
                </button>
              </form>
            )}
          </div>
          {aviso && (
            <p className={styles.avisoOk} role="status">
              {aviso}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
