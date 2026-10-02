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
   │  (logo, fondo y fotos del sitio: Storage, bucket empresas)
         ──< pedidos_web ──< pedidos_web_lineas                (0013, sitio público)
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
| `paleta` | text | no | `rojo-negro` (defecto) · `rojo-blanco`: la **base** del tema |
| `logo_ruta` | text | sí | (0012) Logo en Storage: `<empresa>/logo/<uuid>.webp` |
| `fondo_ruta` | text | sí | (0012) Fondo del escritorio: `<empresa>/fondo/<uuid>.webp`. Null = el de Wake Parts |
| `fondo_atenuar` | smallint | no | (0012) Velo sobre el fondo, 0–85 % (defecto 40) |
| `acento` | text | sí | (0012) Color de marca `#rrggbb` en minúsculas. Null = el de la paleta |
| `formato_documento` | jsonb | no | (0012) Diseño de facturas/cotizaciones (`lib/identidad.ts` › `FormatoDocumento`). Objeto < 8 KB; la app lo normaliza |
| `slug` | text | sí | (0013) Dirección del sitio público `/t/<slug>`. Único, `^[a-z0-9]+(-[a-z0-9]+)*$`, 3–40. Reservadas en la app (`lib/sitio-web.ts`) |
| `sitio_publicado` | bool | no | (0013) El sitio se ve sin sesión. Exige `slug` |
| `sitio` | jsonb | no | (0013) Configuración del sitio (`ConfigSitio`): textos de portada y Nosotros, WhatsApp, horario, redes, `mostrarPrecios`, `fotos` (rutas `<empresa>/sitio/…`), `destacados` (ids). < 32 KB; la app lo normaliza |
| `activo` | bool | no | |
| `creado_en`, `creado_por` | | | |

RLS: lectura para miembros (y admin de plataforma); edición para `dueno`/`admin`, solo de las columnas de datos (nombre, razón social, RTN, teléfono, correo, dirección, paleta, `descuento_maximo_vendedor` y, desde 0012, las de identidad visual).

**Storage `empresas`** (0012): bucket público (el logo sale en documentos impresos sin firmar URLs; las rutas llevan uuid). Lectura para miembros vía API; subir, cambiar y borrar solo dueño/admin de la empresa de la carpeta (`empresa_de_ruta`). Los checks `empresas_logo_ruta_check` y `empresas_fondo_ruta_check` exigen que la ruta esté en la carpeta de la propia empresa. El trigger `a_normalizar` limpia RTN y correo. **No hay insert directo**: se crea con `crear_empresa()`.

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
| `recorrido_visto_en` | timestamptz | sí | (0008) Cuándo terminó o saltó el recorrido guiado. Null = se le muestra al entrar |

RLS: cada uno se ve a sí mismo y a quienes comparten empresa. Solo puede actualizar `id_empresa_activa`, `nombre`, `telefono` y `recorrido_visto_en` (privilegio por columna).

Admin de plataforma actual: `miltonbarrientos2@gmail.com` (0010 desmarca a cualquier otro). La app exige además que el correo esté en `ADMINS_PLATAFORMA`. Para agregar otro admin: `update usuarios set es_admin_plataforma = true where correo = …` **y** sumarlo a la variable.

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

### `categorias` (generales + propias por empresa, 0010)

Árbol de hasta 3 niveles (trigger `a_arbol`: sin ciclos, genera `slug`, hereda `es_servicio` del padre). Semilla: 25 categorías principales y 161 subcategorías, incluida **Mano de obra** (`es_servicio`: sus productos no llevan inventario). `sinonimos` = cómo le dicen en mostrador («candelas», «fricciones», «hules»): entran en la búsqueda. `id_empresa` null = **general** (la escribe solo el admin de plataforma; lectura pública, también `anon`); con empresa = **propia** (la ven los miembros, la escriben dueño/admin). Una propia puede colgar de una general o de otra propia de la misma empresa; una general nunca de una propia; la empresa de una categoría no cambia. El `slug` es único entre todas (el trigger `a_arbol` es security definer para verlas todas). Un producto solo usa generales o propias de su empresa (trigger `a_categoria_empresa`). Vista `v_categorias` (ruta «Frenos › Pastillas de freno», nivel, `orden_arbol`, `id_empresa`, `global`); `v_categorias_globales` = solo generales (Mantenimiento del admin).

