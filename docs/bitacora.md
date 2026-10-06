# Bitácora de decisiones · Wake Parts

Entradas nuevas arriba. Formato: fecha, decisión, por qué.

## 2026-10-06 · Dock: lupa, reordenar arrastrando y vuelos (sin migración)

- **Pedido del usuario**: reordenar los íconos arrastrándolos, que vuelen entre la guantera y el dock, y un efecto al pasar el mouse «como Apple».
- **Lupa por tamaño, no por `transform`**: para que los vecinos se aparten de verdad (como en macOS) el ícono cambia `width`/`height`; son ~15 elementos y se calcula en un solo `requestAnimationFrame` por movimiento del mouse. Un margen negativo deja la repisa del mismo alto: el dock solo se ensancha.
- **Arrastre con Pointer Events, no con el drag & drop del navegador**: el nativo muestra un fantasma semitransparente y no deja animar a los vecinos. Solo con mouse o lápiz: en el teléfono el dock se desliza de lado y un arrastre chocaría con el desplazamiento; ahí (y con teclado) se mueve desde el menú del ícono.
- **Orden dentro del mismo `usuarios.dock`** (campo `orden`): no hizo falta migración. Inicio queda siempre primero. Los módulos guardados conservan su lugar al reordenar los visibles.
- **Vuelos con la Web Animations API + FLIP** (medir antes, animar desde ahí después del render): todo es `transform`/`opacity`. El vuelo a la guantera tiene un respaldo con `setTimeout` por si la animación no llega a terminar (pestaña en segundo plano).

## 2026-10-06 · Dock personalizable y guantera (migración 0020)

- **Pedido del usuario**: mostrar y ocultar módulos del dock, cambiar el color de algunos íconos y un botón en el dock que despliegue los ocultos «como un popover».
- **Por usuario, no por empresa**: el dock es la herramienta de cada persona (el cajero no usa lo mismo que el dueño). Se guarda en `usuarios.dock` para que siga al usuario entre equipos (como las preferencias de tablas); el navegador guarda una copia que se usa sin la migración o en la demo. Los permisos no cambian: ocultar es solo de vista.
- **«Guantera»** en vez de «cajón» o «más»: encaja en la cabina y dice lo que hace (lo que no va a la vista, pero está a mano). Dos modos en el mismo popover: los guardados (se abren de un toque) y Personalizar (interruptor «en el dock» + seis esmaltes por módulo). Clic derecho sobre un ícono para lo rápido.
- **Seis esmaltes fijos**, no un selector de color libre: un color libre rompe la paleta (y la regla de solo tokens); seis esmaltes de tablero se ven bien en las dos paletas. Rojo sigue al acento de la empresa.
- **Inicio no se oculta** (es el escritorio). Un módulo guardado con su ventana abierta aparece en el dock mientras se usa, como en macOS, para poder volver a él.
- El recorrido guiado no cambia: si alguien guardó un módulo que el recorrido señala, la tarjeta sale centrada (el recorrido es para la primera vez, con el dock de fábrica).

## 2026-10-06 · Módulo Notas y notas sin factura (migración 0019)

- **Pedido del usuario**: las notas de crédito/débito como módulo propio, y poder hacerlas **sin factura relacionada** «para otros gastos que ocurran». Desde Ventas › Documentos se siguen haciendo sobre la factura abierta.
- **Módulo Notas** en el dock (dueño/admin, los únicos que emiten notas): «Nueva nota» (compositor) y «Notas» (listado `v_notas`, abre el mismo detalle de Documentos). El compositor elige tipo con dos teclas con el código del SAR (06 · 07) y la relación «Sin factura | Sobre una factura» (buscador por número o cliente con el saldo); debajo va el mismo `NotaEditor`, que ahora acepta `factura = null`.
- **Función aparte** (`emitir_nota_libre`) en vez de volver opcional el parámetro de `emitir_nota`: las reglas de la nota sobre factura (saldo, devoluciones, exoneración heredada) no se tocan y la libre queda corta y fácil de auditar.
- **Sin devolución sin factura**: sin líneas de origen no hay tope de unidades ni costo; para devolver piezas de una venta vieja (antes del sistema) habría que diseñarlo aparte.
- **Liquidación obligatoria de elegir**, sin valor por defecto: con forma de pago la nota mueve la caja (`forma_pago` propio); «Sin dinero» deja solo el documento. Un valor por defecto («efectivo») habría descuadrado cajas sin que nadie lo note.
- **No entra a cuentas por cobrar**: el saldo se lleva por factura; un cargo suelto que se deba se factura al crédito. Ajustable si el usuario lo pide.
- **A verificar con el contador** si el SAR admite estas notas sin documento de origen (anotado en `negocio.md` §3.7).

