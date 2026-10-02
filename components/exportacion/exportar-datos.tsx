"use client";

import { useState } from "react";
import type { Row } from "write-excel-file/browser";
import { useApi } from "@/components/datos/apis";
import ui from "@/components/ui/controles.module.css";
import { encabezado, leeme, valorCelda, type DatosExportacion } from "@/lib/exportacion";
import styles from "./exportar-datos.module.css";

type Estado =
  | { fase: "quieto" }
  | { fase: "leyendo" }
  | { fase: "armando"; hecho: number; total: number }
  | { fase: "listo"; archivo: string; filas: number; hojas: number }
  | { fase: "error"; mensaje: string };

const hoy = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Tegucigalpa" });

const slug = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "empresa";

/**
 * Taller › Tus datos: descarga un .zip con un Excel por tema (productos,
 * clientes, documentos, caja…) más un LEEME. Se arma en el navegador: el
 * servidor solo entrega las filas. Solo dueño/admin.
 */
export function ExportarDatos() {
  const api = useApi("exportacion");
  const [estado, setEstado] = useState<Estado>({ fase: "quieto" });
  const ocupado = estado.fase === "leyendo" || estado.fase === "armando";

  async function exportar() {
    setEstado({ fase: "leyendo" });
    const r = await api.datos().catch(() => ({ ok: false as const, error: "Sin conexión. Intentá de nuevo." }));
    if (!r.ok) return setEstado({ fase: "error", mensaje: r.error });
    try {
      const archivo = await armarZip(r.datos, (hecho, total) => setEstado({ fase: "armando", hecho, total }));
      setEstado({
        fase: "listo",
        archivo,
        hojas: r.datos.hojas.length,
        filas: r.datos.hojas.reduce((s, h) => s + h.filas.length, 0),
      });
    } catch (e) {
      console.error("[exportar]", e);
      setEstado({ fase: "error", mensaje: "No se pudo armar el archivo. Intentá de nuevo." });
    }
  }

  return (
    <div className={styles.exportar}>
      <div>
        <p className={styles.titulo}>Exportar todos tus datos</p>
        <p className={styles.texto}>
          Un archivo .zip con un Excel por tema: empresa, usuarios, CAI, productos, kardex, clientes, facturas y notas,
          cuentas por cobrar, abonos, caja y pedidos web. Tus datos son tuyos: bajalos cuando quieras.
        </p>
        {estado.fase === "armando" && (
          <div className={styles.progreso} role="progressbar" aria-valuemin={0} aria-valuemax={estado.total} aria-valuenow={estado.hecho}>
            <span style={{ transform: `scaleX(${estado.total ? estado.hecho / estado.total : 0})` }} />
          </div>
        )}
        {estado.fase === "listo" && (
          <p className={styles.ok} role="status">
            Listo: {estado.archivo} · {estado.hojas} archivos de Excel · {estado.filas.toLocaleString("es-HN")} filas.
          </p>
        )}
        {estado.fase === "error" && (
          <p className={styles.error} role="alert">
            {estado.mensaje}
          </p>
        )}
      </div>
      <button type="button" className={`${ui.boton} ${ui.primario}`} disabled={ocupado} onClick={exportar}>
        {estado.fase === "leyendo"
          ? "Leyendo datos…"
          : estado.fase === "armando"
            ? `Armando ${estado.hecho} de ${estado.total}…`
            : "Exportar datos (.zip)"}
      </button>
    </div>
  );
}

/** Un .xlsx por hoja + LEEME.txt, comprimidos; descarga el .zip y devuelve su nombre. */
async function armarZip(datos: DatosExportacion, avance: (hecho: number, total: number) => void) {
  const [{ default: escribir }, { zipSync, strToU8 }] = await Promise.all([
    import("write-excel-file/browser"),
    import("fflate"),
  ]);
  const archivos: Record<string, Uint8Array> = {};
  const total = datos.hojas.length;
  for (const [i, hoja] of datos.hojas.entries()) {
    avance(i, total);
    const claves = [...new Set(hoja.filas.flatMap((f) => Object.keys(f)))];
    const titulos = claves.length ? claves : ["Sin datos"];
    const filas: Row[] = [
      titulos.map((c) => ({ value: claves.length ? encabezado(c) : c, fontWeight: "bold" as const })),
      ...hoja.filas.map((f) =>
        claves.map((c) => {
          const v = valorCelda(f[c]);
          return v === null ? null : { value: v };
        }),
      ),
    ];
    const anchos = titulos.map((c) =>
      Math.min(48, Math.max(10, encabezado(c).length + 2, ...hoja.filas.slice(0, 200).map((f) => String(valorCelda(f[c]) ?? "").length + 2))),
    );
    const blob = await escribir(filas, {
      sheet: hoja.archivo.replace(/^\d+\s/, "").slice(0, 31),
      columns: anchos.map((width) => ({ width })),
      stickyRowsCount: 1,
    }).toBlob();
    archivos[`${hoja.archivo}.xlsx`] = new Uint8Array(await blob.arrayBuffer());
  }
  archivos["LEEME.txt"] = strToU8(leeme(datos));
  avance(total, total);

  const zip = zipSync(archivos, { level: 6 });
  const nombre = `wakeparts-${slug(datos.empresa)}-${hoy()}.zip`;
  const url = URL.createObjectURL(new Blob([zip as BlobPart], { type: "application/zip" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return nombre;
}
