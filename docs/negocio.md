# Lógica de negocio · Wake Parts

> Estado de cada sección: **Implementado**, **Propuesto** (acordado como dirección, sin código) o **A verificar** (necesita confirmación del usuario o de un contador antes de implementarse).

## 1. Clientes objetivo

- **Tienda de repuestos**: vende piezas nuevas (originales o genéricas). Maneja **stock por cantidad**: 12 filtros de aceite iguales.
- **Yonker / deshuesadero**: desarma vehículos y vende piezas usadas. Cada pieza suele ser **única**: sale de un vehículo donante concreto, tiene condición propia y precio propio.
- Escala pequeña/mediana: 1–3 sucursales, pocos usuarios, a menudo el dueño es quien factura. La UI debe ser rápida para mostrador.

Muchos negocios hacen ambas cosas; el modelo de datos debe soportar las dos formas de inventario.

## 2. Glosario

| Término | Significado |
|---|---|
| **Yonker** | Deshuesadero de vehículos (del inglés *junkyard*). |
| **SAR** | Servicio de Administración de Rentas, la autoridad tributaria de Honduras. |
| **CAI** | Código de Autorización de Impresión. Lo emite el SAR y autoriza un **rango de numeración** de documentos fiscales hasta una **fecha límite**. |
| **RTN** | Registro Tributario Nacional (14 dígitos). Identifica al contribuyente. |
| **ISV** | Impuesto Sobre Ventas. 15 % general. |
| **Consumidor final** | Comprador sin RTN en la factura. |
| **Especificación** | En este sistema: una variante concreta de vehículo (modelo + año + carrocería + motor). |
| **Donante** | Vehículo del que un yonker extrae piezas. |

## 3. Módulos

### 3.1 Empresa y usuarios (Implementado)

- Un usuario entra con Google. La primera vez **crea una empresa** o acepta una invitación.
- Una empresa tiene: nombre comercial, razón social, RTN, dirección, teléfono, correo, logo y **paleta** visual.
- Un usuario puede pertenecer a varias empresas (membresía con rol). Roles iniciales sugeridos: `dueno`, `admin`, `vendedor`.
- La paleta de la empresa activa define el tema de toda la app (la cookie es solo caché para evitar parpadeo).
- Empleados: se invitan por correo de Google con un rol (módulo Usuarios); al entrar quedan dentro. Se desactivan, no se borran. Reglas: nadie se cambia a sí mismo, solo un dueño toca dueños, siempre queda un dueño activo.

### 3.2 Catálogo de vehículos (Implementado, global)

`marcas → modelos → modelos_anios → especificaciones ← tipos_carrocerias`. Compartido por todas las empresas, lectura pública. Detalle en [`database.md`](database.md).

### 3.3 Inventario (Implementado: modo por cantidad)

> Hecho en 0004: productos con categoría (árbol global con sinónimos), marca de repuesto, OEM/parte/equivalencias, condición (nuevo/usado/reconstruido), costo y precio sin ISV con utilidad y margen, existencia con mínimo y kardex automático, fotos, compatibilidad por marca/modelo/año/motor y búsqueda. Pendiente: sucursales, compras/entradas, y el modo «pieza única» de yonker (vehículo donante, estado reservada/vendida).


- **Producto**: lo que se vende (nombre, categoría, código/SKU, número de parte OEM, marca de la pieza, precio, costo, gravado/exento).
- **Compatibilidad**: relación N:M producto ↔ `especificaciones`. Una pieza sirve para varios vehículos. Se debe poder asignar en bloque (p. ej. «todos los Corolla 2003–2008 1.8»).
- **Dos modos de existencia**:
  - *Por cantidad* (tienda): existencias por sucursal, entradas y salidas como movimientos.
  - *Pieza única* (yonker): cada unidad con condición (grado A/B/C o texto), fotos, vehículo donante (VIN opcional) y estado (`disponible`, `reservada`, `vendida`).
- Fotos en Supabase Storage.

### 3.4 Catálogo web (Propuesto)

- Página pública por empresa (subruta o subdominio, a definir) con búsqueda **por vehículo** (marca → modelo → año → motor) y por texto/número de parte.
- Muestra solo productos marcados como publicados y con existencia.
- Usa la paleta de la empresa.
- Contacto directo (WhatsApp es el canal esperado en Honduras). **A verificar** con el usuario si habrá carrito o pagos en línea.

### 3.5 Facturación con CAI (Implementado lo básico · a verificar la normativa)

