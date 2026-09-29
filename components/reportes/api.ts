import { leerReporte } from "@/app/acciones/reportes";

/** Datos de los tableros de reportes (ver components/datos/apis.tsx). */
export const apiReportes = { leer: leerReporte };

export type ApiReportes = typeof apiReportes;
