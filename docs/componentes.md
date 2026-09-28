# Componentes reutilizables · Wake Parts

Guía para construir pantallas de datos. **Leela antes de crear cualquier listado o formulario.**

## Receta: «tabla master para listar X»

Cuando el usuario pida la tabla maestra (o el mantenimiento) de una tabla `x`:

1. **Vista de lectura** (migración nueva): `public.v_x` con `security_invoker = true`, que aplane los joins que haga falta mostrar (nombres en vez de ids) e incluya los ids de relación que use el formulario. Dar `grant select` a los roles que correspondan.
2. **Definición** en `lib/recursos/<dominio>.ts`: un objeto `DefRecurso` (ver abajo) y registrarlo en `RECURSOS` de `lib/recursos/index.ts`.
3. **Pantalla**:
   - Solo listar: `<TablaMaestra recurso="x" />`
   - Listar + crear/editar/eliminar: `<MantenimientoRecurso recurso="x" puedeEditar={…} />`
4. Si es un módulo nuevo del escritorio: componente en `app/inicio/_components/modulos/` y entrada en `MODULOS` (`modulos/index.tsx`). Aparece en el dock y abre en ventana.

No hace falta tocar los componentes genéricos. Si algo no se puede expresar con la definición, extendé los tipos de `lib/recursos/tipos.ts` y el componente, sin hacer casos especiales por tabla.

## `DefRecurso`

```ts
export const marcas: DefRecurso = {
  id: "marcas",                    // clave del registro y de las preferencias
  nombre: "marca", nombrePlural: "Marcas", genero: "f",   // textos: «Nueva marca»
  vista: "v_marcas",               // lectura (filtros, orden, búsqueda)
  tabla: "marcas",                 // escritura (insert/update/delete)
  clave: "id",
  escritura: "admin_plataforma",   // | "empresa" (dueño/admin) | "miembros" (cualquier rol) | "ninguna"
  titulo: "marca",                 // columna(s) para el título del panel de edición
  orden: [{ columna: "marca", dir: "asc" }],
  columnasInternas: ["id_marca"],  // columnas de la vista usables en relaciones, no visibles
  columnas: [ /* DefColumna[] */ ],
  campos: [ /* DefCampo[] */ ],
  ambito: "empresa",               // opcional: filtra y asigna id_empresa de la empresa activa
                                   // "compartido": filas globales (id_empresa null) + las de la empresa
  ventana: { w: 980, h: 760 },     // opcional: tamaño de la ventana del formulario
  acciones: { crear: false },      // opcional: desactivar crear/editar/eliminar
  mensajes: { duplicado: "…", enUso: "…" },  // errores 23505 / 23503 en español
};
```

### Columnas (`DefColumna`)

| Propiedad | Uso |
|---|---|
| `clave`, `etiqueta`, `tipo` | Columna de la vista; `tipo`: `texto`, `entero`, `decimal`, `booleano`, `fecha`. |
| `ancho` | Ancho inicial en px (el usuario puede arrastrar). |
| `oculta` | Oculta por defecto; aparece en el panel de columnas. |
| `buscable` | Entra en la búsqueda rápida (texto: contiene; números: igual). |
| `ordenable` | `false` para desactivar el orden. |
| `filtro` | Por defecto se deduce del tipo. `{ tipo: "opciones", fuente: { recurso, valor, etiqueta } }` para una lista de otra tabla; `{ tipo: "opciones", opciones: [...] }` para una lista fija; `false` para desactivarlo. |
| `formato` | `miles`, `litros`, `cc`, `anio`, `codigo`, `moneda` (L 1,234.50), `porcentaje`, `imagen` (ruta de Storage → miniatura). |
| `alerta` | Columna booleana de la fila que pone la celda en ámbar con LED (p. ej. `bajo_minimo`). |
| `vacio` | Texto cuando el valor es nulo o 0 (p. ej. «General» en Vehículos). |
| `opciones` | Traduce códigos (L → En línea). |

### Campos (`DefCampo`)

