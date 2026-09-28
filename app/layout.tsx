import type { Metadata, Viewport } from "next";
import { Saira, JetBrains_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { COOKIE_PALETA, paletaValida } from "@/lib/paletas";
import "./globals.css";

const saira = Saira({
  variable: "--font-saira",
  subsets: ["latin"],
  axes: ["wdth"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono-wp",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Wake Parts",
  description:
    "ERP para tiendas de repuestos y yonkers: inventario, catálogo web y facturación con CAI.",
};

export const viewport: Viewport = {
  themeColor: "#121010",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const paleta = paletaValida((await cookies()).get(COOKIE_PALETA)?.value);

  return (
    <html
      lang="es"
      data-paleta={paleta}
      className={`${saira.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
