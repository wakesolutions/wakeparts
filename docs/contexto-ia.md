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
4. **Documentá mientras trabajás**: si cambiás el esquema actualizá `database.md` y el registro de migraciones; si tomás una decisión de negocio/diseño/arquitectura, agregá una entrada a `bitacora.md`. Si cambiás algo que ve el usuario (módulo, atajo, regla, permiso), actualizá el **manual del propietario** en `app/ayuda/page.tsx`.
5. **Secretos**: `.env.local`, `dotenv-for-claude.txt` y `keys/` nunca se commitean ni se muestran en respuestas. La llave publicable de Supabase se usa solo en servidor.
6. **Multiempresa**: toda tabla operativa (productos, clientes, facturas…) lleva `id_empresa` + RLS por membresía. El catálogo de vehículos es global.
7. **Idioma**: UI, esquema y docs en español (voseo hondureño en textos de UI: «Intentá», «Revisá»). Esquema en `snake_case`, FKs `id_<entidad>`.
8. **Reutilizar, no duplicar**: todo listado usa `TablaMaestra` y todo alta/edición usa `Formulario` vía una `DefRecurso`. Nada de tablas o formularios hechos a mano por pantalla.
9. **Verificar la UI** en el sandbox `/dev/escritorio` y `/dev/bienvenida` (sesión ficticia, solo desarrollo), porque un agente no puede iniciar sesión con Google.
10. **Diseño**: skeuomórfico de cabina automotriz; solo tokens `--wp-*`, nunca colores sueltos; easing de `--ease-*` (sin rebotes); respetar `prefers-reduced-motion`.
11. **Facturación CAI es legal/fiscal**: no inventes reglas. Lo marcado «a verificar» en `negocio.md` debe confirmarse con el usuario antes de implementarse.

## Estado actual (actualizar al cerrar cada hito)

- ✅ Login solo con Google (Supabase OAuth, PKCE) → `/inicio`.
- ✅ Multiempresa: `empresas`, `usuarios` (sincronizado con auth), `roles`, membresías. El onboarding `/bienvenida` obliga a registrar la empresa la primera vez.
- ✅ Paleta por empresa (la cambian dueño/admin desde la barra de menú; la cookie es solo caché).
- ✅ Escritorio con ventanas estilo macOS (hijas, pantalla completa, mosaicos en el dock). Módulos: **Inicio**, **Cotizar y facturar** (mostrador), **Inventario** (productos con fotos y vehículos, kardex, marcas, categorías), **Ventas** (documentos, clientes, CAI), **Mantenimiento** (catálogos globales), **Usuarios** (solo dueño/admin), **Taller** (datos de la empresa + tope de descuento) y **Mi usuario** (desde el nombre en la barra).
- ✅ Productos (0004): árbol de categorías con sinónimos y relacionadas, marcas de repuestos, utilidad/margen, kardex, fotos en Storage, compatibilidad con vehículos, `buscar_productos()` (sirve también para el catálogo web).
- ✅ Ventas (0005): carritos, cotizaciones y facturas con CAI, descuentos con tope por rol, anulación, impresión en `/documentos/[id]`. Reglas fiscales marcadas «a confirmar» en `negocio.md` §3.5.
- ✅ Manual del propietario en `/ayuda` (público): explica todos los módulos con piezas reales (marco de ventana, dock, odómetro). Enlaces en la portada y en la barra de menú.
- ✅ Componentes genéricos: TablaMaestra (filtros, orden múltiple, columnas guardadas por usuario) y Formulario (relaciones en cascada).
- ✅ Mantenimiento del catálogo de vehículos (marcas, modelos, años, carrocerías, especificaciones); edición solo para admin de plataforma.
- ✅ Migraciones 0000–0005 aplicadas; **0006 y 0007 pendientes**. La empresa del usuario tiene datos de prueba (45 productos, compatibilidades, 3 clientes; sin CAI). Otras empresas los cargan con el botón «Cargar datos de ejemplo» de Taller (`cargar_datos_demo`, 0007).
- ⏭️ Siguiente propuesto: confirmar reglas CAI con el contador; compras/entradas de inventario; catálogo web público por empresa (usa `buscar_productos` sin sesión).
