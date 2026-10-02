# Contexto para agentes de IA · Wake Parts

Este archivo se carga en cada sesión (vía `CLAUDE.md`). Es el mapa: las reglas que no se negocian y dónde está el detalle. Leé la guía específica **antes** de tocar su área.

## Qué es

ERP web para tiendas de repuestos y **yonkers** (deshuesaderos) de pequeña y mediana escala en **Honduras**: inventario de piezas, catálogo web público y facturación con **CAI** (SAR). Multiempresa: cada usuario crea/pertenece a una empresa con su propia paleta visual.

## Mapa de documentación

| Guía | Leé antes de… |
|---|---|
| [`negocio.md`](negocio.md) | Diseñar módulos, tablas o flujos (inventario, catálogo, facturación CAI, glosario). |
| [`arquitectura.md`](arquitectura.md) | Tocar rutas, auth, Supabase, proxy, estructura de carpetas. |
| [`componentes.md`](componentes.md) | **Crear cualquier listado, formulario o módulo** (TablaMaestra, Formulario, ventanas). Incluye la receta «tabla master para X». |
| [`diseno.md`](diseno.md) | Crear o modificar cualquier UI. |
| [`database.md`](database.md) | Leer o cambiar el esquema. Es la foto actual de la base. |
| [`../supabase/migrations/README.md`](../supabase/migrations/README.md) | Escribir una migración (plantillas idempotentes). |
| [`bitacora.md`](bitacora.md) | Entender por qué algo es como es. |

## Reglas de oro

1. **Next.js 16**: leé `node_modules/next/dist/docs/` antes de usar una API. `middleware` ahora es `proxy.ts`; `cookies()`, `headers()`, `params` y `searchParams` son async.
2. **Base de datos = migraciones manuales.** Todo cambio va en `supabase/migrations/NNNN_descripcion.sql`, **idempotente** y dentro de `begin; … commit;`. Al terminar, decile al usuario exactamente qué archivo ejecutar en el SQL Editor de Supabase. Nunca edites una migración ya aplicada (salvo para hacerla idempotente sin cambiar su efecto).
3. **Antes de una migración que toca datos, mirá los datos reales** (lectura vía REST con la llave secreta de `.env.local`) y, si podés, probala dos veces en PGlite con una copia. Las tablas del catálogo tienen ~17 000 filas reales.
4. **Documentá mientras trabajás**: si cambiás el esquema actualizá `database.md` y el registro de migraciones; si tomás una decisión de negocio/diseño/arquitectura, agregá una entrada a `bitacora.md`. Si cambiás algo que ve el usuario (módulo, atajo, regla, permiso), actualizá el **manual del propietario** en `app/ayuda/page.tsx` (y el recorrido guiado si cambia el mostrador o el dock).
5. **Cookies**: hoy solo necesarias (sesión) y `wp_paleta`, con aviso informativo y política en `/cookies`. Si agregás analítica, píxeles o cualquier cookie/script opcional, primero convertí el aviso en consentimiento previo y actualizá `/cookies` (ver `arquitectura.md` › Cookies).
6. **Registro de actividad**: los errores y eventos nuevos se registran con `registrar()` de `lib/registro.ts` (nunca lanza). Una tabla de negocio nueva lleva el trigger `zz_registrar_cambio`. No agregues cookies ni identificadores de visitante para el registro (rompería la regla 5).
7. **Secretos**: `.env.local`, `dotenv-for-claude.txt` y `keys/` nunca se commitean ni se muestran en respuestas. La llave publicable de Supabase se usa solo en servidor.
8. **Multiempresa**: toda tabla operativa (productos, clientes, facturas…) lleva `id_empresa` + RLS por membresía. El catálogo de vehículos es global.
9. **Idioma**: UI, esquema y docs en español (voseo hondureño en textos de UI: «Intentá», «Revisá»). Esquema en `snake_case`, FKs `id_<entidad>`.
10. **Reutilizar, no duplicar**: todo listado usa `TablaMaestra` y todo alta/edición usa `Formulario` vía una `DefRecurso`. Nada de tablas o formularios hechos a mano por pantalla. En el escritorio, **ningún componente importa una Server Action directo**: todo dato pasa por `useApi()` (`components/datos/apis.tsx`) y tiene su versión en `components/demo/datos-demo.ts`, o la demo pública `/demo` se rompe.
11. **Verificar la UI** en el sandbox `/dev/escritorio` y `/dev/bienvenida` (sesión ficticia, solo desarrollo), porque un agente no puede iniciar sesión con Google.
12. **Diseño**: skeuomórfico de cabina automotriz; solo tokens `--wp-*`, nunca colores sueltos; easing de `--ease-*` (sin rebotes); respetar `prefers-reduced-motion`.
13. **Facturación CAI es legal/fiscal**: no inventes reglas. Lo marcado «a verificar» en `negocio.md` debe confirmarse con el usuario antes de implementarse.

## Estado actual (actualizar al cerrar cada hito)

