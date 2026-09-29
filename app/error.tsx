"use client";

import { PantallaError } from "./_components/pantalla-error";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <PantallaError error={error} reintentar={retry} origen="error.tsx" />;
}
