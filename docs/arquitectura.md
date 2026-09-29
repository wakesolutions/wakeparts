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
  layout.tsx              Fuentes, <html data-paleta> leído de cookie, metadata SEO base
  globals.css             Tokens de paletas, texturas, coreografía de carga
  page.tsx                Landing pública + login (/): hero con el tacómetro «Encender»
  _components/            Arranque (tacómetro de login)
  _publico/               Piezas de las páginas públicas (encabezado, pie, secciones, JSON-LD, imagen OG)
  honduras/               /honduras y /honduras/[departamento] (18 páginas estáticas, SEO local)
  ayuda/                  Manual del propietario (público)
  robots.ts · sitemap.ts · manifest.ts · icon.svg · apple-icon.png · favicon.ico · opengraph-image.tsx
  auth/
    actions.ts            Server Actions: iniciarSesionConGoogle, cerrarSesion
    callback/route.ts     Intercambia el código OAuth por la sesión
  acciones/               Server Actions: recursos (genéricas), preferencias, empresa, perfil,
                          productos (fotos, compatibilidad), vehiculos (catálogo), ventas (mostrador),
                          inventario (entradas, importación), reportes
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
  inventario/             Entrada de inventario e importación desde Excel
  reportes/               TableroReporte genérico (indicadores, ecualizador, rankings, Excel)
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
  reportes/               DefReporte por reporte + períodos y formatos
  inventario.ts           Columnas de importación (alias), números «L 1,250.50», tipos de entradas
  sitio.ts                URL pública, textos SEO y los 18 departamentos (ISO, cabecera, ciudades)
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

## SEO y páginas públicas

- **Públicas e indexables**: `/` (landing + login), `/honduras`, `/honduras/[departamento]` (`generateStaticParams`, `dynamicParams = false`), `/ayuda` y las legales `/terminos`, `/privacidad` y `/cookies`. Deben estar en `RUTAS_PUBLICAS` del proxy, igual que `robots.txt`, `sitemap.xml`, `manifest.webmanifest`, `opengraph-image`, `twitter-image`, `icon` y `apple-icon`.
- **Privadas**: `/inicio`, `/bienvenida`, `/documentos/*` y `/dev/*` llevan `robots: { index: false }` y están en `Disallow` de `robots.txt`.
- `app/layout.tsx`: `metadataBase` = `URL_SITIO` (`NEXT_PUBLIC_SITE_URL`; en Vercel, el dominio de producción), plantilla de título «%s · Wake Parts», Open Graph `es_HN`, tarjeta grande de X, `geo.region` y `<html lang="es-HN">`. Cada página pública define su `canonical`.
- **JSON-LD** (`<JsonLd>`, sanea `<`): portada = Organization + WebSite + SoftwareApplication (con los 18 departamentos en `areaServed`) + FAQPage; departamento = BreadcrumbList + Service (área y ciudades) + FAQPage; manual = TechArticle + BreadcrumbList.
- Imágenes para redes generadas con `next/og` (`app/_publico/imagen-og.tsx`), una por página pública. Íconos: `app/icon.svg` (fuente), `favicon.ico` y PNG del manifest generados desde él con `sharp`.
- **Vitrina de capturas** (portada, sección «Así se ve por dentro»): imágenes reales del sandbox en `public/capturas/*.webp`, definidas en `app/_publico/capturas.ts` (también van al JSON-LD como `screenshot`). Si cambia la interfaz, regeneralas con `npm run dev` y luego `npm run capturas` (`scripts/capturar-landing.mjs`: `playwright-core` maneja el Chrome o Edge instalado, sin descargar navegadores; `BASE_URL`, `CHROME_PATH`).
- **Es una demo**: la portada lo aclara (nota bajo el arranque y sección `#contacto` con `BloqueDemo`: precio a convenir, soporte 24/7, ajustes a la medida, WhatsApp y correo). El contacto sale de `CONTACTO` en `lib/sitio.ts` (también en el pie, la FAQ de precio, el `contactPoint` del JSON-LD y las páginas legales); nunca escribas el número o el correo sueltos.
- **Páginas legales**: `PaginaLegal` (`app/_publico/legal.tsx`) da el marco común (h1, resumen, contacto, enlaces cruzados, JSON-LD). `PAGINAS_LEGALES` alimenta el sitemap; `LEGAL_ACTUALIZADO` es la fecha visible: cambiala al editar cualquier texto legal. Los textos no fueron revisados por un abogado.
- Un departamento nuevo o un cambio de ciudades: `DEPARTAMENTOS` en `lib/sitio.ts` (el sitemap, los enlaces y las imágenes salen de ahí). Cada departamento tiene un párrafo propio (`contexto`) para no duplicar contenido.

