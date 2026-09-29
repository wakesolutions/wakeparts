import { imagenOg, TAMANO_OG } from "./_publico/imagen-og";

export const alt = "Wake Parts: inventario y facturación con CAI para repuestos y yonkers en Honduras";
export const size = TAMANO_OG;
export const contentType = "image/png";

export default function Imagen() {
  return imagenOg({
    sobretitulo: "Repuestos · Yonkers · Talleres",
    titulo: "Inventario y facturación con CAI",
    pie: "Búsqueda por vehículo · Cotizaciones · Reportes · Excel",
  });
}
