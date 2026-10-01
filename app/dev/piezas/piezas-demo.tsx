"use client";

import { useState } from "react";
import { EditorCompatibilidad } from "@/components/compatibilidad/editor-compatibilidad";
import { ApisProvider } from "@/components/datos/apis";
import { GaleriaProducto } from "@/components/imagenes/galeria-producto";
import { APIS_DEMO } from "@/components/demo/datos-demo";

export function PiezasDemo() {
  const [pestana, setPestana] = useState<"vehiculos" | "fotos">("vehiculos");
  return (
    <ApisProvider valor={APIS_DEMO}>
      <main className="mx-auto grid max-w-[1000px] gap-4 px-4 py-8">
        <p className="font-mono text-[0.7rem] tracking-[0.3em] text-wp-accent uppercase">
          Sandbox · Pastillas de freno delanteras cerámicas (producto demo 1)
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={() => setPestana("vehiculos")} aria-pressed={pestana === "vehiculos"}>
            Vehículos
          </button>
          <button type="button" onClick={() => setPestana("fotos")} aria-pressed={pestana === "fotos"}>
            Fotos
          </button>
        </div>
        <div className="rounded-2xl p-5" style={{ background: "var(--wp-panel)" }}>
          {pestana === "vehiculos" ? <EditorCompatibilidad idProducto={1} editable /> : <GaleriaProducto idProducto={1} editable />}
        </div>
      </main>
    </ApisProvider>
  );
}
