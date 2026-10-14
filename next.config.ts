import type { NextConfig } from "next";

/**
 * Cabeceras de seguridad para todo el sitio.
 * - frame-ancestors / X-Frame-Options: nadie de afuera puede meter Wake Parts en
 *   un iframe (clickjacking). No afecta el 3D Secure: ahí es n1co quien va
 *   dentro de un iframe nuestro, no al revés.
 * - Permissions-Policy: cámara solo para nuestro origen (Toma rápida); el resto
 *   de sensores apagados.
 * Si algún día se agrega una CSP completa (scripts, estilos), probarla primero
 * como Content-Security-Policy-Report-Only.
 */
const CABECERAS_SEGURIDAD = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), browsing-topics=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // Fotos de productos: se comprimen en el navegador (≈300 KB) pero se deja margen.
      bodySizeLimit: "8mb",
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: CABECERAS_SEGURIDAD }];
  },
};

export default nextConfig;