| Propiedad | Uso |
|---|---|
| `tipo` | `texto`, `textoLargo`, `entero`, `decimal`, `booleano`, `opciones`, `relacion`, `fecha` (AAAA-MM-DD), `calculado` (solo lectura, no se guarda). |
| `calculo` + `formato` | Para `calculado`: `{ tipo: "resta", a, b }`, `{ tipo: "margen", precio, costo }`, `{ tipo: "conImpuesto", base, tasa, exento? }` (`lib/recursos/calculos.ts`). Se recalcula en vivo. |
| `seccion` | Título de sección antes del campo (formularios largos, como Productos). |
| `prefijo` | Texto antes del número («L»). |
| `requerido`, `min`, `max`, `maxLargo`, `patron` + `mensajePatron` | Validación (cliente **y** servidor con `validarValores`). |
| `mayusculas` | Convierte a MAYÚSCULAS. |
| `guardar: false` | Campo de contexto que no se guarda (p. ej. marca para elegir modelo). |
| `soloAlCrear` | Se completa al crear; al editar se muestra bloqueado y no se envía (p. ej. el correo de una invitación). |
| `minusculas` | Convierte a minúsculas (correos). |
| `relacion` | `{ recurso, valor, etiqueta, dependeDe?: { campo, columna }, fijo?: { columna, valor } }`: combobox con búsqueda en el servidor; `dependeDe` hace cascada (limpia y filtra al cambiar el padre); `fijo` filtra siempre (p. ej. solo categorías activas). |
| `presentacion: "tarjetas"` | Opciones como botones; si la opción trae `muestra`, dibuja la muestra de color. |
| `sufijo`, `placeholder`, `ayuda`, `ancho: "completo"`, `porDefecto` | Presentación. |

## Componentes

### `TablaMaestra` (`components/tabla-maestra/`)

- Paginación en el servidor (25/50/100/200), conteo exacto.
- Búsqueda rápida: cada palabra debe aparecer en alguna columna buscable (`toyota corolla 2005`).
- Filtros combinables (Y) por tipo: texto (contiene, igual, empieza, no es, vacío), número (=, ≠, >, ≥, <, ≤, entre, vacío), opciones (es alguno de, con buscador), booleano. Se muestran como chips.
- Orden: clic en el encabezado (asc → desc → por defecto); **Mayús+clic** agrega orden secundario.
- Columnas: mostrar/ocultar, reordenar (arrastrar o flechas), redimensionar (borde del encabezado), densidad compacta.
- **Preferencias por usuario** en `public.preferencias_tablas` (clave `tabla:<recurso>`): columnas, anchos, orden, tamaño de página y densidad. Se guardan con retardo de 700 ms. Los filtros y la búsqueda no se guardan.
- Teclado: ↑/↓ para moverse entre filas; Enter o doble clic para editar.
- Estados diseñados: carga (LED que barre), vacío, sin resultados (con «Limpiar») y error (con «Reintentar»).
- Props: `recurso`, `puedeEditar`, `onNuevo`, `onEditar(fila)`, `onAbrir(fila)` (abrir sin editar, p. ej. un documento; tiene prioridad), `version` (cambiarla recarga), `resaltar` (id a destacar), `acciones` (botones extra).

### `Formulario` (`components/formulario/`)

Formulario genérico. **No sabe de tablas**: recibe `campos` y un `onGuardar(valores) => Promise<ResultadoGuardar>`. Por eso sirve tanto para el mantenimiento como para el registro de empresa (`app/bienvenida`).

- Valida con `validarValores` antes de enviar; muestra errores por campo y uno general; enfoca el primer campo con error.
- `onGuardarYSeguir`: guarda y limpia, conservando los campos de contexto (marca/modelo) para cargar en serie.
- `onEliminar`: botón con confirmación en línea.
- `onCambio`: cada cambio (vista previa en vivo).
- Atajos: Ctrl/Cmd+Enter guarda, Esc cancela.

### `MantenimientoRecurso` (`components/mantenimiento/`)

