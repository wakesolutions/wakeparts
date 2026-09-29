# Base de datos · Wake Parts

Proveedor: **Supabase** (Postgres 15+). Migraciones en [`supabase/migrations/`](../supabase/migrations/). Este documento refleja el esquema **después de aplicar todas las migraciones del registro**.

## Diagrama actual

```
auth.users ─1:1─ usuarios ──< empresas_usuarios >── empresas
                    │                │
                    │                └── roles
                    └──< preferencias_tablas

marcas ──< modelos ──< modelos_anios ──< especificaciones >── tipos_carrocerias   (global)

categorias (árbol) ──< categorias_relacionadas                                    (global)
marcas_productos (global + por empresa)

empresas ──< productos ──< productos_imagenes            (Storage: bucket productos)
                 │    ├──< productos_compatibilidades >── marcas/modelos/años/especificaciones
                 │    └──< movimientos_inventario        (kardex)
         ──< clientes
         ──< cai
         ──< carritos ──< carritos_lineas
         ──< documentos ──< documentos_lineas            (cotizaciones y facturas)
```

## Convenciones

- Español, `snake_case`. PK `id`. FK `id_<entidad>`.
- Texto de catálogos en MAYÚSCULAS sin espacios sobrantes, normalizado por el trigger `a_normalizar_texto` (función `public.tg_normalizar_texto`). No hace falta normalizar en la app.
- RLS activado en todas las tablas.

## Empresas y usuarios (multiempresa)

Cada usuario pertenece a una o más empresas con un rol. Toda tabla operativa futura llevará `id_empresa` y RLS con `public.es_miembro(id_empresa)`.

### `empresas`

| Columna | Tipo | Nulo | Notas |
|---|---|---|---|
| `id` | uuid | no | PK |
| `nombre` | text | no | Nombre comercial (1–120) |
| `razon_social` | text | sí | |
| `rtn` | text | sí | 14 dígitos, sin guiones |
| `telefono`, `correo`, `direccion` | text | sí | Correo validado |
| `paleta` | text | no | `rojo-negro` (defecto) · `rojo-blanco` |
| `activo` | bool | no | |
| `creado_en`, `creado_por` | | | |

RLS: lectura para miembros (y admin de plataforma); edición para `dueno`/`admin`, solo de las columnas de datos (nombre, razón social, RTN, teléfono, correo, dirección, paleta). El trigger `a_normalizar` limpia RTN y correo. **No hay insert directo**: se crea con `crear_empresa()`.

Vistas: `v_miembros` (membresías + datos del usuario) y `v_invitaciones` (pendientes + quién invitó).

### `usuarios`

Perfil 1:1 con `auth.users`. Lo crea y actualiza el trigger `wp_sincronizar_usuario` (al registrarse y cuando cambian el correo o los metadatos de Google).

| Columna | Tipo | Nulo | Notas |
|---|---|---|---|
| `id` | uuid | no | PK = `auth.users.id` |
| `correo`, `avatar_url` | text | | Copiados de Google en cada inicio de sesión |
| `nombre` | text | sí | Tomado de Google solo la primera vez; luego lo edita el usuario |
| `telefono` | text | sí | |
| `id_empresa_activa` | uuid | sí | Empresa con la que trabaja; debe ser miembro |
| `es_admin_plataforma` | bool | no | Puede editar datos globales. **Solo por SQL/migración.** |

RLS: cada uno se ve a sí mismo y a quienes comparten empresa. Solo puede actualizar `id_empresa_activa`, `nombre` y `telefono` (privilegio por columna).

Admin de plataforma actual: `miltonbarrientos2@gmail.com`.

### `roles`

`dueno` (control total), `admin` (gestiona, no puede quitar al dueño), `vendedor` (vende y consulta). Lectura para autenticados.

### `empresas_usuarios`

PK `(id_empresa, id_usuario)`, `rol` → `roles.codigo`, `activo`. Lectura: los miembros de la empresa. Escritura: todavía no hay (la harán RPCs de invitación).

