# Bitácora de decisiones · Wake Parts

Entradas nuevas arriba. Formato: fecha, decisión, por qué.

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