## 2026-10-03 · Toma rápida de productos y foco de ventanas

- **Toma rápida** (pedido del usuario: captura rápida desde el teléfono para empresas nuevas): módulo propio en el dock (dueño/admin), sin migración. Guarda con `useApi("recursos").guardar("productos")` + los `porDefecto` de la definición, así valida y se comporta igual que Inventario › Productos y funciona en la demo. Mínimo: foto, nombre, categoría (obligatoria en la definición), precio (vacío = 0, el marbete lo marca «Sin precio»), existencia y condición; ubicación y OEM plegados. Categoría, condición y ubicación **se quedan** entre piezas (se carga por estante). La foto se comprime y sube **en segundo plano** (LED por pieza, «Reintentar» si falla) para no frenar la siguiente toma. `capture="environment"` abre la cámara trasera; «Galería» para fotos ya tomadas. Acceso directo: `/inicio?abrir=toma` y `shortcuts` del manifest.
- **Bug de foco de ventanas**: las hijas se montan por portal y los eventos de React suben por el árbol de React, no por el DOM; un clic en una nieta (p. ej. la nota de crédito dentro del documento de Ventas) disparaba `onPointerDownCapture` en sus ancestras, que pasaban adelante y la tapaban. Ahora solo reacciona la ventana que contiene el clic en el DOM, y `alFrente`, minimizar, restaurar y cerrar recorren **todas** las descendientes (antes solo las hijas directas: una nieta quedaba visible al minimizar el módulo).

- **Instalable y responsive**: la app ya era instalable (manifest + íconos); se sumó `appleWebApp` (en iOS abre sin la barra de Safari) e `id` en el manifest. Sin service worker: no hace falta para instalar en Android/Chrome y la app no funciona sin conexión (factura contra la base); si algún día se quiere una página «Sin conexión», ahí se agrega. Revisión a 375, 768 y 1024 px: el **dock no cabía en el teléfono** (752 px de íconos, la mitad inalcanzable); bajo 820 px ahora es una repisa que se desliza de lado con imán, sin etiquetas flotantes. El título del módulo en la barra se corta con «…» en vez de partir en dos líneas.
- **Ventanas en el teléfono** (pedido del usuario: «lo usarán personas mayores con dedos grandes, como mecánicos»): bajo 768 px toda ventana abierta tapa barra y dock y solo se cierra, con un botón «Cerrar» con texto (36 px a la vista; se achicó a pedido del usuario, pero conserva 44 px de zona táctil); minimizar y achicar se quitaron ahí porque no aportan. Antes el módulo dejaba barra y dock a la vista (el dock era la navegación); ahora se navega cerrando y eligiendo otro módulo. En la barra del teléfono se ocultan el nombre del módulo y las perillas de paleta (sigue en Taller › Apariencia) para que quepa el nombre del taller, y «Mi usuario» muestra la inicial cuando no hay foto (antes era un botón vacío).
- **Correo desde el sistema** (pedido del usuario, para Seguimiento): SMTP de Zoho (`ventas@wake.solutions`) con nodemailer 10 en `lib/correo.ts`, solo servidor. Se eligió SMTP y no un servicio de envío (Resend, SES…) porque el usuario ya tiene la cuenta y el volumen es de uno en uno. El destinatario **no viaja desde el navegador**: la acción recibe el id del taller y lee el correo del dueño con RLS (evita que alguien use el sistema para mandar correos a cualquier dirección). Confirmación en línea mostrando la dirección antes de enviar; al salir bien marca contactado hoy y queda en el registro de actividad. HTML sobrio escapado + texto plano. Se quitó `@types/nodemailer` (la v10 trae sus tipos).