### `invitaciones`

Invitación por correo a una empresa con un rol. Cuando esa cuenta de Google entra, `aceptar_invitaciones()` (llamada en `/inicio` y `/bienvenida`) crea la membresía y marca `aceptada_en`.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `id_empresa` | uuid | FK empresas |
| `correo` | text | Normalizado a minúsculas. Único entre pendientes de la misma empresa. |
| `rol` | text | FK roles |
| `creado_por` | uuid | Por defecto `auth.uid()` |
| `aceptada_en`, `aceptada_por` | | Null = pendiente |

RLS: solo dueño/admin ven, crean, cambian el rol y revocan (pendientes). Solo un dueño invita como dueño. No se puede invitar a quien ya es miembro.

### Reglas de membresía (trigger `a_reglas` en `empresas_usuarios`)

Dueño/admin pueden cambiar `rol` y `activo` (privilegio por columna), con estas reglas:
- Nadie se modifica a sí mismo.
- Solo un dueño modifica a otro dueño o asigna el rol dueño.
- Siempre queda al menos un dueño activo.

Los mensajes de error (`P0001`) llegan en español a la UI.

### `preferencias_tablas`

PK `(id_usuario, clave)`, `config jsonb`. Configuración de la TablaMaestra por usuario (clave `tabla:<recurso>`). Cada usuario solo ve y edita las suyas.

### Funciones de empresas y permisos

| Función | Qué hace |
|---|---|
| `crear_empresa(p_nombre, p_razon_social, p_rtn, p_telefono, p_correo, p_direccion, p_paleta)` | RPC del onboarding: crea la empresa, al usuario como `dueno` y la deja activa. Normaliza RTN y correo. |
| `es_miembro(id_empresa)` | ¿El usuario actual es miembro activo? (security definer, para políticas) |
| `tiene_rol(id_empresa, roles[])` | ¿Tiene alguno de esos roles? |
| `es_admin_plataforma()` | ¿Es admin de plataforma? |
| `comparte_empresa(id_usuario)` | ¿Comparte alguna empresa con ese usuario? |

## Catálogo de vehículos (global)

Describe compatibilidad: una pieza encaja en uno o varios vehículos definidos por marca → modelo → año → especificación de motor y carrocería. Es compartido por todas las empresas.

**Acceso**: lectura pública (`anon` y `authenticated`, política `catalogo_lectura_publica`). Escritura: usuarios con `es_admin_plataforma` (política `catalogo_escritura_admin`).

**Vistas de lectura** (`security_invoker`, para la TablaMaestra): `v_marcas` (+ cantidad de modelos), `v_modelos` (+ marca, años, desde/hasta), `v_modelos_anios` (+ marca, modelo, especificaciones), `v_tipos_carrocerias` (+ especificaciones), `v_especificaciones` (+ marca, modelo, año, carrocería, `motor_litros` y todos los ids).

Volumen aproximado tras `0001`: 64 marcas, 843 modelos, 8 473 años, 14 carrocerías, 16 423 especificaciones.

### `marcas`

| Columna | Tipo | Nulo | Notas |
|---|---|---|---|
| `id` | serial | no | PK |
| `marca` | varchar | no | **Único**. Normalizado. |

### `modelos`

| Columna | Tipo | Nulo | Notas |
|---|---|---|---|
| `id` | serial | no | PK |
| `id_marca` | int | no | FK → `marcas.id` |
| `modelo` | varchar | no | Normalizado |

Único: `(id_marca, modelo)`.

### `modelos_anios`

| Columna | Tipo | Nulo | Notas |
|---|---|---|---|
| `id` | serial | no | PK |
| `id_modelo` | int | no | FK → `modelos.id` |
| `anio` | int | no | Entre 1900 y 2100 |

Único: `(id_modelo, anio)`.

### `tipos_carrocerias`

