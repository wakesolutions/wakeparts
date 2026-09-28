import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cerrarSesion } from "@/app/auth/actions";
import { aceptarInvitaciones, obtenerSesion } from "@/lib/sesion";
import { RegistroEmpresa } from "./registro-empresa";

export const metadata: Metadata = { title: "Tu empresa · Wake Parts" };

export default async function Bienvenida() {
  // Si alguien lo invitó mientras tanto, entra directo a esa empresa.
  await aceptarInvitaciones();
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/");
  if (sesion.empresa) redirect("/inicio");

  const primerNombre = sesion.usuario.nombre.split(" ")[0];

  return (
    <main className="wp-cabina min-h-dvh">
      <div className="mx-auto grid min-h-dvh max-w-[1440px] grid-cols-1 items-center gap-10 px-4 py-10 sm:px-8 lg:grid-cols-12 lg:gap-12 lg:px-14">
        <section className="lg:col-span-5">
          <p
            className="wp-entra font-mono text-[0.7rem] tracking-[0.3em] text-wp-accent uppercase"
            style={{ animationDelay: "100ms" }}
          >
            Bienvenido, {primerNombre}
          </p>
          <h1
            className="wp-grabado mt-5 text-[clamp(4rem,11vw,10rem)] leading-[0.8] font-extrabold tracking-[-0.035em] uppercase"
            style={{ fontVariationSettings: '"wdth" 58' }}
          >
            <span className="wp-linea">
              <span style={{ animationDelay: "200ms" }}>Tu</span>
            </span>
            <span className="wp-linea">
              <span style={{ animationDelay: "290ms" }}>
                empresa<span className="text-wp-accent">.</span>
              </span>
            </span>
          </h1>
          <p
            className="wp-entra mt-8 max-w-[38ch] text-lg leading-relaxed text-wp-ink-2 text-balance"
            style={{ animationDelay: "480ms" }}
          >
            Todo lo que registres (inventario, clientes, facturas) queda dentro de tu empresa. Solo
            el nombre es obligatorio; el resto lo podés completar después.
          </p>
          <form
            action={cerrarSesion}
            className="wp-entra mt-10 flex items-center gap-3 font-mono text-[0.7rem] tracking-[0.12em] text-wp-ink-3 uppercase"
            style={{ animationDelay: "620ms" }}
          >
            <span>{sesion.usuario.correo}</span>
            <button type="submit" className="cursor-pointer underline underline-offset-4 hover:text-wp-accent">
              No soy yo
            </button>
          </form>
        </section>

        <section className="lg:col-span-7">
          <RegistroEmpresa />
        </section>
      </div>
    </main>
  );
}