## Cookies y datos locales

- **Cookies (todas necesarias o de preferencia):** sesión de Supabase (`sb-…-auth-token`, hasta cerrar sesión, máx. 400 días; `…-code-verifier` solo durante el login) y `wp_paleta` (1 año). Un visitante que no inicia sesión no recibe ninguna.
- **localStorage** (no viaja al servidor): `wp:ventanas`, `wp:<módulo>:seccion`, `wp:recorrido:<usuario>`, `wp:aviso-cookies`.
- Sin analítica, publicidad ni terceros; las fuentes se sirven desde el sitio (`next/font`).
- `components/ui/aviso-cookies.tsx` (en `app/layout.tsx`): aviso **informativo** una sola vez + política en `/cookies` (pública, en sitemap). **Si se agrega una cookie o script opcional (analítica, píxeles, chat), el aviso debe pasar a pedir consentimiento ANTES de cargarlo y hay que actualizar `/cookies`.**

## Autenticación

Solo Google, vía Supabase Auth con PKCE, todo del lado del servidor:

1. `/` → formulario con Server Action `iniciarSesionConGoogle` → `supabase.auth.signInWithOAuth` → `redirect(url de Google)`. El verificador PKCE queda en cookie.
2. Google → Supabase → `GET /auth/callback?code=…` → `exchangeCodeForSession` → `/inicio`. En error → `/?error=auth`.
3. `proxy.ts` corre en cada request (menos estáticos): refresca el token con `getClaims()` y redirige:
   - sin sesión y ruta no pública → `/`
   - con sesión en `/` → `/inicio`
   - Rutas públicas: `/`, `/auth/*` y `/ayuda` (manual del propietario). **Al agregar el catálogo web público, sumarlo a `RUTAS_PUBLICAS` en `lib/supabase/proxy.ts`.**
4. `/inicio` usa `obtenerSesion()`: sin sesión → `/`; **sin empresa → `/bienvenida`** (registro obligatorio, RPC `crear_empresa`); con empresa → escritorio.
5. Las páginas protegidas vuelven a validar con `supabase.auth.getUser()`: el proxy es una comprobación optimista, no la autorización real. Cada Server Action que modifique datos debe verificar el usuario.

Configuración externa necesaria en Supabase → Authentication → URL Configuration, en Redirect URLs: `http://localhost:3000/auth/callback` y `https://wakeparts-beta.vercel.app/auth/callback`.

## Variables de entorno

| Variable | Uso |
|---|---|
| `ADMINS_PLATAFORMA` | Correos (separados por coma) que pueden editar el catálogo global. Segundo candado de la app sobre el flag `usuarios.es_admin_plataforma`; sin la variable, solo `miltonbarrientos2@gmail.com`. No es secreta. |
| `NEXT_PUBLIC_CONTACTO_WHATSAPP` | WhatsApp comercial tal como se muestra. Default `+504 8901-5974`; el enlace `wa.me` se arma con sus dígitos. |
| `NEXT_PUBLIC_CONTACTO_EMAIL` | Correo comercial. Default `ventas@wake.solutions`. |
| `NEXT_PUBLIC_RESPONSABLE` | Quién ofrece Wake Parts en `/terminos` y `/privacidad`. Default `Wake Solutions`. |
| `NEXT_PUBLIC_SITE_URL` | URL pública canónica: `metadataBase`, sitemap, robots, JSON-LD; respaldo para `redirectTo` si no hay header `host`. |
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
