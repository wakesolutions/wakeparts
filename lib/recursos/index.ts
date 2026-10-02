import * as caja from "./caja";
import * as catalogo from "./catalogo";
import * as equipo from "./equipo";
import * as inventario from "./inventario";
import * as plataforma from "./plataforma";
import * as registro from "./registro";
import type { DefRecurso } from "./tipos";
import * as ventas from "./ventas";

/**
 * Registro de recursos. Para una tabla nueva: crear su vista, su DefRecurso
 * y agregarla aquí. Ver docs/componentes.md.
 */
export const RECURSOS: Record<string, DefRecurso> = Object.fromEntries(
  [
    catalogo.marcas,
    catalogo.modelos,
    catalogo.modelosAnios,
    catalogo.tiposCarrocerias,
    catalogo.especificaciones,
    equipo.miembros,
    equipo.invitaciones,
    inventario.productos,
    inventario.movimientos,
    inventario.marcasProductos,
    inventario.categorias,
    inventario.categoriasGlobales,
    inventario.categoriasRelacionadas,
    ventas.clientes,
    ventas.puntosEmision,
    ventas.cai,
    ventas.documentos,
    ventas.pedidosWeb,
    ventas.cuentasClientes,
    ventas.pagos,
    caja.cajasTurnos,
    registro.actividad,
    registro.actividadPlataforma,
    plataforma.seguimiento,
  ].map((r) => [r.id, r]),
);

export function obtenerRecurso(id: string): DefRecurso {
  const recurso = RECURSOS[id];
  if (!recurso) throw new Error(`Recurso desconocido: ${id}`);
  return recurso;
}

/** «Nueva marca», «Nuevo modelo». */
export function textoNuevo(recurso: DefRecurso) {
  return `${recurso.genero === "f" ? "Nueva" : "Nuevo"} ${recurso.nombre}`;
}

export * from "./tipos";
