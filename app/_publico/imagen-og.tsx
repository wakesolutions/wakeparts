import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const TAMANO_OG = { width: 1200, height: 630 };

/**
 * Imagen para redes (Open Graph / X): cabina oscura, título grabado y la
 * placa de la marca. Sin fuentes externas: usa la tipografía por defecto de next/og.
 */
export async function imagenOg({ sobretitulo, titulo, pie }: { sobretitulo: string; titulo: string; pie: string }) {
  const icono = await readFile(join(process.cwd(), "app/icon.svg"), "utf8");
  const icon = `data:image/svg+xml;base64,${Buffer.from(icono).toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          color: "#f3ede6",
          background:
            "radial-gradient(90% 90% at 85% 20%, rgba(213,18,30,0.38), transparent 60%), radial-gradient(140% 120% at 50% 50%, #1b1717 40%, #0b0909)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={icon} width={72} height={72} alt="" />
          <div style={{ display: "flex", fontSize: 30, fontWeight: 700, letterSpacing: 2 }}>
            WAKE<span style={{ color: "#ff3b3f" }}>PARTS</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 24, letterSpacing: 8, color: "#ff3b3f", textTransform: "uppercase" }}>{sobretitulo}</div>
          <div style={{ fontSize: titulo.length > 38 ? 70 : 88, fontWeight: 700, lineHeight: 1, letterSpacing: -2, textTransform: "uppercase", maxWidth: 1000 }}>
            {titulo}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: 24,
            borderTop: "2px solid rgba(255,255,255,0.12)",
            fontSize: 24,
            color: "#b9aea6",
          }}
        >
          <span>{pie}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 10, color: "#f3ede6" }}>
            <span style={{ width: 14, height: 14, borderRadius: 7, background: "#3ccf7a", boxShadow: "0 0 12px #3ccf7a" }} />
            Hecho en Honduras
          </span>
        </div>
      </div>
    ),
    TAMANO_OG,
  );
}
