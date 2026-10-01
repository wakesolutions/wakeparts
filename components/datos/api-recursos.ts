import { actualizarEmpresa, cambiarPaletaEmpresa, cargarDatosDemo, leerEmpresa } from "@/app/acciones/empresa";
import { actualizarPerfil, leerPerfil, marcarRecorrido, restablecerTablas } from "@/app/acciones/perfil";
import { guardarPreferenciasTabla, leerPreferenciasTabla } from "@/app/acciones/preferencias";
import { accionConsultar, accionEliminar, accionGuardar, accionLeer, accionOpciones } from "@/app/acciones/recursos";

/** Tablas y formularios genéricos (TablaMaestra, MantenimientoRecurso, CampoRelacion). */
export type ApiRecursos = {
  consultar: typeof accionConsultar;
  opciones: typeof accionOpciones;
  leer: typeof accionLeer;
  guardar: typeof accionGuardar;
  eliminar: typeof accionEliminar;
  leerPreferencias: typeof leerPreferenciasTabla;
  guardarPreferencias: typeof guardarPreferenciasTabla;
};

export const apiRecursos: ApiRecursos = {
  consultar: accionConsultar,
  opciones: accionOpciones,
  leer: accionLeer,
  guardar: accionGuardar,
  eliminar: accionEliminar,
  leerPreferencias: leerPreferenciasTabla,
  guardarPreferencias: guardarPreferenciasTabla,
};

/** Datos de la empresa activa (Taller y perillas de paleta). */
export type ApiEmpresa = {
  leer: typeof leerEmpresa;
  actualizar: typeof actualizarEmpresa;
  cargarDemo: typeof cargarDatosDemo;
  cambiarPaleta: typeof cambiarPaletaEmpresa;
};

export const apiEmpresa: ApiEmpresa = {
  leer: leerEmpresa,
  actualizar: actualizarEmpresa,
  cargarDemo: cargarDatosDemo,
  cambiarPaleta: cambiarPaletaEmpresa,
};

/** Perfil del usuario (Mi usuario y el recorrido guiado). */
export type ApiPerfil = {
  leer: typeof leerPerfil;
  actualizar: typeof actualizarPerfil;
  restablecerTablas: typeof restablecerTablas;
  marcarRecorrido: typeof marcarRecorrido;
};

export const apiPerfil: ApiPerfil = {
  leer: leerPerfil,
  actualizar: actualizarPerfil,
  restablecerTablas,
  marcarRecorrido,
};
