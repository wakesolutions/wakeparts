# Bitácora de decisiones · Wake Parts

Entradas nuevas arriba. Formato: fecha, decisión, por qué.

## 2026-10-01 · Catálogo web por empresa (migración 0013)

- **Decisiones del usuario**: dirección `/t/<slug>`; los precios los muestra u oculta cada taller; los pedidos son «carrito → cotización» sin pagos en línea.
- **Pedido web ≠ carrito directo**: lo del público llega a `pedidos_web` y el vendedor decide atenderlo (se vuelve carrito). Así el spam o las bromas no llenan las pestañas del mostrador, y queda registro de lo que pidió el cliente aunque después se cambie en el mostrador.
- **Todo lo público pasa por RPC security definer** que devuelven solo lo publicable; a `anon` se le quitó `buscar_productos` porque entregaba el precio aunque el taller lo ocultara. Ocultar precios es una garantía de la base, no un detalle de la interfaz.
- **El navegador nunca pone precios ni nombres**: `enviar_pedido_web` solo recibe ids y cantidades. Límite anti abuso en la base (6/h por IP, 3 cada 10 min por teléfono); la IP llega por `x-cliente-ip` (un atacante que llame a PostgREST directo puede falsearla: el límite por teléfono sigue valiendo).
- **La lista vive en localStorage** (`wp:carrito-web:<slug>`), no en una cookie: no hace falta consentimiento y no viaja al servidor hasta mandar el pedido. Declarado en `/cookies`; los datos del pedido, en `/privacidad`.
- **Mismo motor de búsqueda que el mostrador** (`buscar_productos` envuelta): «le queda / puede quedarle / general» se ve igual en el sitio y en el mostrador.
- **El tema del sitio va en un contenedor** (`data-paleta` + acento con selector propio) y no en `<html>`: la cookie `wp_paleta` del visitante es de otro contexto.
- **Destacados elegidos a mano** (lista en `sitio.destacados`) en vez de una columna en `productos`: no obliga a rehacer `v_productos` y el orden lo decide el dueño.
- **/t/demo** (solo desarrollo) usa datos en memoria para revisar el sitio sin base; el editor y los pedidos tienen API inyectable para el sandbox.
- **Pendiente propuesto**: aviso de pedidos nuevos (contador en el dock), dominio propio por taller, páginas de categoría indexables.

## 2026-10-01 · Identidad visual por empresa (migración 0012)

- **Pedido del usuario**: «que esta gente sienta que el sistema se adapta claramente a su empresa». Cada empresa tiene **logo**, **fondo del escritorio** (con «Restablecer el de Wake Parts»), **tema** (base clara/oscura + color de marca) y **formato de factura**. Todo en Taller (pestañas Datos · Apariencia · Factura), solo dueño/admin; los empleados lo ven automáticamente.
- **Un solo color de marca** y el resto derivado en JS (`tokensAcento` en `lib/identidad.ts`): hover, sombra, selección, LCD. Se inyecta como `:root[data-paleta]{…}` (pesa más que la paleta), así toda la app cambia sin tocar componentes. Se eligió JS y no `color-mix` para calcular también el texto sobre el acento (claro u oscuro según luminancia).
- **Sin cookie nueva** (regla de cookies): el acento y el fondo viajan en la sesión del servidor; la cookie `wp_paleta` sigue siendo solo caché de la paleta base.
- **Vista previa en vivo** con `IdentidadProvider`: lo que se elige se ve en el escritorio real antes de guardar; al cerrar Taller sin guardar, vuelve a lo guardado. Las imágenes sí se guardan al subirlas (se reducen a WebP en el navegador: logo 800 px, fondo 2560 px).
- **Velo sobre el fondo** (0–85 %, color de la paleta) en vez de dejar la foto pura: la barra, el saludo y las ventanas tienen que leerse con cualquier imagen.
- **Formato de factura**: el editor usa el `Formulario` genérico (nueva presentación `segmentos`) y la hoja real `DocumentoVista` con datos de ejemplo. Solo cambia presentación y lo opcional (vehículo, vendedor, código, lema, mensaje). Lo fiscal (emisor/RTN, CAI y rango, cliente/RTN, detalle con descuentos, totales desglosados, total en letras, leyendas) **no se puede ocultar** (docs/negocio.md §3.5).
- **El formato se aplica al imprimir, no se congela**: los datos del documento sí quedan fijos (`documentos.emisor`), pero una reimpresión vieja sale con el logo y diseño actuales. Si el contador pide lo contrario, guardar el formato en el documento al emitir.
- **Clásico** usa Source Serif 4 (sin precarga, solo se descarga si se usa).
- La paleta salió de Taller › Datos y vive en Apariencia junto al color; las perillas de la barra siguen funcionando.

