"use client";

import { useRouter } from "next/navigation";
import { crearEmpresa } from "@/app/acciones/empresa";
import { Formulario } from "@/components/formulario/formulario";
import { CAMPOS_REGISTRO } from "@/lib/empresa";
import { paletaValida } from "@/lib/paletas";
import { aplicarPaleta } from "@/lib/paletas-cliente";
import styles from "./bienvenida.module.css";

export function RegistroEmpresa() {
  const router = useRouter();

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
        textoGuardar="Encender tablero"
        // Vista previa en vivo de la paleta elegida
        onCambio={(v) => aplicarPaleta(paletaValida(String(v.paleta)))}
        onGuardar={async (valores) => {
          const r = await crearEmpresa(valores);
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