| Columna | Tipo | Nulo | Notas |
|---|---|---|---|
| `id` | serial | no | PK |
| `carroceria` | varchar | no | **Único**. Normalizado. Valores: TODOTERRENO, CABEZAL, MICROBUS/PANEL, TURISMO, BUS, MINIVAN, MOTOCICLETA, PICKUP, COMPACTO, CAMIONETA, VAN, MINIBUS, CAMION, PANELITO. |

### `especificaciones`

Variante concreta de un modelo-año: carrocería + motor. Es el nivel al que se asociará la compatibilidad de piezas.

| Columna | Tipo | Nulo | Notas |
|---|---|---|---|
| `id` | serial | no | PK |
| `id_modelo_anio` | int | no | FK → `modelos_anios.id` |
| `id_tipo_carroceria` | int | no | FK → `tipos_carrocerias.id` (indexada) |
| `motor_cc` | int | sí | **Cilindrada en cc. Usar esta.** Entre 50 y 20 000. Si llega null se calcula desde `motor_tamanio_cc`. |
| `motor_tamanio_cc` | varchar | sí | **Legado**: cilindrada en litros escrita a mano. No usar en código nuevo. |
| `motor_numero_cilindros` | int | no | Entre 1 y 16 |
| `motor_posicion_cilindros` | varchar | no | `L` en línea · `V` en V · `H` horizontal/bóxer |
| `motor_numero` | varchar | sí | Código de motor (`1ZZ-FE`). Null si no se conoce (nunca `''`). |

Único (nulls no distintos): `(id_modelo_anio, id_tipo_carroceria, motor_cc, motor_numero_cilindros, motor_posicion_cilindros, motor_numero)`.

## Productos e inventario (0004)

### `categorias` (global)

Árbol de hasta 3 niveles (trigger `a_arbol`: sin ciclos, genera `slug`, hereda `es_servicio` del padre). Semilla: 25 categorías principales y 161 subcategorías, incluida **Mano de obra** (`es_servicio`: sus productos no llevan inventario). `sinonimos` = cómo le dicen en mostrador («candelas», «fricciones», «hules»): entran en la búsqueda. Escribe solo el admin de plataforma; lectura pública. Vista `v_categorias` (ruta «Frenos › Pastillas de freno», nivel, `orden_arbol`).

### `categorias_relacionadas` (global)

Pares **simétricos** (trigger `z_simetria` mantiene el inverso): «si busca aceite de motor, recomendar filtros de aceite». Semilla de 102 pares (204 filas). Vista `v_categorias_relacionadas`.

### `marcas_productos`

`id_empresa` null = catálogo general (semilla de 57 marcas); con empresa = propia. Una empresa no puede crear una marca que ya existe en el general. Vista `v_marcas_productos` (`global`, `productos`).

### `productos` (por empresa)

| Columna | Notas |
|---|---|
| `codigo` | Único por empresa. Vacío → `P-000123` |
| `nombre`, `descripcion`, `notas` | |
| `id_categoria`, `id_marca_producto` | |
| `oem`, `numero_parte`, `codigo_barras`, `referencias` | Referencias = otros números/equivalencias separados por coma |
| `condicion` | `nuevo` · `usado` · `reconstruido` |
| `origen` | `original` (de agencia) · `oem` · `alternativo` |
| `unidad` | unidad, par, juego, kit, litro, cuarto, galón, metro, caja, servicio |
| `costo`, `precio` | **Sin ISV** (numeric 14,2) |
| `utilidad`, `margen` | Generadas: `precio − costo` y `(precio − costo)/precio·100` |
| `exento` | Sin ISV |
| `controla_inventario`, `existencia`, `existencia_minima` | Servicios: sin inventario. `bajo_minimo` en la vista |
| `ubicacion`, `garantia_dias`, `visible_catalogo`, `activo` | |
| `texto_busqueda`, `codigos` | Generados por trigger (no editar) |