### `categorias_relacionadas` (global)

Pares **simétricos** (trigger `z_simetria` mantiene el inverso), solo entre categorías generales (los escribe el admin de plataforma; se leen si ambas categorías son visibles): «si busca aceite de motor, recomendar filtros de aceite». Semilla de 102 pares (204 filas). Vista `v_categorias_relacionadas`.

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

### Reportes, entradas e importación (0009)

Las tres son **security invoker** (RLS de quien llama).

| Función | Qué hace |
|---|---|
| `reporte_ventas(empresa, desde, hasta)` | Contrato genérico de reportes (`{periodo, indicadores:{clave:{valor, anterior}}, serie, rankings}`, ver `componentes.md` › Reportes). Facturas emitidas por fecha de Honduras; `anterior` = período previo de igual largo; utilidad/margen y la columna utilidad de productos solo para dueño/admin (null para vendedores). Rankings: productos (10), categorías (8), vendedores, clientes. Máx. 400 días. |
| `entrada_inventario(empresa, lineas jsonb, referencia, modo_costo)` | Suma existencias de varias líneas `[{id_producto, cantidad, costo}]` en una transacción, con `wp.movimiento_tipo = 'compra'` (kardex). `modo_costo`: `promedio` (ponderado; si la existencia era ≤ 0 manda el costo nuevo), `ultimo` o `mantener`. Rechaza servicios y cantidades ≤ 0. Solo dueño/admin. |
| `importar_productos(empresa, filas jsonb, actualizar, probar)` | Alta o actualización por `codigo` (máx. 1000 filas por llamada). Categoría por slug, nombre, sinónimo o ruta («Frenos › Pastillas»); marca del catálogo o nueva propia; unidad y condición con tildes/plurales. Lo vacío no pisa datos en actualizaciones. Errores por fila (`_fila`) sin cortar el resto. `probar` = hace todo y lo deshace (subtransacción) para revisar el archivo. Kardex con referencia «Importación». Solo dueño/admin. |
| `resolver_categoria(texto)` | La categoría más probable para un texto (prefiere subcategorías). |

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

Totales: `bruto = cantidad·precio`; `neto = bruto·(1 − desc. línea)·(1 − desc. general)` redondeado a centavos por línea; ISV = 15 % del gravado redondeado; total = exento + exonerado + gravado + ISV.

## Notas, exoneraciones y puntos de emisión (0016)

| Tabla / columna | Qué es |
|---|---|
| `puntos_emision` | Por empresa: `establecimiento` (3 díg.), `sucursal`, `direccion`, `telefono`, `punto_emision` (3 díg.), `nombre` (caja), `predeterminado` (uno por empresa, índice parcial; el primero lo es solo; marcar otro desmarca el anterior; no se desactiva), `activo`. Único `(id_empresa, establecimiento, punto_emision)`. Con CAI registrados sus códigos no cambian. Leen miembros; escriben dueño/admin. Auditoría `zz_registrar_cambio`. Vista `v_puntos_emision` (`codigo`, `etiqueta`, `usuarios`, `cai_vigentes`). |
| `cai.id_punto_emision` | Punto del CAI. El trigger `a_preparar` copia sus códigos; si llegan solo los códigos, busca o crea el punto. 0016 creó los puntos desde los CAI existentes. Con documentos, no cambia. `v_cai` + `id_punto_emision`, `punto`. |
| `empresas_usuarios.id_punto_emision` | Punto de cada persona (null = predeterminado). Lo asignan dueño/admin o la propia persona (política `empresas_usuarios_propio_punto`; el trigger `a_reglas` sigue impidiendo cambiarse el rol). `v_miembros` + `id_punto_emision`, `punto`. |
| `clientes.exonerado`, `exo_constancia`, `exo_registro_sag` | Datos de exoneración; se copian al carrito al elegir el cliente. |
| `carritos.exonerado`, `exo_orden_compra`, `exo_constancia`, `exo_registro_sag` | Exoneración del borrador (en `v_carritos`). |
| `documentos` | `tipo` + `nota_credito` · `nota_debito`; `importe_exonerado`; `exoneracion` jsonb `{orden_compra, constancia, registro_sag}`; `id_punto_emision`, `establecimiento`, `punto_emision`; notas: `id_factura`, `factura_numero`, `factura_fecha`, `factura_cai`, `motivo_tipo` (`devolucion` · `descuento` · `correccion` · `intereses` · `gastos` · `otro`), `motivo`, `reintegra_inventario`. `emisor` suma `sucursal`, `direccion_sucursal`, `telefono_sucursal`, `punto`. `v_documentos` + `importe_exonerado`, `id_factura`, `factura_numero`, `motivo_tipo`, `punto`, `exonerada`. |
| `documentos_lineas.id_linea_origen` | En una devolución, la línea de la factura acreditada. `v_lineas_acreditables`: líneas de una factura + `devuelto` y `acreditado` en notas de crédito vigentes. |