> Hecho en 0005 con estas **decisiones a confirmar con el usuario o su contador**: precios capturados **sin ISV** (el ISV 15 % se suma en la factura; se ve el precio con ISV en todo el mostrador); tipo de documento `01` para facturas; cotizaciones sin valor fiscal con numeración interna `COT-000001` y vigencia de 15 días; leyendas impresas «La factura es beneficio de todos. Exíjala.» y «Original: cliente · Copia: emisor»; «Importe exonerado» siempre 0 (sin flujo de exoneración todavía); no hay aviso anticipado de rango/fecha por agotarse (solo se ve en Ventas › CAI). Pendiente: notas de crédito/débito, exoneraciones, varios puntos de emisión por usuario.


> Resumen de lo que se entiende del Régimen de Facturación del SAR. **Confirmar con el usuario o su contador antes de implementar**; la normativa cambia.

**Configuración por empresa**
- Establecimientos (código de 3 dígitos) y puntos de emisión (3 dígitos).
- Registros de CAI: código CAI, tipo de documento, establecimiento, punto de emisión, **rango autorizado** (número inicial y final), **fecha límite de emisión**, fecha de recepción.
- Pueden coexistir varios CAI (uno por tipo de documento o punto de emisión); cuando uno se agota o vence, se registra otro.

**Numeración del documento**: `EEE-PPP-TT-NNNNNNNN`
- `EEE` establecimiento, `PPP` punto de emisión, `TT` tipo de documento (`01` = factura; otros tipos, como notas de crédito/débito: **a verificar** su código), `NNNNNNNN` correlativo de 8 dígitos.
- El correlativo es **estrictamente secuencial y sin huecos** dentro del rango del CAI. Se asigna en la base, dentro de una transacción con bloqueo, nunca en el cliente.
- No se puede emitir si el siguiente número excede el rango o si la fecha actual pasó la fecha límite. Avisar al usuario con anticipación (p. ej. 80 % del rango usado o 30 días antes de vencer).
- Un documento emitido **no se borra**: se anula conservando su número.

**Contenido mínimo de la factura** (a verificar la lista exacta)
- Emisor: razón social, nombre comercial, RTN, dirección, teléfono, correo.
- CAI, rango autorizado (desde–hasta) y fecha límite de emisión.
- Número de documento y fecha de emisión.
- Comprador: nombre y RTN (o «Consumidor final»).
- Detalle: cantidad, descripción, precio unitario, descuento, total por línea.
- Totales desglosados: importe exento, importe exonerado, importe gravado 15 %, (gravado 18 % si aplica), ISV 15 %, (ISV 18 %), descuentos, **total**, y total en letras.
- Datos de exoneración cuando aplica (número de orden de compra exenta, constancia de registro de exonerado, etc.).
- Leyendas de original/copia y la leyenda oficial del SAR.

**Impuestos**
- Repuestos: ISV 15 % en general. Cada producto indica si es gravado o exento.
- Precios: se decidió capturarlos **sin ISV** (utilidad real = precio − costo, ambos sin impuesto; el ISV de compras es crédito fiscal). **Confirmar** con el usuario.

### 3.6 Cotizar y facturar (Implementado)

- El mostrador trabaja con **carritos** abiertos (uno por cliente que se atiende), guardados en la base: sobreviven a recargar la página y se ven desde otra computadora.
- Primero el **vehículo** del cliente; la búsqueda separa lo que **le queda** (por motor, año, modelo o marca), lo que **puede quedarle** (hay que confirmar año o motor), los **productos generales** (sin vehículos asignados: aceites, químicos, herramientas) y **complementos** de categorías relacionadas.
- Descuentos por línea y general (en % o en lempiras); los vendedores tienen tope (Taller › Reglas de venta).
- Se emite **cotización** o **factura** a nombre de un cliente (con RTN) o de consumidor final. La factura descuenta existencias; anularla las devuelve.
- Una cotización se pasa a carrito para facturarla después (Ventas › Documentos).
- El mismo `buscar_productos()` sirve para el catálogo web: el público solo ve productos visibles con existencia y sin costo.

## 4. Reglas transversales

- Montos en `numeric(14,2)` en la base; nunca `float`. Moneda: lempiras (HNL).
- Fechas en `timestamptz`; la zona de negocio es `America/Tegucigalpa`.
- Todo documento fiscal y movimiento de inventario guarda quién lo hizo (`id_usuario`) y cuándo.
- Borrado lógico (`activo` / `anulado`) en entidades con historia; nunca borrado físico de documentos fiscales.
