import Link from "next/link";
import { Arranque } from "./_components/arranque";

const ERRORES: Record<string, string> = {
  auth: "No pudimos completar el inicio de sesión. Intentá de nuevo.",
  oauth: "Google no respondió. Revisá tu conexión e intentá otra vez.",
};

export default async function Login({ searchParams }: PageProps<"/">) {
  const { error } = await searchParams;
  const mensaje = typeof error === "string" ? ERRORES[error] : undefined;

  return (
    <main className="wp-cabina min-h-dvh overflow-hidden">
      <div className="mx-auto grid min-h-dvh max-w-[1440px] grid-cols-1 items-center gap-10 px-4 py-10 sm:px-8 lg:grid-cols-12 lg:gap-0 lg:px-14">
        <section className="lg:col-span-7">
          <p
            className="wp-entra mb-6 font-mono text-[0.7rem] tracking-[0.3em] text-wp-ink-3 uppercase"
            style={{ animationDelay: "100ms" }}
          >
            ERP · Repuestos &amp; Yonkers · Honduras
          </p>

          <h1
            className="wp-grabado text-[clamp(5.5rem,17vw,15.5rem)] leading-[0.8] font-extrabold tracking-[-0.035em] uppercase"
            style={{ fontVariationSettings: '"wdth" 58' }}
          >
            <span className="wp-linea">
              <span style={{ animationDelay: "220ms" }}>Wake</span>
            </span>
            <span className="wp-linea">
              <span style={{ animationDelay: "320ms" }}>
                Parts<span className="text-wp-accent">.</span>
              </span>
            </span>
          </h1>

          <p
            className="wp-entra mt-8 max-w-[34ch] text-lg leading-relaxed text-wp-ink-2 text-balance sm:text-xl"
            style={{ animationDelay: "520ms" }}
          >
            Inventario, catálogo web y facturación con CAI para tu tienda de
            repuestos, en un solo tablero.
          </p>

          <dl
            className="wp-entra mt-12 hidden flex-wrap gap-x-10 gap-y-4 font-mono text-[0.7rem] tracking-[0.2em] uppercase sm:flex"
            style={{ animationDelay: "700ms" }}
          >
            {[
              ["Inventario", "Piezas por vehículo"],
              ["Catálogo", "Tienda en línea"],
              ["Facturación", "CAI · SAR"],
            ].map(([t, d]) => (
              <div key={t}>
                <dt className="text-wp-accent">{t}</dt>
                <dd className="mt-1 text-wp-ink-3">{d}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="flex flex-col items-center lg:col-span-5 lg:-ml-10">
          <Arranque error={mensaje} />
          <p
            className="wp-entra mt-8 text-sm text-wp-ink-3"
            style={{ animationDelay: "1300ms" }}
          >
            El acceso es solo con tu cuenta de Google.
          </p>
          <Link
            href="/ayuda"
            className="wp-entra mt-3 font-mono text-[0.68rem] tracking-[0.2em] text-wp-ink-3 uppercase underline decoration-wp-accent/60 underline-offset-4 transition-colors hover:text-wp-ink"
            style={{ animationDelay: "1400ms" }}
          >
            Leé el manual del propietario
          </Link>
        </section>
      </div>
    </main>
  );
}
