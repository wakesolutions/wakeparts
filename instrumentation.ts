import type { Instrumentation } from "next";

/**
 * Todo error del servidor (páginas, Server Actions, Route Handlers, proxy) queda
 * en `registros` con la ruta, el usuario (si había sesión) y su dispositivo.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { contextoDe, describirError, registrar, usuarioDeCookies } = await import("@/lib/registro");
  const { mensaje, pila, digest } = describirError(err);
  const cookie = request.headers.cookie;
  const usuario = usuarioDeCookies(Array.isArray(cookie) ? cookie.join("; ") : cookie);
  await registrar({
    tipo: "error",
    evento: `error.servidor.${context.routeType}`,
    mensaje,
    id_usuario: usuario?.id ?? null,
    correo: usuario?.correo ?? null,
    ruta: request.path,
    metodo: request.method,
    datos: {
      pila,
      digest,
      archivo: context.routePath,
      origen: context.routeType,
      render: "renderSource" in context ? context.renderSource : undefined,
    },
    contexto: contextoDe(request.headers),
  });
};
