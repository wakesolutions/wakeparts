# Sistema de diseño · Wake Parts

## Concepto

**La cabina de un auto, vista con calma.** Híbrido entre skeuomorfismo automotriz (metal satinado, instrumentos, LEDs, placa, odómetro) y el minimalismo de Apple: superficies casi planas, filos de luz de 1 px, mucho aire. La app es el tablero del negocio y se usa **todo el día**: lo táctil se insinúa, no se grita.

- **Regla del uso diario**: lo que se ve en cada carga o en cada fila (barra, dock, tablas, formularios) va sobrio: sin texturas de patrón, sin halos grandes, sin animaciones en bucle. Los momentos expresivos (barrido del tacómetro, odómetro, sello «Facturado») se reservan para eventos puntuales.
- **Google no se nombra en la UI**: el botón dice «Entrar». Solo las páginas legales explican que el acceso es con Google.

- Tensión visual: materiales pesados y táctiles contra tipografía condensada y afilada.
- Momento firma actual: en el login, el botón **Entrar** es un botón de arranque dentro de un tacómetro. La aguja hace un barrido corto al cargar y acelera al hacer clic (sin vibración de ralentí ni LED que respira).
- Metáfora de escritorio: barra de menú superior + **dock** inferior estilo macOS. Cada módulo del ERP es una «app» del dock.

## Identidad de cada empresa (0012)

El sistema se viste con la marca de cada taller (Taller › Apariencia y Factura; código en `components/identidad/` y `lib/identidad.ts`):

- **Color de marca**: reemplaza al rojo en todo. Se deriva de un solo hex con `tokensAcento()` y se inyecta como `:root[data-paleta]{…}`. Por eso los componentes **solo** usan `--wp-accent*`: nunca un rojo fijo.
- **Fondo del escritorio** con velo del color de la paleta (más fuerte a la izquierda, donde va el saludo). Sin fondo propio queda el de Wake Parts.
- **Logo**: en la barra (reemplaza la marca Wake Parts), en el saludo de Inicio, en la placa de Taller y en los documentos.
- **Ticket térmico** (`components/impresion/tira.tsx`): tira de 80 o 58 mm siempre en tinta negra, una columna, cifras en mono a la derecha, cortes con línea punteada; `@page` del ancho del rollo y sin márgenes. Respeta lema, mensaje, «qué mostrar», logo (en escala de grises) y letra normal/grande del formato. Facturas y notas imprimen los mismos datos fiscales que en carta.
- **Documentos**: `DocumentoVista` recibe `identidad`; `--doc-marca` es el color de la empresa o tinta negra. Variantes por `data-estilo` (moderno, clásico serif, compacto), `data-tabla`, `data-logo` y `data-logo-tamano`.

## Sitio público de cada taller (0013)

`app/t/[slug]/_componentes/sitio.module.css`. Es una vitrina, así que tiene más aire y más escala que el escritorio, con el mismo sistema: Saira condensada en mayúsculas para títulos (hasta ~9 rem), Mono para etiquetas, solo tokens `--wp-*`.

- **Momento firma**: la portada con la foto de fondo del taller (velo de su paleta) y el buscador «¿Qué carro tenés?» (la misma placa troquelada del mostrador, en modo `publico`) flotando en vidrio esmerilado.
- Tarjetas de producto planas con filo de 1 px; sello verde «Le queda», ámbar «Confirmá año o motor». Sin foto: ícono de pieza propio, nunca una imagen genérica.
- Movimiento: el título sube por líneas y el resto entra en cascada corta (≤ 600 ms) solo al cargar; hover de tarjeta de 3 px. Nada en bucle.
- Celular: navegación inferior fija (Inicio, Catálogo, Nosotros, Tu lista) y botón de lista siempre visible.

## Paletas (base del tema)

Todo color sale de tokens CSS definidos en `app/globals.css` bajo `[data-paleta="<id>"]`. El `<html>` lleva el atributo; hoy se lee de la cookie `wp_paleta` y en el futuro vendrá de la empresa.