## 2026-10-01 · Diseño para el uso diario y menos «Google»

- **Híbrido cabina + minimalismo estilo Apple** (pedido del usuario: el diseño gusta, pero «tanto efecto todos los días cansa»). Se conserva la identidad (paletas, tipografía Saira/Mono, semáforo, dock, placa, odómetro, sello) y se baja el volumen: metal satinado sin cepillado, sin fibra de carbono en el escritorio, biseles y campos hundidos más leves, halos de LED a la mitad (`--wp-accent-glow`), sombras de ventana más suaves, títulos de ventana en tipo oración, sin texto grabado en la UI diaria.
- **Menos movimiento repetido**: la barra y el dock ya no entran animados en cada carga; magnificación del dock de 1.28 a 1.08; entradas de módulos y formularios ~340 ms; los puntos de alerta de las tablas ya no laten. El tacómetro del login conserva el barrido (más corto) pero sin vibración de ralentí ni LED que respira.
- **No repetir «Google»**: el botón dice **Entrar** (antes «Encender con Google») y la barra **Salir** (antes «Apagar»). Google se nombra solo donde es información necesaria: páginas legales (`/privacidad`, `/cookies`, `/terminos`) y una mención en el manual.

## 2026-09-29 · Registro de actividad

- **Una sola tabla `registros`** para visitas, sesiones, errores y cambios (pedido del usuario: «saber qué pasó en cada momento», incluso visitas a /privacidad). Más simple de consultar y de mostrar con una sola `TablaMaestra` que varias tablas por tipo.
- **Visitas en el proxy, sin cookies**: se registra IP y user agent del lado del servidor; no se pone ningún identificador de visitante, así el aviso de cookies sigue siendo informativo. Declarado en `/privacidad` y `/cookies`.
- **Auditoría por trigger en la base** y no en cada Server Action: cubre todo camino de escritura (formularios, RPC como `emitir_documento`, importación) sin olvidar ninguno. La IP llega por headers `x-cliente-*` desde el cliente de Supabase del servidor. Carritos, líneas y kardex quedan fuera por ruido o por ser ya un historial.
- **Registrar nunca rompe nada**: la app traga los fallos (el código puede desplegarse antes de ejecutar 0011) y el trigger atrapa su propio error.
- **Quién ve qué**: dueño/admin, su empresa (sesiones y cambios); admin de plataforma, todo (visitas anónimas y errores no tienen empresa). Nadie edita ni borra; plazos de 6 meses (visitas) y 2 años (resto) vía `limpiar_registros()`.

## 2026-09-29 · La landing es una demo; términos y privacidad

- **Wake Parts publicado = demo comercial** (pedido del usuario): la portada lo dice junto al arranque y en la sección «Tu versión, a tu medida» (`#contacto`). No hay precios publicados: se acuerdan con cada negocio, con soporte 24/7 y ajustes a la medida. Contacto por WhatsApp y correo desde variables `NEXT_PUBLIC_CONTACTO_*` con default igual al valor real, para poder cambiarlo sin tocar código.
- **`/terminos` y `/privacidad`** junto a `/cookies`, con un marco común (`PaginaLegal`). Privacidad distingue: de la cuenta y la empresa responde quien ofrece Wake Parts; de los clientes de cada empresa, la empresa (nosotros solo procesamos). Términos dejan claro que la demo va «tal cual» y que el servicio real se rige por el acuerdo firmado. Responsable por defecto «Wake Solutions» (deducido del dominio del correo; configurable). **Pendiente: revisión legal.**

