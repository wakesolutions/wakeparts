import { datosExportacion } from "@/app/acciones/exportacion";

/** Acceso a la exportación de datos de la empresa (ver components/datos/apis.tsx). */
export const apiExportacion = {
  datos: datosExportacion,
};

export type ApiExportacion = typeof apiExportacion;
