/**
 * Reporta errores del navegador a /api/registro (→ tabla `registros`).
 * Sin dependencias ni cookies propias. Evita repetir el mismo error y pone un
 * tope por página para no inundar el registro si algo entra en bucle.
 */

const TOPE_POR_PAGINA = 20;
let enviados = 0;
const recientes = new Map<string, number>();

export function reportarError(error: unknown, extra?: Record<string, unknown>) {
  try {
    if (typeof window === "undefined" || enviados >= TOPE_POR_PAGINA) return;
    const e = error instanceof Error ? error : null;
    const mensaje = (e?.message || e?.name || String(error ?? "Error desconocido")).slice(0, 2000);
    const clave = `${mensaje}|${location.pathname}`;
    const ahora = Date.now();
    if ((recientes.get(clave) ?? 0) > ahora - 10_000) return;
    recientes.set(clave, ahora);
    enviados++;

    const cuerpo = JSON.stringify({
      mensaje,
      pila: e?.stack?.slice(0, 4000) ?? null,
      digest: (e as (Error & { digest?: string }) | null)?.digest ?? null,
      ruta: `${location.pathname}${location.search}`.slice(0, 500),
      ...extra,
    }).slice(0, 12_000);

    const blob = new Blob([cuerpo], { type: "application/json" });
    if (!navigator.sendBeacon?.("/api/registro", blob)) {
      void fetch("/api/registro", { method: "POST", body: cuerpo, keepalive: true, headers: { "Content-Type": "application/json" } });
    }
  } catch {
    // Reportar nunca debe romper la página.
  }
}
