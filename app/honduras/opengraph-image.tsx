import { imagenOg, TAMANO_OG } from "../_publico/imagen-og";

export const alt = "Wake Parts en los 18 departamentos de Honduras";
export const size = TAMANO_OG;
export const contentType = "image/png";

export default function Imagen() {
  return imagenOg({ sobretitulo: "18 departamentos", titulo: "Repuestos en toda Honduras", pie: "De Ocotepeque a La Mosquitia" });
}