## 2026-10-02 · Exportación de datos y documentos legales

- **Exportar todos los datos** (pedido del usuario; lo promete el contrato, cláusula novena): Taller › Datos, solo dueño/admin. Un .zip con un Excel por tema y un LEEME. Se arma **en el navegador** (el servidor solo entrega filas, paginadas de a 1000): no hay archivos temporales en el servidor ni límites de tiempo de una función. Las fotos no van en el zip (pesan mucho); la hoja «10 Fotos» lista sus rutas. Cada exportación queda en el registro de actividad (`empresa.exportar`).
- **Documentos para el abogado** en `docs/legal/`: «Revisión legal» (el negocio en una página, qué revisar, 37 preguntas con espacio para respuestas, decisiones y los textos publicados como anexo) y el contrato de servicio en versión de revisión (PDF con notas que remiten a las preguntas) y editable (.docx sin notas, campos en amarillo, plan a marcar en el Anexo A). El usuario no sabe de leyes: todas las dudas legales quedaron como preguntas en esos documentos, no como afirmaciones.

## 2026-10-02 · Plan de lanzamiento (evaluación con las respuestas del usuario)

- Hecho en este ciclo: notas de crédito/débito, devoluciones, exoneraciones, puntos de emisión (0016), crédito y cuentas por cobrar (0017), caja con arqueo (0018), ticket térmico. Cubre lo que un yonker pide la primera semana.
- Confirmado por el usuario: el SAR no exige registrar el sistema; respaldos con plan pago de Supabase; soporte 24/7 sí; un abogado revisa términos y privacidad; pruebas automáticas, después.
- Antes de vender abierto: reunión con contador (redondeo del ISV, precios sin ISV, leyendas, requisitos de exoneración, umbrales de CAI por vencer); cierre legal (términos, privacidad, contrato de servicio); ~~exportación completa de datos~~ (hecha el mismo día); respaldo de **Storage** (fotos y logos no van en el respaldo de la base); precio publicado en la landing; que la propia empresa de Wake Parts facture la suscripción con su CAI.
- Propuesta de precio (a validar con 3–5 talleres): Mostrador desde L 690/mes · Taller L 1,190/mes · Multisucursal L 1,890/mes; anual = 10 meses; implementación opcional L 2,500. Sin licencia perpetua; si se ofrece pago único, L 14,900 + L 250/mes de servicio.

## 2026-10-02 · Ticket de 80 mm

- **Pedido del usuario**: impresión en ticket de 80 mm, «igual, personalizable siempre».
- **Mismo formato, otra salida**: el ticket se configura en Taller › Factura junto al diseño de la hoja (papel predeterminado, ancho 80/58 mm, letra, logo) y reutiliza lema, mensaje y «qué mostrar». Va en `formato_documento` (jsonb): **sin migración**.
- **Cambio de papel en la página de impresión** (Carta · Ticket): un mostrador puede tener térmica y a veces pedir carta (cliente empresa), sin tocar la configuración.
- **Impresión del navegador, no ESC/POS**: funciona con cualquier térmica instalada como impresora del sistema, sin drivers ni apps extra. Lo único que hay que elegir en el diálogo es la impresora y márgenes «Ninguno». Si un taller quiere imprimir sin diálogo (kiosco/QZ Tray), es otra etapa.
- Todo sale en tinta negra (las térmicas no tienen color) y el logo en escala de grises.

## 2026-10-02 · Módulo de Caja (migración 0018)

