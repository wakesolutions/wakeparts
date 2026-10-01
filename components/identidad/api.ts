import {
  guardarApariencia,
  guardarFormatoDocumento,
  quitarImagenEmpresa,
  subirImagenEmpresa,
} from "@/app/acciones/identidad";
import type { FormatoDocumento, TipoImagenEmpresa } from "@/lib/identidad";
import type { PaletaId } from "@/lib/paletas";

type Resultado<T = object> = ({ ok: true } & T) | { ok: false; error: string };

/** Acceso a datos de la apariencia de la empresa (el sandbox inyecta una versión en memoria). */
export type ApiIdentidad = {
  /** FormData: tipo («logo» | «fondo») y archivo (WebP ya reducido). */
  subir(datos: FormData): Promise<Resultado<{ url: string }>>;
  quitar(tipo: TipoImagenEmpresa): Promise<Resultado>;
  guardarApariencia(valores: { paleta: PaletaId; acento: string | null; atenuar: number }): Promise<Resultado>;
  guardarFormato(formato: FormatoDocumento): Promise<Resultado>;
};

export const apiIdentidad: ApiIdentidad = {
  subir: subirImagenEmpresa,
  quitar: quitarImagenEmpresa,
  guardarApariencia,
  guardarFormato: guardarFormatoDocumento,
};
