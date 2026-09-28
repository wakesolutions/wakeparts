import { notFound } from "next/navigation";
import { SESION_DEMO } from "../sesion-demo";
import { EscritorioDemo } from "./escritorio-demo";

/**
 * Sandbox de desarrollo: el escritorio con una sesión ficticia para revisar UI
 * sin iniciar sesión. El catálogo de vehículos es el real (lectura pública);
 * el mostrador, las fotos y la compatibilidad usan datos en memoria
 * (app/dev/datos-demo.ts). Las tablas genéricas leen como `anon`.
 */
export default function PaginaEscritorioDemo() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <EscritorioDemo sesion={SESION_DEMO}>
      <main className="flex flex-1 items-center px-4 pb-40 sm:px-10 lg:px-20">
        <p className="font-mono text-[0.7rem] tracking-[0.3em] text-wp-accent uppercase">
          Sandbox de desarrollo · sesión ficticia
        </p>
      </main>
    </EscritorioDemo>
  );
}
