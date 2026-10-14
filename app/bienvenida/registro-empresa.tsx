"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { crearEmpresa } from "@/app/acciones/empresa";
import { Formulario } from "@/components/formulario/formulario";
import { AceptacionLegal } from "@/components/ui/aceptacion-legal";
import { CAMPOS_REGISTRO } from "@/lib/empresa";
import { ERROR_SIN_ACEPTAR } from "@/lib/legal";
import { paletaValida } from "@/lib/paletas";
import { aplicarPaleta } from "@/lib/paletas-cliente";
import styles from "./bienvenida.module.css";

export function RegistroEmpresa() {
  const router = useRouter();
  const id = useId();
  const [acepta, setAcepta] = useState(false);
  const [sinAceptar, setSinAceptar] = useState(false);

  return (
    <div className={`wp-costura ${styles.panel}`}>
      <div className={styles.encabezado}>
        <span className={styles.paso}>01</span>
        <div>
          <p className={styles.etiqueta}>Registro</p>
          <h2 className={styles.titulo}>Datos del negocio</h2>
        </div>
      </div>

      <Formulario
        campos={CAMPOS_REGISTRO}
        textoGuardar="Entrar al tablero"
        // Vista previa en vivo de la paleta elegida
        onCambio={(v) => aplicarPaleta(paletaValida(String(v.paleta)))}
        pie={
          <AceptacionLegal
            id={`${id}-acepta`}
            marcada={acepta}
            invalida={sinAceptar}
            onCambiar={(v) => {
              setAcepta(v);
              if (v) setSinAceptar(false);
            }}
          />
        }
        onGuardar={async (valores) => {
          if (!acepta) {
            setSinAceptar(true);
            return { ok: false, error: ERROR_SIN_ACEPTAR };
          }
          const r = await crearEmpresa(valores, acepta);
          if (r.ok) {
            router.replace("/inicio");
            router.refresh();
          }
          return r;
        }}
      />
    </div>
  );
}
