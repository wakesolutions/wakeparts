import type { DefCampo, Valores } from "./tipos";

/**
 * Valida y convierte los valores de un formulario según sus campos.
 * Se usa en el cliente (feedback inmediato) y en el servidor (autoridad).
 * Devuelve solo los campos que se guardan.
 */
export function validarValores(
  campos: readonly DefCampo[],
  valores: Valores,
  opciones: { edicion?: boolean } = {},
): { ok: true; datos: Valores } | { ok: false; errores: Record<string, string> } {
  const errores: Record<string, string> = {};
  const datos: Valores = {};

  for (const campo of campos) {
    if (campo.tipo === "calculado") continue;
    if (opciones.edicion && campo.soloAlCrear) continue;
    const crudo = valores[campo.nombre];
    const vacio =
      crudo === undefined ||
      crudo === null ||
      (typeof crudo === "string" && crudo.trim() === "");

    if (vacio) {
      if (campo.requerido && campo.tipo !== "booleano") {
        errores[campo.nombre] = "Obligatorio.";
      } else if (campo.guardar !== false) {
        datos[campo.nombre] = campo.tipo === "booleano" ? false : null;
      }
      continue;
    }

    let valor: unknown = crudo;

    switch (campo.tipo) {
      case "texto":
      case "textoLargo": {
        let texto = String(crudo).trim();
        if (campo.mayusculas) texto = texto.toUpperCase();
        if (campo.minusculas) texto = texto.toLowerCase();
        if (campo.maxLargo && texto.length > campo.maxLargo) {
          errores[campo.nombre] = `Máximo ${campo.maxLargo} caracteres.`;
        } else if (campo.patron && !new RegExp(campo.patron).test(texto)) {
          errores[campo.nombre] = campo.mensajePatron ?? "Formato no válido.";
        }
        valor = texto;
        break;
      }
      case "entero":
      case "decimal": {
        const n = typeof crudo === "number" ? crudo : Number(String(crudo).replace(",", "."));
        if (!Number.isFinite(n) || (campo.tipo === "entero" && !Number.isInteger(n))) {
          errores[campo.nombre] = campo.tipo === "entero" ? "Debe ser un número entero." : "Debe ser un número.";
        } else if (campo.min !== undefined && n < campo.min) {
          errores[campo.nombre] = `Mínimo ${campo.min}.`;
        } else if (campo.max !== undefined && n > campo.max) {
          errores[campo.nombre] = `Máximo ${campo.max}.`;
        }
        valor = n;
        break;
      }
      case "booleano":
        valor = crudo === true || crudo === "true";
        break;
      case "opciones": {
        const opcion = campo.opciones?.find((o) => String(o.valor) === String(crudo));
        if (campo.opciones && !opcion) errores[campo.nombre] = "Opción no válida.";
        valor = opcion?.valor ?? crudo;
        break;
      }
      case "relacion": {
        const n = Number(crudo);
        valor = Number.isFinite(n) && String(crudo).trim() !== "" ? n : crudo;
        break;
      }
      case "fecha": {
        const texto = String(crudo).slice(0, 10);
        const d = new Date(`${texto}T12:00:00Z`);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(texto) || Number.isNaN(d.getTime())) {
          errores[campo.nombre] = "Fecha no válida.";
        }
        valor = texto;
        break;
      }
    }

    if (campo.guardar !== false) datos[campo.nombre] = valor;
  }

  return Object.keys(errores).length ? { ok: false, errores } : { ok: true, datos };
}
