import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { recorridoPendiente } from "@/app/acciones/perfil";
import { LogoEmpresa } from "@/components/identidad/logo-empresa";
import { aceptarInvitaciones, obtenerSesion } from "@/lib/sesion";
import { Escritorio } from "./_components/escritorio";

export const metadata: Metadata = { title: "Inicio", robots: { index: false, follow: false } };

function saludo() {
  const hora = Number(
    new Intl.DateTimeFormat("es-HN", {
      hour: "numeric",
      hour12: false,
      timeZone: "America/Tegucigalpa",
    }).format(new Date()),
  );
  if (hora < 12) return "Buenos días";
  if (hora < 19) return "Buenas tardes";
  return "Buenas noches";
}

export default async function Inicio() {
  await aceptarInvitaciones();
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/");
  if (!sesion.empresa) redirect("/bienvenida");

  const primerNombre = sesion.usuario.nombre.split(" ")[0];
  const recorrido = await recorridoPendiente();

  return (
    <Escritorio sesion={sesion} recorrido={recorrido}>
      <main className="flex flex-1 items-center px-4 pb-40 sm:px-10 lg:px-20">
        <div>
          <LogoEmpresa className="wp-entra mb-6 h-[clamp(3rem,8vw,5.5rem)] w-auto max-w-[min(60vw,20rem)] object-contain" />
          <p
            className="wp-entra font-mono text-[0.7rem] tracking-[0.3em] text-wp-accent uppercase"
            style={{ animationDelay: "150ms" }}
          >
            {saludo()} · {sesion.empresa.nombre}
          </p>
          <h1
            className="wp-grabado mt-3 text-[clamp(3.5rem,10vw,9rem)] leading-[0.85] font-extrabold tracking-[-0.03em] uppercase"
            style={{ fontVariationSettings: '"wdth" 62' }}
          >
            <span className="wp-linea">
              <span style={{ animationDelay: "250ms" }}>{primerNombre}</span>
            </span>
          </h1>
          <p
            className="wp-entra mt-6 max-w-[40ch] text-base leading-relaxed text-wp-ink-2 sm:text-lg"
            style={{ animationDelay: "450ms" }}
          >
            Abrí un módulo desde el dock. Para atender a un cliente, empezá por Cotizar y facturar.
          </p>
        </div>
      </main>
    </Escritorio>
  );
}