| Función | Qué hace |
|---|---|
| `punto_emision_actual(empresa)` | Punto de quien llama: el suyo activo o el predeterminado. |
| `codigo_tipo_documento(tipo)` | `factura` 01 · `nota_credito` 06 · `nota_debito` 07. |
| `tomar_numero_cai(punto, tipo)` | (interna) CAI vigente del punto y tipo con bloqueo; avanza `siguiente`. |
| `emitir_documento(…)` | Como en 0005, con el punto de quien emite y la exoneración (factura exonerada: RTN y orden de compra exenta o constancia). |
| `emitir_nota(factura, tipo, motivo_tipo, motivo, lineas, reintegrar)` | Dueño/admin. Devolución `[{id_linea, cantidad}]` (tope: vendido − devuelto; si vuelve todo se acredita el resto exacto) o montos `[{descripcion, monto, exento}]`. Crédito ≤ `saldo_factura()` (tolerancia 2 centavos de ISV). Reintegro con kardex «devolucion». |
| `saldo_factura(factura)` | Total + débitos − créditos vigentes. |
| `anular_documento(…)` | No anula facturas con notas vigentes; anular una devolución reintegrada saca las piezas (kardex «anulacion»). |
| `carrito_desde_documento(…)` | Solo cotizaciones y facturas; copia la exoneración (sin la orden de compra). |

## Crédito y cuentas por cobrar (0017)

| Tabla / columna | Qué es |
|---|---|
| `clientes.credito_habilitado`, `limite_credito` (null = sin límite), `dias_credito` (0–365, defecto 30) | Solo dueño/admin los cambian (trigger `b_credito`). `v_clientes` + estas columnas y `saldo`. |
| `carritos.condicion` | `contado` · `credito` (en `v_carritos`). |
| `documentos.condicion`, `dias_credito` | Factura al crédito: `vence` = fecha + días. `v_documentos` + `condicion`, `pendiente`. |
| `pagos` | Recibo de abono: `numero` `REC-000001` (correlativo `recibo`), cliente (copia de nombre y RTN), `monto` > 0, `forma_pago` (`efectivo` · `tarjeta` · `transferencia` · `deposito` · `cheque` · `otro`), `referencia`, `notas`, `estado` (`emitido` · `anulado`) y datos de anulación. Solo lectura por RLS; auditoría `zz_registrar_cambio`. |
| `pagos_aplicaciones` | Reparto del recibo entre facturas (`id_documento`, `monto`). |

| Vista / función | Qué hace |
|---|---|
| `v_cuentas_cobrar` | Una fila por factura al crédito vigente: `debitos`, `creditos`, `abonado`, `pendiente` (= total + débitos − créditos − abonos), `dias_vencida`, `estado` (`al_dia` · `por_vencer` ≤ 7 días · `vencida` · `pagada`). |
| `v_cuentas_clientes` | Una fila por cliente con crédito o con saldo: `pendiente`, `vencido`, `disponible`, `facturas`, `dias_mora`, `proximo_vence`, `ultimo_abono`, `estado` (`vencida` · `al_dia` · `a_favor` · `sin_saldo`), `en_mora`. |
| `v_pagos`, `v_pagos_aplicaciones` | Recibos (+ facturas que pagan y quién cobró) y su reparto. |
| `emitir_documento(…)` | Como en 0016; al crédito exige cliente con crédito y, para vendedores, sin vencidas y dentro del límite (dueño/admin pasan). |
| `registrar_pago(cliente, monto, forma, referencia?, notas?, aplicaciones?)` | Cualquier miembro. Bloquea las facturas del cliente; reparto elegido (debe sumar el monto) o a las más antiguas primero; no más de lo pendiente. |
| `anular_pago(pago, motivo)` | Dueño/admin. |
| `anular_documento(…)` | Además: no anula una factura con abonos vigentes. |
| `pendiente_factura(factura)` | Lo pendiente (0 si es de contado o está anulada). |

