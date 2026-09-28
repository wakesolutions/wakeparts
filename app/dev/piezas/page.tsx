import { notFound } from "next/navigation";
import { PiezasDemo } from "./piezas-demo";

/** Sandbox de piezas sueltas: fotos y compatibilidad de un producto demo. */
export default function PaginaPiezas() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <PiezasDemo />;
}