- **Pedido del usuario**: cierre de caja y arqueo del día, «un módulo de caja».
- **Turno por punto de emisión**, no por persona ni por día: la caja física es la computadora que cobra (ya tiene su punto y su CAI). Varios cajeros pueden vender en el mismo turno; uno por punto abierto a la vez.
- **Los documentos se pegan al turno al emitirse** (`id_turno`), en vez de calcular por rango de horas: anular después o un reloj desfasado no mueve nada de turno. El cierre bloquea con `for share` para que ninguna venta quede a medias.
- **Forma de pago en la venta de contado**, una por factura (sin pagos mixtos por ahora: en mostrador casi siempre es una). «Paga con» calcula el cambio sin guardarlo.
- **Las devoluciones salen con la forma de pago de su factura** (supuesto razonable; ajustable si el usuario lo pide).
- **Caja obligatoria apagada por defecto**: los talleres que hoy no usan caja no se traban; el dueño la enciende cuando quiera control.
- **Diferencia con nota obligatoria**: el faltante o sobrante queda explicado en el corte, que es lo que se revisa al día siguiente.
- **Reporte de ventas neto**: resta notas de crédito y suma débitos (quedaba pendiente desde 0016) e informa «Devoluciones».
- **Diseño**: momento firma en el cierre: billetes y monedas como fichas que se encienden al contarlas y un **amperímetro de centro cero** (falta a la izquierda, sobra a la derecha) cuya aguja se asienta sin rebote; LED verde «Cuadra». El turno abierto usa el odómetro LCD del mostrador para «el efectivo que debería haber» y la cuenta escrita como suma de papel de caja.

## 2026-10-02 · Ventas al crédito y cuentas por cobrar (migración 0017)

- **Pedido del usuario**: permitir ventas al crédito y cuentas por cobrar («muchos talleres compran fiado»).
- **El crédito lo da el dueño, el vendedor solo lo usa**: habilitar, límite y plazo son de dueño/admin (trigger). En el mostrador, un vendedor no puede pasar el límite ni venderle a quien tiene vencidas; dueño/admin sí, porque es su riesgo y en mostrador se negocia.
- **Lo pendiente se calcula, no se guarda**: total + débitos − créditos − abonos en una vista. Así una nota de crédito o un recibo anulado se reflejan solos y nunca hay dos números que no cuadren.
- **Recibos sin valor fiscal** (`REC-000001`): el abono no es un documento del SAR; la factura ya se emitió. Numeración propia, inmutable, se anula.
- **Reparto visible = reparto guardado**: el estado de cuenta muestra «abona L X» en cada factura (las más antiguas primero o las marcadas) y manda ese reparto explícito; la base vuelve a validar contra lo pendiente.
- **Contado = cobrado al emitir**: el dinero real (efectivo, tarjeta) se cuadra en el módulo de Caja, que es el siguiente.
- **Diseño**: el tablero de cartera es el momento firma: odómetro LCD con lo que te deben y la **antigüedad de saldos como una banda de tablero** (verde al día → rojo +90 días) que se llena al abrir. El estado de cuenta repite el lenguaje: medidor de crédito usado/límite con lo vencido rayado, y una consola de abono con el monto en LCD.

## 2026-10-02 · Notas de crédito/débito, exoneraciones y puntos de emisión (migración 0016)

- **Pedido del usuario** (punto 1 de «qué falta para vender»): notas de crédito y débito, exoneraciones, devoluciones y varios puntos de emisión por usuario o sucursal. Confirmó que el SAR no exige registrar el sistema emisor.
- **Códigos SAR 06 y 07** para notas de crédito y débito (Acuerdo 481-2017). Igual se guardan en cada CAI, así un cambio de normativa es un dato y no código.
- **Punto de emisión = tabla propia** y el CAI apunta a él (antes eran dos textos en el CAI). Así una sucursal tiene dirección, una caja tiene nombre y a cada persona se le asigna la suya. Los puntos se crearon solos desde los CAI existentes: nada cambia para quien ya factura.
- **Devolución = nota de crédito con líneas de la factura**, no un documento aparte: es lo que pide el régimen y deja trazado qué pieza volvió. Reintegrar al inventario es opcional (piezas dañadas) y anular la nota lo revierte.
- **Al devolver todo una línea se acredita lo que le queda, no un recálculo**: evita que la suma de notas difiera por centavos del total de la factura. El ISV tiene tolerancia de 2 centavos por el redondeo global.
- **Una factura con notas vigentes no se anula**: si no, el saldo y el inventario quedarían contados dos veces.
- **Exoneración en el carrito**, copiada del cliente: el vendedor solo agrega la orden de compra exenta, que es de cada compra. Cualquier rol puede facturar exonerado (es de mostrador); queda auditado. A confirmar con el contador qué dato es obligatorio (se exige RTN + orden de compra exenta **o** constancia).
- **Diseño**: el editor de notas es una ficha de tablero con un **medidor de saldo** (pista tipo aguja de combustible: verde lo que queda, franja de acento lo que la nota acredita o carga), teclas metálicas para el motivo y LED por línea devuelta. El total va en el mismo odómetro del mostrador.
- De paso: las columnas de fecha pura (fecha límite del CAI) se mostraban un día antes por la zona horaria, y el «Imprimir» de la demo armaba mal la dirección. Corregidos.

