"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useVentanas } from "./contexto";
import { Ventana } from "./ventana";

type Props = {
  /** Identificador único (una ventana por id; reabrir la trae al frente). */
  id: string;
  titulo: string;
  /** Ventana madre: se minimiza y se cierra junto con ella. */
  padre?: string;
  tamano?: { w: number; h: number };
  /** Se llama al cerrarla desde el semáforo. La dueña decide desmontarla. */
  onCerrar: () => void;
  /** Al cambiar (p. ej. se eligió otro registro), la ventana vuelve al frente. */
  foco?: unknown;
  children: ReactNode;
};

/**
 * Ventana hija controlada por un componente (p. ej. el formulario de edición
 * del mantenimiento). Existe mientras el componente la renderiza: el contenido
 * vive en el árbol de React de su dueña (estado y callbacks al día) y se dibuja
 * en la capa de ventanas mediante un portal.
 *
 *   {editando && (
 *     <VentanaFlotante id="form:marcas" titulo="Editar TOYOTA" padre="mantenimiento" onCerrar={cerrar}>
 *       <Formulario … />
 *     </VentanaFlotante>
 *   )}
 */
export function VentanaFlotante({ id, titulo, padre, tamano, onCerrar, foco, children }: Props) {
  const { ventanas, capa, abrirHija, renombrar, cerrar } = useVentanas();

  // Registrar al montar y quitar al desmontar.
  useEffect(() => {
    abrirHija(id, { titulo, padre, tamano });
    return () => cerrar(id);
    // El título y el tamaño iniciales bastan; el título se actualiza abajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, padre, abrirHija, cerrar]);

  useEffect(() => {
    renombrar(id, titulo);
  }, [id, titulo, renombrar]);

  // Traer al frente (y restaurar si estaba minimizada) cuando cambia `foco`.
  useEffect(() => {
    abrirHija(id, { titulo, padre, tamano });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foco]);

  const ventana = ventanas.find((v) => v.id === id);
  if (!ventana || !capa) return null;

  return createPortal(
    <Ventana ventana={ventana} titulo={titulo} onCerrar={onCerrar}>
      {children}
    </Ventana>,
    capa,
  );
}