## 2026-09-29 · Aviso y política de cookies

- **Aviso informativo, sin botones de aceptar/rechazar**: la app solo usa cookies necesarias (sesión) y de preferencia (`wp_paleta`); no hay nada opcional que consentir. Se muestra una vez (se recuerda en localStorage) con enlace a `/cookies`, que lista cada cookie y dato local. Si en el futuro se agrega analítica o publicidad, el aviso debe convertirse en consentimiento previo.

## 2026-09-29 · Capturas reales en la landing

- **Vitrina con capturas reales** en vez de ilustraciones (pedido del usuario: «que la gente vea lo que va a probar»): mostrador, factura con CAI, reporte, compatibilidad y celular, sacadas del sandbox con datos de ejemplo por un script reproducible (`npm run capturas`) para que no queden viejas cuando cambie la UI. WebP de 55–75 KB; solo la primera se carga con prioridad.
- De paso: los montos del reporte ya no se cortan en tarjetas angostas (el tamaño se ajusta al ancho de la tarjeta con `cqi`).

## 2026-09-29 · Catálogo global solo del admin y categorías propias

- **Catálogo global = un solo dueño** (pedido del usuario): vehículos, categorías generales y relacionadas los edita solo `miltonbarrientos2@gmail.com`. Dos candados: el flag `usuarios.es_admin_plataforma` (RLS, autoridad real; 0010 desmarca a cualquier otro) y la variable `ADMINS_PLATAFORMA` en la app (las acciones genéricas rechazan escribir recursos `admin_plataforma` si el correo no está). La base no puede leer variables de entorno, por eso el flag sigue mandando.
- **Categorías propias por empresa** en la misma tabla (`id_empresa`), como las marcas: así la búsqueda, la importación y los productos las usan sin código aparte. Pueden colgar de una general (p. ej. «Frenos › Pastillas para moto»). Las relacionadas (complementos) siguen solo entre generales para no mezclar recomendaciones entre empresas.
- Inventario › Categorías muestra generales (solo lectura) + propias; Mantenimiento › Categorías generales es el catálogo del admin.

## 2026-09-29 · SEO, reportes, entradas e importación

- **Reportes genéricos** (pedido del usuario: «reutilizable como la tabla maestra»): `TableroReporte` + `DefReporte` + una función SQL con contrato fijo `{indicadores, serie, rankings}`. Lo que la base devuelve en null no se dibuja: así la misma definición sirve para dueño (con utilidad) y vendedor (sin costo).
- **Entradas de inventario con costo promedio ponderado** por defecto: es lo que refleja el costo real cuando se compra a distinto precio; se puede elegir «último costo» o no tocarlo. Van al kardex como «compra» con la referencia del proveedor.
- **Importación en dos pasos (revisar → importar)**: la función hace todo y lo deshace en modo prueba, así los errores por fila salen de las mismas reglas que al guardar. Sin código = siempre producto nuevo (no se adivina por nombre para no mezclar productos). Librerías `read-excel-file`/`write-excel-file` (MIT) en vez de `xlsx` de npm, que está desactualizada.
- **SEO**: la portada pasa a ser landing (el tacómetro de login queda en el hero, `#encender`). 18 páginas por departamento con texto propio cada una (evita contenido duplicado), `geo.region` ISO 3166-2, JSON-LD y FAQ. No se publican precios ni se dice que Wake Parts esté certificado por el SAR: las respuestas fiscales remiten al contador.
- **Ventanas hijas y modo completo**: la capa tapa barra y dock también cuando la enfocada es una hija de una ventana maximizada.

## 2026-09-29 · Ventanas maximizadas por defecto, datos de ejemplo, manual y recorrido