Trigger `a_preparar`: normaliza, genera el código, arma `texto_busqueda` = nombre + descripción + marca + categoría y sus ancestros con sinónimos + códigos, en forma fonética (`wp_fonetico`). Si cambia el nombre/sinónimos de una categoría o marca, se rehace el texto de sus productos. RLS: leen los miembros; escriben dueño/admin. Con ventas no se borra (FK): se desactiva. Vista `v_productos` (+ `precio_final` con ISV, `imagen` principal, conteos de fotos y vehículos).

### `movimientos_inventario` (kardex)

Lo escribe **solo** el trigger `z_kardex` al cambiar `productos.existencia`: `inicial`, `ajuste` (edición manual), `venta`, `anulacion`… Quien cambia la existencia por una operación define antes `set_config('wp.movimiento_tipo', 'venta', true)` y `wp.movimiento_ref` (número de documento). Vista `v_movimientos_inventario`.

### `productos_imagenes` + Storage

Bucket público `productos` (5 MB, webp/jpeg/png/avif). Ruta `<id_empresa>/<id_producto>/<uuid>.webp` y miniatura `…_m.webp`. Políticas de `storage.objects`: suben/cambian/borran dueño/admin de la empresa de la carpeta (`empresa_de_ruta()`); leen los miembros; la URL pública sirve para el catálogo. Las fotos se comprimen en el navegador.

### `productos_compatibilidades`

Producto ↔ vehículo en el nivel elegido (`nivel` 1 marca · 2 modelo · 3 año · 4 especificación). El trigger `a_completar` llena los ancestros (una fila de año lleva marca y modelo), así «le queda a este vehículo» es una comparación directa. Único con nulls no distintos. Un producto **sin filas** es «general» (universal).

| Función | Qué hace |
|---|---|
| `asignar_compatibilidades(producto, nivel, ids[], asignar)` | Alta/baja en bloque; al asignar compacta (lo cubierto por un nivel superior sobra). |
| `copiar_compatibilidades(origen, destino)` | Copia entre productos de la misma empresa. |

### Búsqueda

- `wp_normalizar(text)`: minúsculas sin tildes (`unaccent`). `wp_fonetico(text)`: además ll→y, v→b, z/ce/ci→s, h muda (`pastiyas` = `pastillas`). `wp_codigo(text)`: solo letras y números.
- `buscar_vehiculos(texto, limite)`: «corolla 05» → modelo-año; sin año devuelve modelos con rango de años. Pública.
- `buscar_productos(empresa, texto, id_marca, id_modelo, id_modelo_anio, id_especificacion, id_categoria, limite)` (security definer, pública):
  - Cada palabra debe aparecer; si nada coincide exacto, tolera errores (`word_similarity`, pg_trgm). Códigos sin guiones (OEM, parte, barras, equivalencias).
  - Con vehículo (cualquier nivel): `grupo = vehiculo` con `ajuste` motor · anio · modelo · marca (le queda) o `verificar` (le queda a alguna versión), `general` (sin compatibilidad) y excluye lo de otros vehículos. Sin vehículo: `todos`.
  - `complemento`: hasta 8 productos de categorías relacionadas con lo encontrado o con lo que nombra el texto.
  - Miembros ven costo, existencia y ubicación; el público (catálogo web) solo productos visibles con existencia y sin costo.

### Datos de ejemplo (0007)

`cargar_datos_demo(p_empresa)` (security invoker, solo dueño/admin): inserta en la empresa 45 productos de ejemplo (repuestos con OEM y ubicación, generales sin vehículo y mano de obra), sus compatibilidades resueltas por nombre contra el catálogo (Corolla, Yaris, Hilux y su motor 2KD-FTV, RAV4, Land Cruiser Prado, Civic, CRV, Frontier, Accent, Rio y marcas Toyota/Honda/Nissan) y 3 clientes. Idempotente: salta códigos y clientes existentes. No crea CAI. Devuelve `{productos, compatibilidades, clientes}` con lo que insertó.

## Ventas (0005)

