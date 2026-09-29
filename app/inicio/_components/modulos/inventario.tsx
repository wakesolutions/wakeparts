"use client";

import { useState } from "react";
import { EditorCompatibilidad } from "@/components/compatibilidad/editor-compatibilidad";
import { GaleriaProducto } from "@/components/imagenes/galeria-producto";
import { EntradaInventario } from "@/components/inventario/entrada-inventario";
import { ImportarProductos } from "@/components/inventario/importar-productos";
import { MantenimientoRecurso } from "@/components/mantenimiento/mantenimiento-recurso";
import ui from "@/components/ui/controles.module.css";
import { IconoDocumento, IconoMas } from "@/components/ui/iconos";
import { useVentanaActual } from "@/components/ventanas/ventana";
import { VentanaFlotante } from "@/components/ventanas/ventana-flotante";
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
  const [herramienta, setHerramienta] = useState<"entrada" | "importar" | null>(null);
  const [version, setVersion] = useState(0);
  const madre = useVentanaActual() ?? undefined;
  const recargarTabla = () => setVersion((v) => v + 1);

  return (
    <>
      <MantenimientoRecurso
        recurso="productos"
        puedeEditar={editable}
        version={version}
        acciones={
          editable && (
            <>
              <button
                type="button"
                className={ui.boton}
                onClick={() => setHerramienta("entrada")}
                title="Sumar existencias de una compra o conteo"
              >
                <IconoMas tamano={13} /> Entrada
              </button>
              <button
                type="button"
                className={ui.boton}
                onClick={() => setHerramienta("importar")}
                title="Crear o actualizar productos desde un Excel"
              >
                <IconoDocumento tamano={13} /> Importar
              </button>
            </>
          )
        }
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
      {herramienta === "entrada" && (
        <VentanaFlotante
          id="inventario:entrada"
          titulo="Entrada de inventario"
          padre={madre}
          tamano={{ w: 860, h: 640 }}
          onCerrar={() => setHerramienta(null)}
        >
          <EntradaInventario onListo={recargarTabla} />
        </VentanaFlotante>
      )}
      {herramienta === "importar" && (
        <VentanaFlotante
          id="inventario:importar"
          titulo="Importar productos"
          padre={madre}
          tamano={{ w: 900, h: 700 }}
          onCerrar={() => setHerramienta(null)}
        >
          <ImportarProductos onListo={recargarTabla} />
        </VentanaFlotante>
      )}
    </>
  );
}