## 2026-10-01 · Demo sin cuenta, landing y seguimiento de talleres (migración 0015)

- **Demo pública `/demo`** (pedido del usuario: que la gente pruebe el sistema sí o sí). El usuario pidió «un patrón oscuro»; se decidió **no** usar engaños (contadores falsos, reseñas inventadas, avergonzar al que no se registra, trabas para salir): mercado chico de boca en boca, se vende confianza fiscal, riesgo con la ley de protección al consumidor y con la revisión de Google OAuth. En su lugar: **cero fricción** (el sistema completo sin cuenta), CTA siempre visible y una invitación en el mejor momento (justo después de la primera venta). Todo dice que es una demo y que nada se guarda.
- **La demo es el escritorio real**, no una maqueta: se volvieron inyectables las tablas genéricas, la empresa y el perfil (`useApi("recursos" | "empresa" | "perfil")`) y se agregó un motor en memoria para TablaMaestra. Lo que mejora en el producto aparece solo en la demo.
- **Ayuda humana por WhatsApp** junto al arranque, en el llamado final, en la demo y en el registro de la empresa: en pymes hondureñas acompañar convierte más que cualquier pantalla.
- **Seguimiento manual, no automático**: el usuario prefirió ver quién se registró y no avanzó para escribirle él mismo. Módulo **Seguimiento** (solo admin de plataforma) con etapa de cada taller, mensaje sugerido por etapa (editable), botones a WhatsApp/correo y nota de contacto. No se guardan consentimientos de marketing porque no hay envíos automáticos.
- Landing: «Probar demo» en el encabezado, «Probalo sin cuenta» bajo el arranque, sección «Tu taller, en internet» (catálogo web, pedidos con campanita) y capturas nuevas (sitio, catálogo, campanita).

## 2026-10-01 · Notificaciones y tareas pendientes (migración 0014)

- **Pedido del usuario**: que los pedidos web «tengan que ser atendidos» y avisen con una campanita.
- **Tareas que se cierran solas**: la base crea la tarea al entrar el pedido y la resuelve cuando se atiende o descarta (trigger). Nadie tiene que acordarse de marcarla; no hay forma de que la tarea y el pedido digan cosas distintas.
- **Tarea compartida, leído por usuario**: cualquiera del equipo puede atender el pedido y desaparece para todos; «leído» es de cada uno.
- **Genérico desde el inicio** (`tipo`, `enlace`, `origen_*`): la próxima fuente (CAI por vencer, existencia baja) es solo un trigger más. No se agregó la del CAI porque los umbrales («80 % del rango, 30 días») siguen marcados «a confirmar» en negocio.md §3.5.
- **Consulta cada 30 s en vez de tiempo real**: Supabase Realtime pide la llave en el navegador y la regla 7 lo impide. Solo con la pestaña visible; al atender se refresca al instante.
- **Insignia en el ícono del módulo del dock** y aviso emergente breve (9 s): se nota sin interrumpir. Sin sonido ni notificaciones del sistema operativo (pedirían permiso al navegador).

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