`TablaMaestra` + **ventana hija** (`VentanaFlotante`) con el `Formulario`, conectado a las acciones genéricas. Respeta `acciones` del recurso. Tras guardar recarga la tabla, resalta la fila y limpia la caché de opciones del recurso.

- `pestanas({ clave, fila, refrescar })`: pestañas extra de la ventana de edición (la primera es «Datos»). Con pestañas, **crear deja la ventana abierta en el registro nuevo** para seguir (fotos, vehículos). Ejemplo: `modulos/inventario.tsx`.
- `onAbrir(fila)`: abrir en vez de editar (documentos emitidos).
- `version`, `acciones`: se pasan a la tabla.

### Capa de servidor

- `lib/recursos/servidor.ts`: `consultarRecurso`, `buscarOpciones`, `guardarRecurso`, `eliminarRecurso`, `leerRegistro`. Toda columna, operador y orden se valida contra la definición: el cliente no puede pedir columnas que no estén declaradas. Traduce errores de Postgres a mensajes en español.
- `app/acciones/recursos.ts`: Server Actions públicas que delegan en lo anterior. **La autorización real es RLS**; `puedeEditar` solo oculta botones.
- `app/acciones/preferencias.ts`: leer y guardar preferencias de tabla (sanitizadas).

## Ventanas y escritorio

### Tablas de datos por empresa

Para tablas operativas (productos, clientes, facturas…) usá `ambito: "empresa"` en la `DefRecurso`: la vista debe exponer `id_empresa` y el servidor filtra por la empresa activa en lecturas, opciones, ediciones y eliminaciones, y la asigna al crear. RLS sigue siendo la autoridad (`es_miembro` / `tiene_rol`).

`ambito: "compartido"` (p. ej. `marcas_productos`): se leen las filas globales (`id_empresa` null) más las de la empresa; al crear se asigna la empresa. Las globales solo las edita el admin de plataforma (RLS).

### Módulos

- `app/inicio/_components/modulos/index.tsx`: `MODULOS` (orden del dock). Cada módulo: `id`, `nombre`, `icono` (SVG propio), `componente`, `tamano`, `visible(sesion)` (p. ej. solo dueño/admin), `enDock: false` (se abre desde otro lado, como «Mi usuario» desde la barra de menú).
- `ModuloTablas` (`modulos/tablas.tsx`): barra lateral de tablas + `MantenimientoRecurso`. Mantenimiento, Usuarios, Inventario y Ventas son configuraciones de este componente. Un ítem puede traer `contenido({ editable })` para usar un mantenimiento con pestañas u `onAbrir`.
- Módulos de ficha (Taller, Mi usuario): placa metálica + `Formulario` contra una Server Action propia.

### Ventanas hijas

`<VentanaFlotante id titulo padre onCerrar foco>`: ventana independiente controlada por un componente (vive mientras se renderiza; el contenido se monta por portal en la capa de ventanas, así conserva estado y callbacks de su dueña). `padre` = `useVentanaActual()`: se minimiza, se restaura y se cierra con su madre, y siempre queda encima de ella. Minimizada sola, aparece como mosaico en el dock. `foco`: al cambiar la trae al frente.

### Gestor

- `components/ventanas/contexto.tsx`: `VentanasProvider` + `useVentanas()` (abrir, cerrar, minimizar, restaurar, maximizar, enfocar, mover, minimizarTodas).
- `components/ventanas/ventana.tsx`: ventana estilo macOS: semáforo (cerrar/minimizar/pantalla completa), arrastre por la barra, redimensión por los bordes (e, w, s, se, sw), doble clic para pantalla completa, minimizar con animación hacia el ícono del dock (el estado se aplica con `flushSync` antes de soltar la animación: sin parpadeo), restaurar desde el dock. **Pantalla completa** (escritorio): la ventana ocupa toda la pantalla por encima de barra y dock y se pide la API de pantalla completa del navegador; Esc o el botón verde la restauran. En móvil «maximizar» respeta barra y dock. Recuerda posición y tamaño por módulo en `localStorage` (`wp:ventanas`). En pantallas de menos de 768 px abre maximizada.
- El contenido de la ventana es un contenedor (`container-type: inline-size`): los módulos se adaptan con `@container`, no con media queries.