## Sitio web y pedidos (0013)

### `pedidos_web` / `pedidos_web_lineas`

Lo que manda un visitante desde `/t/<slug>`. Columnas: `numero` (identity global, «Web #n»), cliente (`cliente_nombre`, `cliente_telefono` solo dígitos 8–15, `cliente_correo`, `mensaje` ≤ 600), vehículo (`id_marca`…`id_especificacion` + `vehiculo` texto armado en la base), `estado` (`nuevo` · `atendido` · `descartado`), `id_carrito`, `atendido_por`, `atendido_en`, `ip`. Las líneas guardan `id_producto`, `codigo`, `descripcion`, `cantidad` (≤ 999), `precio` y `exento` **tomados de la base**, nunca del navegador.

- **RLS**: miembros leen; solo pueden cambiar `estado` (descartar/recuperar). Nadie inserta ni borra por la API: se crea con `enviar_pedido_web()`.
- `v_pedidos_web` (security invoker): + `lineas`, `total_estimado` (con ISV 15 % salvo exentos) y nombre de quien atendió. Auditoría `zz_registrar_cambio` si existe 0011.

### Funciones del sitio público (security definer, `anon` + `authenticated`)

| Función | Qué hace |
|---|---|
| `sitio_publico(slug)` | Datos públicos de la empresa + `sitio`. Null si no existe o no está publicado (los miembros la ven igual: vista previa). |
| `portada_web(slug)` | Destacados (elegidos o los últimos con foto, 8) y categorías con productos visibles (12). |
| `buscar_catalogo_web(slug, texto, marca…categoria, limite)` | Envuelve `buscar_productos`: solo visibles con existencia, sin costo/existencia/ubicación, **precio null si `mostrarPrecios` es false**. |
| `producto_web(slug, id)` | Ficha: datos, fotos y vehículos a los que le queda (80 máx.). |
| `sitios_publicados()` | Slugs publicados (sitemap). |
| `enviar_pedido_web(slug, cliente, vehiculo, lineas)` | Valida todo, toma precios de la base, máx. 40 líneas; **límite**: 6 pedidos/hora por IP (`x-cliente-ip`) y 3 cada 10 min por teléfono. Errores para el visitante con `P0001`. |
| `atender_pedido_web(pedido)` | (authenticated, miembro) Pedido → carrito del mostrador con el precio de hoy («Web #n», cliente, vehículo, mensaje en notas); marca `atendido`. Si ya se atendió y el carrito sigue abierto, devuelve ese. |

Desde 0013, **`anon` ya no puede ejecutar `buscar_productos`** (devolvía el precio aunque el taller lo ocultara).

## Notificaciones (0014)

### `notificaciones` / `notificaciones_leidas`

Avisos de la campanita. `id_empresa`, `id_usuario` (null = para todos los miembros), `tipo` (`pedido_web`…), `titulo` (≤ 160), `cuerpo` (≤ 400), `enlace` jsonb `{modulo, seccion, recurso, id}` (adónde lleva en el escritorio), `es_tarea` + `resuelta_en`/`resuelta_por` (tarea **compartida**: la resuelve cualquiera del equipo), `origen_tabla` + `origen_id` (registro que la generó). Leído es **por usuario** (`notificaciones_leidas`).

- **Se crean solo desde la base** (triggers security definer); la API no puede insertar, editar ni borrar. Miembros leen las de su empresa (y las dirigidas a ellos).
- **Fuente actual**: trigger `zy_notificar` en `pedidos_web`: pedido nuevo → tarea «Pedido web #n · Cliente»; `atendido`/`descartado` → resuelta; vuelve a `nuevo` → pendiente otra vez. Si falla, solo emite un `warning`: el pedido se guarda igual.
- `v_notificaciones` (security invoker): + `pendiente`, `leida` (del usuario) y nombre de quien la resolvió. `resumen_notificaciones(empresa)`: `{pendientes, no_leidas, ultima}`. `marcar_notificaciones_leidas(empresa, ids?)` (null = todas). `limpiar_notificaciones(dias = 90)` borra viejas leídas o resueltas (a mano o pg_cron).
- **Otra fuente nueva** (CAI por vencer, existencia baja…): un trigger o función que inserte en `notificaciones` con su `enlace` y `origen_*`, y que la resuelva cuando corresponda. La campanita no cambia.
- Sin auditoría `zz_registrar_cambio`: son avisos, no datos del negocio (el pedido ya se audita).

## Seguimiento de talleres (0015, solo admin de plataforma)

- `seguimiento_empresas()` (security definer; vacía si no sos admin de plataforma) → una fila por empresa activa: `empresa`, `registrada_en`, `dias_registrada`, dueño (`dueno`, `correo`, `telefono` de `usuarios`), `telefono_empresa`, `miembros`, `productos`, `cotizaciones`, `facturas`, `ultimo_documento`, `ultimo_acceso` (`auth.users.last_sign_in_at` de sus miembros), `dias_sin_entrar`, `sitio_publicado`, `pedidos_web`, `etapa` (`sin_productos` · `sin_cotizar` · `cotizando` · `facturando`) y la nota de contacto. `v_seguimiento_empresas` la expone para TablaMaestra.
- `seguimiento_contactos` (`id_empresa` PK, `contactado_en`, `nota` ≤ 1000, `actualizado_*`): lo anota el admin desde el módulo Seguimiento. RLS: solo `es_admin_plataforma()`.
- Nada se manda solo: el módulo arma el mensaje y abre WhatsApp o el correo del admin.

## Funciones

| Función | Qué hace |
|---|---|
| `public.limpiar_texto(text)` | Quita espacios/tabs de los extremos, MAYÚSCULAS, `''` → null. |
| `public.parse_motor_cc(text)` | Texto de cilindrada → cc. `"2.O"`→2000, `"3..3"`→3300, `"28"`→2800, `"6700"`→6700, `"d"`→null. |
| `public.tg_normalizar_texto()` | Trigger genérico; recibe como argumentos las columnas a normalizar. |
| `public.tg_especificaciones_motor_cc()` | Trigger: completa `motor_cc` si viene null. |

## Registro de actividad (0011)

### `registros`

Solo se agrega (sin FKs, para sobrevivir a borrados). `tipo`: `visita` · `sesion` · `error` · `cambio` · `accion`; `nivel`: `info` · `aviso` · `error`; `evento` (`pagina.vista`, `sesion.inicio|cierre|fallo`, `error.navegador`, `error.servidor.<render|route|action|proxy>`, `<tabla>.crear|editar|eliminar`). Además: `id_usuario`, `correo`, `id_empresa`, `tabla`, `id_registro`, `ip inet`, `dispositivo` («Celular · Android 14 · Chrome 140»), `agente`, `pais`, `ciudad`, `ruta`, `metodo`, `referente`, `entorno`, `datos jsonb` (cambios `{campo: {antes, despues}}`, fila creada/eliminada, pila del error…).

- **Escritura**: la app con la llave secreta (`lib/registro.ts`: visitas, sesiones, errores) y el trigger `zz_registrar_cambio` → `registrar_cambio()` (security definer) en empresas, empresas_usuarios, invitaciones, productos, productos_imagenes, productos_compatibilidades, categorias, categorias_relacionadas, marcas_productos, clientes, cai, documentos y el catálogo de vehículos. En `UPDATE` guarda solo las columnas cambiadas (ignora `actualizado_en`) y no registra si no cambió nada. IP y dispositivo salen de los headers `x-cliente-*` que manda `lib/supabase/server.ts`. Si falla, solo emite un `warning`: nunca bloquea la operación.
- **RLS**: lectura para admin de plataforma (todo) y dueño/admin (filas de su empresa). Nadie inserta, edita ni borra desde la API.
- `v_registros` (security invoker): nombre del usuario, `nombre_empresa_visible()`, `host(ip)`, `ubicacion`.
- `limpiar_registros(p_dias_visitas = 180, p_dias_resto = 730)`: borra vencidos (solo admin de plataforma o sin sesión, p. ej. pg_cron). Hoy se ejecuta a mano.

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
