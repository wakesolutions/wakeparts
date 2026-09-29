import { imagenOg, TAMANO_OG } from "../_publico/imagen-og";

export const alt = "Manual del propietario de Wake Parts";
export const size = TAMANO_OG;
export const contentType = "image/png";

export default function Imagen() {
  return imagenOg({ sobretitulo: "Manual del propietario", titulo: "Todo Wake Parts, capítulo por capítulo", pie: "Mostrador · Inventario · Ventas y CAI · Roles" });
}