## Módulos interactivos (no genéricos)

Donde la tabla maestra no alcanza (mostrador, fotos, compatibilidad) hay componentes propios. Todos leen datos con `useApi(...)` (`components/datos/apis.tsx`): por defecto Server Actions; el sandbox inyecta datos en memoria con `<ApisProvider valor={APIS_DEMO}>`.

| Componente | Qué hace |
|---|---|
| `components/ventas/mostrador.tsx` · `Mostrador` | «Cotizar y facturar»: carritos en pestañas (persisten en la base), placa del vehículo, búsqueda instantánea agrupada (le queda · puede quedarle · generales · complementos) y ticket. Atajos mientras su ventana está enfocada: **F2** o **/** buscar, **F4** vehículo, **↑↓ Enter** agregar, **F9** facturar. `abrirCarritoEnMostrador(id)` lo abre desde otro módulo. |
| `components/ventas/selector-vehiculo.tsx` | Placa: «corolla 05» o Marca › Modelo › Año › Motor; migas para quitar niveles; Backspace sube un nivel. `resolverVehiculo()` completa nombres desde ids. |
| `components/ventas/ticket.tsx` | Cliente (buscar, usar sin guardar, guardar con RTN), líneas (cantidad, precio y descuento por línea), línea libre, descuento general en % o L, totales y confirmación de emisión. |
| `components/ventas/odometro.tsx` | Total en visor LCD con dígitos que ruedan. |
| `components/ventas/documento-vista.tsx` | Hoja de cotización/factura (pantalla e impresión, papel `--wp-papel-*`). |
| `components/compatibilidad/editor-compatibilidad.tsx` | Columnas Marca › Modelo › Año › Motor con LED (asignado · parcial · incluido por un nivel superior). Marcar un nivel cubre lo de abajo; **Mayús+clic** marca rangos; en Años se filtra `2003-2008` y «Marcar los N»; salto «corolla 05»; «Copiar de otro producto». Guardado optimista. |
| `components/imagenes/galeria-producto.tsx` | Fotos: arrastrar y soltar, se comprimen en el navegador a WebP (1600 px + miniatura 400 px, `procesar.ts`), la primera es la principal, reordenar, ampliar. |

Cálculos de venta compartidos (cliente, servidor, impresión): `lib/ventas.ts` (`calcularTotales` usa el mismo redondeo que `emitir_documento()`). Formatos: `lib/formato.ts` (`moneda`, `enLetras`…).

## Controles base

`components/ui/controles.module.css`: `boton` (+ `primario`, `fantasma`, `peligro`, `icono`), `campo` (inputs/select/textarea hundidos), `casilla` (checkbox con LED), `popover`, `contador`, `etiquetaSeccion`. Íconos propios en `components/ui/iconos.tsx`. No usar librerías de íconos.

## Sandbox de desarrollo

Como un agente no puede iniciar sesión con Google, existen rutas **solo en desarrollo** (404 en producción) con una sesión ficticia:

- `/dev/escritorio`: escritorio completo; lee el catálogo como `anon`; las escrituras fallan por RLS (sirve para probar errores).
- `/dev/bienvenida`: formulario de registro de empresa.
- El escritorio del sandbox usa `app/dev/datos-demo.ts`: 16 productos, clientes, carritos y documentos **en memoria** para el mostrador, las fotos y la compatibilidad (el catálogo de vehículos es el real). `/dev/documento?id=…` imprime el documento demo; `/dev/piezas` muestra sueltos el editor de compatibilidad y la galería.
- Las animaciones con WAAPI (abrir/minimizar ventanas) tampoco avanzan con el panel oculto: `document.getAnimations().forEach(a => a.finish())` antes de capturar.

Si el panel del navegador no está visible, las animaciones no avanzan: para capturas, inyectá temporalmente `*{animation:none!important;transition:none!important}`.