- **Recorrido guiado** (pedido del usuario: «sale una vez y ya»): 15 pasos que abren el mostrador y señalan placa, búsqueda, resultados, carrito, cliente y emitir; luego el dock. No bloquea: se puede tocar lo señalado y avanza solo al abrir Cotizar o minimizar. La marca de visto va en la base (`usuarios.recorrido_visto_en`, 0008) para que no se repita en otra computadora; sin la migración cae a `localStorage`. Se repite desde Mi usuario.
- **Datos de ejemplo al registrar la empresa**: casilla apagada por defecto (un taller real no debería arrancar con productos inventados); si falla la carga, la empresa igual se crea.
- **Manual del propietario en `/ayuda`** (pedido del usuario): página pública (sirve a quien todavía no entra) con 10 capítulos, índice con LED que sigue la lectura, y figuras hechas con las piezas reales (piel de ventana, íconos del dock, odómetro del mostrador, LEDs) para que el manual se vea como la app. Enlaces: portada y barra de menú (pestaña nueva). Los íconos de módulos se movieron a `modulos/iconos-modulos.tsx` para compartirlos.
- **Botón «Cargar datos de ejemplo» en Taller** (pedido del usuario, para que otros talleres prueben): función `cargar_datos_demo` en la base (0007) en vez de un script con la llave secreta, así cualquier dueño/admin la corre sobre su propia empresa con sus permisos (RLS). Idempotente y sin borrar nada. No crea CAI porque es un dato fiscal real.

- **Módulos abren maximizados, sin API de pantalla completa** (pedido del usuario): cada módulo abre ocupando todo el navegador, tapando barra de menú y dock; solo queda el semáforo. Se quitó `requestFullscreen` (el usuario no quería el efecto F11). Para volver al escritorio se minimiza o se achica con el botón verde.

## 2026-09-28 · Productos, compatibilidad, mostrador y facturación

- **Categorías globales, no por empresa**: un árbol curado sirve para el catálogo web y para las «categorías relacionadas»; si cada taller inventara el suyo, las recomendaciones no funcionarían. Lo edita el admin de plataforma. El CSV de ejemplo tenía duplicados («SISTEMA HIFRAULICO»), categorías mezcladas con mano de obra y activos fijos; se rediseñó en 25 ramas por sistema del vehículo + Mano de obra (servicios sin inventario). Los nombres de calle (candelas, fricciones, hules, bomper…) van como **sinónimos** en la búsqueda, no como categorías duplicadas.
- **Marcas de repuestos compartidas**: catálogo general + propias por empresa (`ambito: "compartido"`), para no obligar a cada taller a cargar BOSCH, NGK…
- **Precio sin ISV** y utilidad sobre precio sin ISV: es la utilidad real (el ISV de compras es crédito fiscal). El mostrador muestra siempre el precio con ISV para el cliente. A confirmar con el usuario.
- **Compatibilidad en el nivel elegido con ancestros completados**: una sola fila «COROLLA (todos los años)» en vez de 30; la búsqueda compara columnas directo. Sin filas = producto general.
- **Búsqueda en la base (plpgsql + pg_trgm)**, una sola ida y vuelta: grupos, ajuste y complementos juntos. Forma fonética (`wp_fonetico`) para las faltas de mostrador; la tolerancia a errores (cara) solo corre si la búsqueda exacta no encuentra nada. La misma función sirve para el público (catálogo web) sin exponer costos.
- **Carritos en la base**, no en el navegador: varios clientes a la vez, sobreviven recargas y se ven en otra caja.
- **Emisión en una función security definer** con bloqueo del CAI: numeración sin huecos y totales calculados en la base (el cliente solo muestra).
- **Kardex por trigger** con `set_config('wp.movimiento_*')`: ningún camino puede cambiar existencias sin dejar rastro.
- **Fotos comprimidas en el navegador** (WebP 1600 + miniatura 400): fotos de celular de 5 MB quedan en ~250 KB; la búsqueda carga miniaturas.
- **`useApi` + datos demo**: el mostrador, las fotos y la compatibilidad se prueban en `/dev` sin sesión.

## 2026-09-28 · Usuarios, Taller, Mi usuario y ventanas hijas

