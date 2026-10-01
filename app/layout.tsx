import type { Metadata, Viewport } from "next";
import { Saira, JetBrains_Mono, Source_Serif_4 } from "next/font/google";
import { cookies } from "next/headers";
import { COOKIE_PALETA, paletaValida } from "@/lib/paletas";
import { DESCRIPCION_SITIO, LEMA, NOMBRE_SITIO, PALABRAS_CLAVE, URL_SITIO } from "@/lib/sitio";
import { AvisoCookies } from "@/components/ui/aviso-cookies";
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

// Solo para el estilo «Clásico» de facturas (Taller › Factura): sin precarga.
const serif = Source_Serif_4({
  variable: "--font-serif",
  subsets: ["latin"],
  preload: false,
});

// SEO base: cada página pública ajusta título, descripción y canónica; las
// privadas (escritorio, onboarding, documentos, sandbox) se marcan noindex.
export const metadata: Metadata = {
  metadataBase: new URL(URL_SITIO),
  title: { default: `${NOMBRE_SITIO} · ${LEMA}`, template: `%s · ${NOMBRE_SITIO}` },
  description: DESCRIPCION_SITIO,
  applicationName: NOMBRE_SITIO,
  keywords: PALABRAS_CLAVE,
  authors: [{ name: NOMBRE_SITIO, url: URL_SITIO }],
  creator: NOMBRE_SITIO,
  publisher: NOMBRE_SITIO,
  category: "business",
  alternates: { canonical: "/", languages: { "es-HN": "/" } },
  openGraph: {
    type: "website",
    locale: "es_HN",
    url: "/",
    siteName: NOMBRE_SITIO,
    title: `${NOMBRE_SITIO} · ${LEMA}`,
    description: DESCRIPCION_SITIO,
  },
  twitter: { card: "summary_large_image", title: `${NOMBRE_SITIO} · ${LEMA}`, description: DESCRIPCION_SITIO },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
  formatDetection: { telephone: false, email: false, address: false },
  other: { "geo.region": "HN", "geo.placename": "Honduras" },
};

export const viewport: Viewport = {
  themeColor: "#121010",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const paleta = paletaValida((await cookies()).get(COOKIE_PALETA)?.value);

  return (
    <html
      lang="es-HN"
      data-paleta={paleta}
      className={`${saira.variable} ${mono.variable} ${serif.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        {children}
        <AvisoCookies />
      </body>
    </html>
  );
}