| Paleta | Uso |
|---|---|
| `rojo-negro` (defecto) | Cabina oscura, acento rojo racing. |
| `rojo-blanco` | Tablero claro, aluminio y rojo. |

**Tokens** (ambas paletas deben definir todos):

| Grupo | Tokens |
|---|---|
| Fondo | `--wp-bg`, `--wp-bg-deep`, `--wp-bg-glow` |
| Metal | `--wp-metal-hi`, `--wp-metal-lo`, `--wp-metal-edge`, `--wp-bevel-light`, `--wp-bevel-dark` |
| Tinta | `--wp-ink`, `--wp-ink-2` (secundario), `--wp-ink-3` (terciario), `--wp-engrave` |
| Acento | `--wp-accent`, `--wp-accent-hi`, `--wp-accent-lo`, `--wp-accent-glow`, `--wp-on-accent` |
| Instrumentos | `--wp-dial`, `--wp-dial-ink`, `--wp-lcd`, `--wp-lcd-ink` |
| Detalle | `--wp-stitch`, `--wp-grain-opacity` |

En Tailwind están expuestos como `text-wp-ink`, `text-wp-ink-2`, `text-wp-ink-3`, `text-wp-accent`, `bg-wp-bg`.

**Agregar una paleta**: 1) bloque `[data-paleta="nueva"]` en `globals.css` con **todos** los tokens; 2) entrada en `PALETAS` de `lib/paletas.ts` con `muestra` (2 colores para la perilla); 3) revisar login y escritorio con ella. Nunca negro ni blanco puros: usar tonos cálidos (`#121010`, `#efebe4`).

## Tipografía

- **Saira** (variable, eje `wdth`) para todo. Títulos: `font-extrabold`, `uppercase`, `wdth` 58–72, tracking negativo (`-0.03em`), `leading` 0.8–0.85.
- **JetBrains Mono** para etiquetas técnicas, lecturas LCD y números: mayúsculas, tracking amplio (`0.16–0.3em`), tamaño 0.7–0.75 rem.
- Contraste de escala fuerte: títulos con `clamp()` de hasta ~15 rem frente a cuerpo de 1–1.25 rem.

## Texturas y utilidades (`globals.css`)

| Clase | Qué es |
|---|---|
| `.wp-cabina` | Fondo cuero perforado + viñeta roja (login). |
| `.wp-carbono` | Fondo liso del escritorio con un leve resplandor arriba (el nombre quedó de cuando era fibra de carbono). |
| `.wp-metal` | Metal satinado: degradado mínimo + filo de luz de 1 px (barras, paneles). Sin cepillado. |
| `.wp-grabado` | Texto grabado sutil. No usar en la UI diaria. |
| `.wp-costura` | Costura punteada interior (paneles de cuero). |
| `.wp-linea > span` | Revelado de línea de título que sube desde abajo. |
| `.wp-entra` | Aparición suave (opacidad + 12 px). |

## Movimiento

- Curvas: `--ease-expo` (salidas), `--ease-quart` (interacciones cortas), `--ease-inout` (barridos). **Prohibido**: `linear`, `ease`, rebotes o elásticos.
- Solo se animan `transform` y `opacity` (excepción: brillos de LED con `box-shadow`/`background` en elementos pequeños).
- Coreografía de carga con `animationDelay` escalonado: estructura → título por líneas → texto → controles (0–1300 ms).
- `prefers-reduced-motion` desactiva todo (regla global en `globals.css`).
- Cada animación tiene una razón física y se justifica en uso diario. Entradas de contenido ≤ 360 ms. Nada en bucle salvo indicadores de carga.

## Componentes

Detalle técnico y API en [`componentes.md`](componentes.md). Lineamientos visuales:

- **Ventanas**: barra de título satinada con título en tipo oración (no mayúsculas), semáforo de tres luces (gris cuando la ventana no está enfocada), sombra suave (`--wp-sombra-ventana`). Minimizar «vuela» hacia el ícono del dock; abrir sale del dock. En el teléfono no hay semáforo: botón «Cerrar» de acento con texto (36 px a la vista, 44 px de zona táctil) (lo usan mecánicos y gente mayor, dedos grandes) y la ventana tapa barra y dock.
- **Tablas**: marco levemente hundido (`--wp-field`), encabezado metálico con etiquetas en mono, números en mono alineados a la derecha, fila seleccionada con barra LED roja a la izquierda, LED que barre el borde superior mientras carga.
- **Formularios**: etiquetas mono en mayúsculas, campos apenas hundidos (sombra interior de 1 px), obligatorio = punto LED rojo, opciones como teclas metálicas que se hunden al elegirse.
- **Tokens adicionales**: `--wp-panel`, `--wp-panel-2`, `--wp-field`, `--wp-line`, `--wp-hover`, `--wp-sel`, `--wp-ok`, `--wp-aviso` (ámbar de tablero: existencia baja, «verificar»), `--wp-sombra-ventana` (ambas paletas). Papel para documentos impresos (iguales en todas las paletas): `--wp-papel`, `--wp-papel-2`, `--wp-papel-tinta`, `--wp-papel-tinta-2`, `--wp-papel-linea`.
- **Mostrador**: el vehículo es una **placa troquelada** (banda de acento, remaches, letras en relieve); el total es un **visor LCD con odómetro** (dígitos que ruedan, solo `transform`); al emitir cae un **sello de goma** («Facturado» + número). Semáforo de existencia con LED verde/ámbar/rojo y etiquetas de ajuste (verde = le queda, ámbar = verificar).
- **Compatibilidad**: columnas hundidas tipo Finder con LEDs de asignación: lleno = asignado, mitad = parte asignada, tenue = incluido por un nivel superior.
- **Formularios largos**: títulos de sección en mono con línea que se desvanece; campos calculados como lectura rayada de instrumento (verde si es positivo).

- **Dock** (`app/inicio/_components/dock.tsx`): los módulos se agregan en el arreglo `MODULOS` (`href`, `nombre`, `icono` SVG propio). Ícono = squircle esmaltado con el gradiente de acento y glifo blanco. Punto bajo el ícono activo. Magnificación leve (×1.08) en hover/focus con `--ease-expo`. Barra y dock no se animan al cargar.
- **Dock personalizable** (0020): cada usuario guarda módulos en la **guantera** (botón al final del dock, con contador LCD) y elige el **esmalte** de cada ícono: grafito (de fábrica), rojo (acento de la empresa; Inicio), ámbar, verde, azul o marfil. Los esmaltes son tokens `--wp-esmalte-*` iguales en todas las paletas (como las teclas de un tablero); cada uno redefine `--wp-accent`/`--wp-accent-lo` dentro del svg para que los detalles del glifo combinen. Clic derecho sobre un ícono: esmalte, «Guardar en la guantera», «Personalizar el dock…». Al guardarlo, el ícono «cae» hacia la guantera (260 ms); un módulo guardado con su ventana abierta se asoma en el dock con el punto ámbar.
- **Barra de menú**: marca, perillas de paleta, reloj (hora de Honduras), usuario, botón **Salir** (cerrar sesión; discreto, rojo solo al pasar el mouse).
- **Instrumento de arranque** (`app/_components/arranque.tsx`): tacómetro SVG generado (0–8 ×1000 rpm, zona roja desde 6.5) + botón con bisel cromado.

## Reglas

- Sin emojis ni librerías de íconos genéricas: íconos SVG propios, simples, con relleno.
- Sin cursores personalizados salvo que el usuario lo pida.
- Foco visible siempre (`:focus-visible` con el acento).
- Diseño para móvil primero: sin scroll horizontal a 375 px; la acción principal debe verse sin mucho scroll.
- Textos de UI en español con voseo, breves y concretos.