- ✅ Login solo con Google (Supabase OAuth, PKCE) → `/inicio`.
- ✅ Multiempresa: `empresas`, `usuarios` (sincronizado con auth), `roles`, membresías. El onboarding `/bienvenida` obliga a registrar la empresa la primera vez.
- ✅ Paleta por empresa (la cambian dueño/admin desde la barra de menú; la cookie es solo caché).
- ✅ Escritorio con ventanas estilo macOS (hijas, pantalla completa, mosaicos en el dock). Módulos: **Inicio**, **Cotizar y facturar** (mostrador), **Inventario** (productos con fotos y vehículos, kardex, marcas, categorías), **Ventas** (documentos, pedidos web, clientes, CAI), **Sitio web** (dueño/admin), **Mantenimiento** (catálogos globales), **Usuarios** (solo dueño/admin), **Actividad** (registro; dueño/admin y admin de plataforma), **Taller** (datos, apariencia y formato de factura de la empresa) y **Mi usuario** (desde el nombre en la barra).
- ✅ Productos (0004): árbol de categorías con sinónimos y relacionadas, marcas de repuestos, utilidad/margen, kardex, fotos en Storage, compatibilidad con vehículos, `buscar_productos()` (sirve también para el catálogo web).
- ✅ Ventas (0005): carritos, cotizaciones y facturas con CAI, descuentos con tope por rol, anulación, impresión en `/documentos/[id]`. Reglas fiscales marcadas «a confirmar» en `negocio.md` §3.5.
- ✅ Recorrido guiado del escritorio (primera vez; se repite desde Mi usuario) y opción de datos de ejemplo al registrar la empresa. Pasos en `app/inicio/_components/recorrido/pasos.tsx`, anclados con `data-recorrido`.
- ✅ Reporte de ventas (Ventas › Análisis) sobre el tablero genérico `TableroReporte` (receta en `componentes.md` › Reportes); entradas de inventario y importación desde Excel (Inventario › Productos). Migración 0009.
- ✅ La landing se presenta como **demo** con contacto comercial (`CONTACTO` en `lib/sitio.ts`, vía `.env`) y páginas legales `/terminos`, `/privacidad`, `/cookies` (textos sin revisión legal).
- ✅ SEO: landing en `/`, `/honduras` + 18 departamentos, robots, sitemap, manifest, íconos, imágenes OG, JSON-LD; privadas con noindex (ver `arquitectura.md` › SEO).
- ✅ Manual del propietario en `/ayuda` (público): explica todos los módulos con piezas reales (marco de ventana, dock, odómetro). Enlaces en la portada y en la barra de menú.
- ✅ Componentes genéricos: TablaMaestra (filtros, orden múltiple, columnas guardadas por usuario) y Formulario (relaciones en cascada).
- ✅ Mantenimiento del catálogo de vehículos (marcas, modelos, años, carrocerías, especificaciones) y de categorías generales; edición solo para el admin de plataforma (flag en la base + `ADMINS_PLATAFORMA`). Las empresas crean categorías y marcas **propias** (0010).
- ✅ **Registro de actividad** (0011): visitas (anónimas incluidas), sesiones con IP y dispositivo, errores del servidor y del navegador, y auditoría de cambios por trigger; módulo **Actividad** (dueño/admin: su empresa; admin de plataforma: todo). Ver `arquitectura.md` › Registro de actividad.
- ✅ **Identidad por empresa** (0012): logo, fondo del escritorio con velo y «Restablecer», tema (base + color de marca) y editor visual del formato de factura con vista previa; lo fiscal no se puede ocultar. Taller tiene pestañas Datos · Apariencia · Factura. Ver `diseno.md` › Identidad.
- ✅ **Catálogo web por empresa** (0013): `/t/<slug>` con portada, catálogo por vehículo, ficha, Nosotros y lista → **pedido web** que el vendedor atiende en Ventas › Pedidos web (se vuelve carrito). Módulo **Sitio web** (dueño/admin) para dirección, publicación, textos, fotos, destacados y precios. `/t/demo` en desarrollo. Ver `negocio.md` §3.4 y `database.md` › Sitio web.
- ✅ **Notificaciones** (0014): campanita en la barra (Por atender / Recientes), aviso emergente e insignias en el dock; los pedidos web son tareas que se crean y resuelven solas por trigger. Genérico para nuevas fuentes. Ver `database.md` › Notificaciones y `arquitectura.md` › Notificaciones.
- ✅ **Demo pública `/demo`** sin cuenta: el escritorio real con datos en memoria (todo pasa por `useApi()`, incluidas tablas genéricas, empresa y perfil). Landing con «Probar demo», sección del sitio web, capturas nuevas y ayuda por WhatsApp. Ver `arquitectura.md` › Demo pública.
- ✅ **Seguimiento** (0015, solo admin de plataforma): talleres registrados, su etapa y mensajes listos para WhatsApp/correo.
- ✅ **Notas de crédito/débito, devoluciones, exoneraciones y puntos de emisión** (0016): sucursales y cajas con CAI por punto y tipo (01/06/07), punto por persona, editor de notas con medidor de saldo, factura exonerada desde el mostrador. Ver `negocio.md` §3.7.
- ✅ **Crédito y cuentas por cobrar** (0017): crédito por cliente (dueño/admin), Contado/Crédito en el ticket, tablero de cartera con antigüedad de saldos, estado de cuenta con abonos repartidos y recibos `REC-` imprimibles (`/recibos/[id]`). Ver `negocio.md` §3.8.
- ✅ Migraciones 0000–0016 aplicadas (el usuario siempre corre las nuevas); **0017 pendiente**. La empresa del usuario tiene datos de prueba (45 productos, compatibilidades, 3 clientes; sin CAI). Otras empresas los cargan con el botón «Cargar datos de ejemplo» de Taller (`cargar_datos_demo`, 0007).
- ⏭️ Siguiente (pedido del usuario): módulo de Caja (apertura, cierre y arqueo del día con contado + abonos; que el reporte reste notas de crédito); ticket de 80 mm. Después: notificación de CAI por vencer; dominio propio por taller.
