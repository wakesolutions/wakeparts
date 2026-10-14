import {
  avisarTresDs,
  cancelarSuscripcion,
  estadoPago,
  leerSuscripcion,
  pagarSuscripcion,
  sincronizarSuscripcion,
} from "@/app/acciones/suscripcion";
import type { DatosSuscripcion, PeticionPago, ResultadoPago } from "@/lib/suscripcion";

type Resultado<T = object> = ({ ok: true } & T) | { ok: false; error: string };

/** Suscripción del taller con n1co (la demo inyecta una versión que no cobra). */
export type ApiSuscripcion = {
  leer(): Promise<Resultado<{ datos: DatosSuscripcion }>>;
  pagar(p: PeticionPago): Promise<ResultadoPago>;
  estadoPago(intento: string): Promise<ResultadoPago>;
  avisarTresDs: typeof avisarTresDs;
  cancelar(motivo: string): Promise<Resultado<{ mensaje: string }>>;
  sincronizar(): Promise<Resultado<{ mensaje: string }>>;
};

export const apiSuscripcion: ApiSuscripcion = {
  leer: leerSuscripcion,
  pagar: pagarSuscripcion,
  estadoPago,
  avisarTresDs,
  cancelar: cancelarSuscripcion,
  sincronizar: sincronizarSuscripcion,
};
