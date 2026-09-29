"use client";

import { PantallaError } from "./_components/pantalla-error";
import "./globals.css";

/** Falla del layout raíz: reemplaza todo el documento, por eso trae su html y body. */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="es-HN" data-paleta="rojo-negro">
      <body className="min-h-full antialiased">
        <title>Algo falló · Wake Parts</title>
        <PantallaError error={error} reintentar={retry} origen="global-error.tsx" />
      </body>
    </html>
  );
}