- **Alta de empleados por invitación**: no hay contraseñas; se invita un correo de Google con un rol y al entrar queda dentro. Evita crear cuentas a mano y mantiene Google como único login.
- **Nadie se borra**: los miembros se desactivan (se conserva quién hizo qué en facturas e inventario).
- **Reglas de roles en la base** (trigger), no en la UI: nadie se cambia a sí mismo, solo un dueño toca a dueños, siempre queda un dueño.
- **Nombre editable**: Google ya no lo sobrescribe en cada inicio de sesión.
- **Formularios en ventana propia** (pedido del usuario, por espacio): `VentanaFlotante` hija de la ventana del módulo.
- ~~**Maximizar = pantalla completa real**~~ (reemplazado el 2026-09-29) (pedido del usuario: «como un nuevo escritorio»): cubre barra y dock y usa la API del navegador. En móvil no, porque el dock es la navegación.
- **Parpadeo al minimizar**: se cancelaba la animación un cuadro antes de que React ocultara la ventana; ahora se oculta con `flushSync` y recién después se suelta la animación.
- **`ambito: "empresa"`** en la capa genérica: base para todas las tablas operativas multiempresa.

## 2026-09-28 · Multiempresa, componentes genéricos y Mantenimiento

- **Usuarios**: tabla `usuarios` 1:1 con `auth.users`, sincronizada por trigger (no se duplica lógica de registro en la app). Roles en tabla (`dueno`, `admin`, `vendedor`) para poder agregar más sin migrar enums.
- **Onboarding obligatorio**: sin empresa no se entra al escritorio. La empresa se crea con la RPC `crear_empresa` (security definer) para que el alta de empresa + membresía de dueño sea atómica y nadie pueda insertarse en empresas ajenas.
- **Catálogo global de vehículos**: lo edita solo un **admin de plataforma** (`usuarios.es_admin_plataforma`), no los dueños de cada empresa, porque es compartido. Los demás lo ven en solo lectura.
- **Lectura por vistas `v_*`** aplanadas en vez de joins anidados de PostgREST: filtrar y ordenar por cualquier columna (marca, modelo…) queda trivial y genérico.
- **Definiciones de recurso como datos** (sin funciones) para compartirlas entre cliente y servidor; el servidor valida todo contra ellas.
- **Preferencias de tabla en la base**, por usuario (no en localStorage), para que sigan al usuario entre equipos. Los filtros no se guardan (son de la sesión de trabajo).
- **Ventanas**: la posición y el tamaño sí van en localStorage (dependen de la pantalla de cada equipo).
- **Sandbox `/dev/*`** solo en desarrollo, para que los agentes verifiquen UI sin credenciales.

## 2026-09-28 · Integridad del catálogo (migración 0001)

- Todas las migraciones son **idempotentes** y transaccionales (pedido del usuario). `0000` se reescribió con `if not exists` sin cambiar su efecto.
- Al analizar los datos reales se encontraron modelos duplicados por tabs, 222 años duplicados, años de 2 dígitos, ~1 000 especificaciones duplicadas y cilindrada en texto libre. `0001` consolida duplicados (conserva id menor, re-apunta hijos, respalda en el esquema `respaldo`), agrega `motor_cc` entero y restricciones.
- `motor_tamanio_cc` **no se eliminó** (queda como legado y se volvió nullable) por si otra app lo usa; se puede eliminar en una migración futura.
- Texto del catálogo en MAYÚSCULAS normalizado por trigger, así las restricciones unique no dependen de cómo se escriba.
- RLS: el catálogo es de lectura pública (lo usará el catálogo web); escritura solo con `service_role` por ahora.
- Registros que quedaron **por revisar a mano** (no se corrigieron por falta de certeza): ver «Datos por revisar» en `database.md`.

## 2026-09-28 · Arranque del proyecto

- Next.js 16 + Supabase. Login **solo con Google**, todo del lado del servidor (Server Action + callback + proxy), así la llave publicable no llega al navegador.
- Dirección visual: skeuomorfismo de cabina automotriz; paletas por empresa, defecto rojo/negro y rojo/blanco. Mientras no exista la tabla de empresas, la paleta vive en una cookie.
- Shell tipo macOS (barra de menú + dock) donde cada módulo del ERP es una app.
- Se cambió la curva con rebote del dock por `--ease-expo` (los rebotes se ven anticuados).
