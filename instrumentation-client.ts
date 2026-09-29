import { reportarError } from "@/lib/registro-cliente";

// Errores del navegador que nadie atrapó → registro de actividad.
try {
  window.addEventListener("error", (e) => {
    // Recursos que no cargaron (img, script) llegan sin error ni mensaje.
    if (!e.error && !e.message) return;
    reportarError(e.error ?? new Error(e.message), {
      origen: "window.onerror",
      archivo: e.filename ? `${e.filename}:${e.lineno}:${e.colno}` : null,
    });
  });
  window.addEventListener("unhandledrejection", (e) => {
    reportarError(e.reason, { origen: "promesa sin atrapar" });
  });
} catch {
  // Sin window (no debería pasar).
}
