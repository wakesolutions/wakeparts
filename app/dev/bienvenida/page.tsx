import { notFound } from "next/navigation";
import { RegistroEmpresa } from "@/app/bienvenida/registro-empresa";

/** Sandbox de desarrollo del formulario de registro de empresa. */
export default function BienvenidaDemo() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <main className="wp-cabina grid min-h-dvh place-items-center px-4 py-10">
      <RegistroEmpresa />
    </main>
  );
}