| Tabla | Qué es |
|---|---|
| `clientes` | Por empresa. RTN opcional (14 dígitos, único por empresa). Registran y editan todos los miembros; borran dueño/admin. Vista `v_clientes` (facturas, último documento). |
| `cai` | Rango autorizado: `cai` (32 hex con guiones), establecimiento, punto de emisión, tipo de documento (`01` factura), rango, `siguiente`, fecha límite. Con facturas emitidas solo se puede activar/desactivar y `siguiente` no retrocede. Vista `v_cai` (disponibles, % usado, días, vigente). |
| `carritos` | Borrador de venta (todos los miembros). Cliente (copia datos si se elige uno), vehículo (ids + texto), descuento general. Se cierra al emitir. |
| `carritos_lineas` | Producto o línea libre, cantidad, precio sin ISV, descuento %, exento. |
| `documentos` | Cotización (`COT-000001`, vence en 15 días) o factura (`EEE-PPP-TT-NNNNNNNN`). Copias del emisor, cliente, vehículo y CAI; totales. **Inmutables**: solo lectura por RLS; se anulan. |
| `documentos_lineas` | Copia de las líneas con descuento combinado y total. |
| `correlativos` | Numeración interna por empresa (cotizaciones). Sin acceso directo. |

`empresas.descuento_maximo_vendedor` (defecto 10 %): los triggers de carritos y líneas rechazan descuentos mayores si el usuario no es dueño/admin.

| Función | Qué hace |
|---|---|
| `emitir_documento(carrito, tipo, vence?)` | Valida, numera con bloqueo (CAI vigente con números; sin huecos), calcula totales en la base, copia líneas, descuenta existencias (kardex «venta») y cierra el carrito. Factura exige razón social y RTN del taller. |
| `anular_documento(documento, motivo)` | Dueño/admin. Si era factura, devuelve existencias (kardex «anulacion»). El número no se reutiliza. |
| `carrito_desde_documento(documento)` | Carrito nuevo con cliente, vehículo y líneas del documento (cotización → factura). |

Totales: `bruto = cantidad·precio`; `neto = bruto·(1 − desc. línea)·(1 − desc. general)` redondeado a centavos por línea; ISV = 15 % del gravado redondeado; total = exento + gravado + ISV.

## Funciones

| Función | Qué hace |
|---|---|
| `public.limpiar_texto(text)` | Quita espacios/tabs de los extremos, MAYÚSCULAS, `''` → null. |
| `public.parse_motor_cc(text)` | Texto de cilindrada → cc. `"2.O"`→2000, `"3..3"`→3300, `"28"`→2800, `"6700"`→6700, `"d"`→null. |
| `public.tg_normalizar_texto()` | Trigger genérico; recibe como argumentos las columnas a normalizar. |
| `public.tg_especificaciones_motor_cc()` | Trigger: completa `motor_cc` si viene null. |

## Esquema `respaldo`

Copias de filas eliminadas por migraciones (`<tabla>_<NNNN>`). No expuesto a la API. Se puede vaciar cuando ya no haga falta.

- `respaldo.modelos_0001` (5), `respaldo.modelos_anios_0001` (260), `respaldo.especificaciones_0001` (1 048): duplicados consolidados por `0001`.

## Datos por revisar a mano

No se corrigieron en `0001` por falta de certeza:

| id especificación | Vehículo | Problema |
|---|---|---|
| 5964 | GEO METRO 2000 | Sin cilindrada; 1 cilindro (¿1.0 L, 3 cil.?) |
| 14286 | POLARIS RZR1000 2019 | 1.8 L con 2 cilindros en V (¿999 cc?) |
| 14287 | POLARIS ZR125 2016 | Sin cilindrada |
| 14730 | SUBARU IMPREZA 2000 | Cilindrada `"d"` |
| 16543 | TOYOTA SEQUOIA 2014 | Sin cilindrada; «4V» (el Sequoia es V8) |
| 16650 | TOYOTA TACOMA 2009 | Sin cilindrada; «4V» |
| 16708 | TOYOTA TUNDRA 2005 | Sin cilindrada |
