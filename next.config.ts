import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Fotos de productos: se comprimen en el navegador (≈300 KB) pero se deja margen.
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
