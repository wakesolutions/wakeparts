"use client";

import { useState } from "react";
import { EditorCompatibilidad } from "@/components/compatibilidad/editor-compatibilidad";
import { GaleriaProducto } from "@/components/imagenes/galeria-producto";
import { MantenimientoRecurso } from "@/components/mantenimiento/mantenimiento-recurso";
import { ModuloTablas } from "./tablas";

/** Inventario: productos (con fotos y vehículos), kardex y catálogos de apoyo. */
export function ModuloInventario() {
  return (
    <ModuloTablas
      id="inventario"
      inicial="productos"
      secciones={[
        {
          titulo: "Inventario",
          items: [
            {
              recurso: "productos",
              descripcion:
                "Repuestos y servicios del taller. Abrí uno para agregarle fotos y decir a qué vehículos le queda.",
              contenido: ({ editable }) => <Productos editable={editable} />,
            },
            {
              recurso: "movimientos",
              descripcion: "Kardex: cada entrada y salida de existencia, con quién y por qué documento.",
            },
          ],
        },
        {
          titulo: "Catálogos",
          nota: "Las categorías son generales para todos los talleres.",
          items: [
            {
              recurso: "marcas_productos",
              descripcion: "Marcas de repuestos. Las del catálogo general ya vienen; agregá las que te falten.",
            },
            {
              recurso: "categorias",
              descripcion: "Árbol de categorías con los sinónimos de mostrador que entiende la búsqueda.",
            },
          ],
        },
      ]}
    />
  );
}

function Productos({ editable }: { editable: boolean }) {
  // Conteos vivos para las pestañas (la fila de la tabla trae los iniciales).
  const [fotos, setFotos] = useState<Record<string, number>>({});

  return (
    <MantenimientoRecurso
      recurso="productos"
      puedeEditar={editable}
      pestanas={({ clave, fila, refrescar }) => [
        {
          id: "fotos",
          titulo: "Fotos",
          contador: fotos[clave] ?? Number(fila.imagenes ?? 0),
          contenido: (
            <GaleriaProducto
              idProducto={Number(clave)}
              editable={editable}
              onCambio={(n) => {
                setFotos((f) => ({ ...f, [clave]: n }));
                refrescar();
              }}
            />
          ),
        },
        {
          id: "vehiculos",
          titulo: "Vehículos",
          contenido: <EditorCompatibilidad idProducto={Number(clave)} editable={editable} onCambio={refrescar} />,
        },
      ]}
    />
  );
}
