# Arquitectura · Wake Parts

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js **16** (App Router, React 19, Turbopack) |
| Estilos | Tailwind CSS 4 + CSS Modules para componentes con mucho detalle visual |
| Base de datos y auth | Supabase (Postgres 15+, Auth con Google) · `@supabase/ssr` |
| Deploy | Vercel: `https://wakeparts-beta.vercel.app` |

> Next 16 difiere de versiones anteriores. Antes de usar una API, leé `node_modules/next/dist/docs/`. Cambios que ya nos afectaron: `middleware.ts` → **`proxy.ts`** (función `proxy`); `cookies()`, `headers()`, `params` y `searchParams` son **async**; los tipos globales `PageProps<"/ruta">` y `LayoutProps<"/ruta">` existen sin importarlos.

## Estructura

```
app/
  layout.tsx              Fuentes, <html data-paleta> leído de cookie
  globals.css             Tokens de paletas, texturas, coreografía de carga
  page.tsx                Login (/)
  _components/            Componentes de la página de login (arranque = tacómetro)
  auth/
    actions.ts            Server Actions: iniciarSesionConGoogle, cerrarSesion
    callback/route.ts     Intercambia el código OAuth por la sesión
  acciones/               Server Actions: recursos (genéricas), preferencias, empresa, perfil,
                          productos (fotos, compatibilidad), vehiculos (catálogo), ventas (mostrador)
  documentos/[id]/        Vista imprimible de una cotización o factura (RLS)
  bienvenida/             Onboarding: registro de la empresa (primera vez)
  inicio/                 Escritorio (ruta protegida)
    _components/          escritorio, barra-menu, dock, sesion-contexto
      modulos/            Registro MODULOS + un componente por módulo
  dev/                    Sandbox con sesión ficticia (solo desarrollo)
components/
  tabla-maestra/          TablaMaestra genérica
  formulario/             Formulario genérico + combobox de relaciones
  mantenimiento/          TablaMaestra + Formulario en ventana hija (con pestañas opcionales)
  ventas/                 Mostrador, selector de vehículo, ticket, odómetro, hoja de documento
  compatibilidad/         Editor producto ↔ vehículos
  imagenes/               Galería de fotos + compresión en el navegador
  datos/apis.tsx          useApi(): Server Actions o datos demo inyectados
  ventanas/               Gestor de ventanas estilo macOS
  ui/                     Controles base e íconos propios
lib/
  paletas.ts              Registro de paletas + cookie (paletas-cliente.ts la aplica en el DOM)
  sesion.ts               obtenerSesion(): usuario, empresa activa, rol (cacheada por request)
  empresa.ts              Campos del registro de empresa y del módulo Taller
  formato.ts              Lempiras, porcentajes, fechas (Tegucigalpa), montos en letras
  ventas.ts               Tipos del mostrador y calcularTotales (mismo redondeo que la base)
  vehiculos.ts            Tipos del catálogo de vehículos y la compatibilidad
  imagenes.ts             URL pública de Storage
  recursos/               DefRecurso por tabla, validación compartida, capa de servidor genérica
  supabase/server.ts      Cliente Supabase para servidor (uno por request)
  supabase/proxy.ts       Refresco de sesión + redirecciones
proxy.ts                  Entrada del proxy de Next
supabase/migrations/      SQL numerado, idempotente, ejecutado a mano
docs/                     Esta documentación
```

Convenciones:
- Carpetas privadas con `_` (`_components`) junto a la ruta que las usa. Cuando algo se comparta entre rutas, se mueve a `components/` en la raíz.
- Nombres de archivos, funciones y variables de dominio en español (`iniciarSesionConGoogle`, `paletaValida`). Nombres técnicos del framework, en inglés.
- Server Components por defecto; `"use client"` solo donde hay estado o eventos.

## Autenticación

Solo Google, vía Supabase Auth con PKCE, todo del lado del servidor:

1. `/` → formulario con Server Action `iniciarSesionConGoogle` → `supabase.auth.signInWithOAuth` → `redirect(url de Google)`. El verificador PKCE queda en cookie.
2. Google → Supabase → `GET /auth/callback?code=…` → `exchangeCodeForSession` → `/inicio`. En error → `/?error=auth`.
3. `proxy.ts` corre en cada request (menos estáticos): refresca el token con `getClaims()` y redirige:
   - sin sesión y ruta no pública → `/`
   - con sesión en `/` → `/inicio`
   - Rutas públicas: `/` y `/auth/*`. **Al agregar el catálogo web público, sumarlo a `RUTAS_PUBLICAS` en `lib/supabase/proxy.ts`.**
4. `/inicio` usa `obtenerSesion()`: sin sesión → `/`; **sin empresa → `/bienvenida`** (registro obligatorio, RPC `crear_empresa`); con empresa → escritorio.
5. Las páginas protegidas vuelven a validar con `supabase.auth.getUser()`: el proxy es una comprobación optimista, no la autorización real. Cada Server Action que modifique datos debe verificar el usuario.

Configuración externa necesaria en Supabase → Authentication → URL Configuration, en Redirect URLs: `http://localhost:3000/auth/callback` y `https://wakeparts-beta.vercel.app/auth/callback`.

## Variables de entorno

| Variable | Uso |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | URL pública; respaldo para `redirectTo` si no hay header `host`. |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase. |
| `SUPABASE_PUBLISHABLE_KEY` | Llave publicable. **Solo servidor** hoy. Si algún día hace falta un cliente de navegador (realtime), exponer como `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. |
| `SUPABASE_SECRET_KEY` | Llave secreta (salta RLS). Solo scripts/admin en servidor; nunca en el cliente. |

## Datos y multiempresa

**Implementado** (migración 0002): `empresas`, `usuarios`, `roles`, `empresas_usuarios` y los helpers `es_miembro`, `tiene_rol` y `es_admin_plataforma`. Los datos globales (catálogo de vehículos) solo los edita un admin de plataforma.

**Para tablas operativas nuevas**:

- Tablas operativas con `id_empresa uuid not null references empresas(id)`.
- RLS en **todas** las tablas. Política tipo: el usuario puede ver/editar filas cuyo `id_empresa` esté en sus membresías. Crear una función `public.es_miembro(id_empresa)` `security definer` y usarla en las políticas.
- Operaciones fiscales (asignar correlativo CAI) como funciones Postgres transaccionales llamadas por RPC, no como lógica en el cliente.

## Verificación

- `npx tsc --noEmit` y `npx eslint app lib proxy.ts` deben pasar.
- UI: levantar el preview (`.claude/launch.json`, config `wakeparts`) y revisar en 1440×900 y 375×812, en ambas paletas.
- Migraciones: probar con PGlite contra una copia de los datos y ejecutarlas **dos veces** (ver README de migraciones).
