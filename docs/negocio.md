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

### 3.4 Catálogo web (Implementado · 0013)

- **Dirección**: `/t/<slug>` (decidido con el usuario; subdominio o dominio propio quedan para después, sobre esta misma base). El dueño/admin la elige en el módulo **Sitio web** y publica cuando quiere; sin publicar solo lo ven sus miembros.
- **Páginas**: portada (fondo y logo de la empresa, título y bajada propios, buscador por vehículo, destacados, categorías, historia, contacto), catálogo (por vehículo — marca → modelo → año → motor —, texto/número de parte y categoría), ficha de producto (fotos, datos, vehículos), «Nosotros» (historia, año de apertura, fotos, puntos fuertes) y «Tu lista».
- Muestra solo productos **«En catálogo» (visible_catalogo), activos y con existencia**; nunca costo, existencia ni ubicación.
- **Precios**: cada taller decide si se muestran (con ISV 15 %, salvo exentos). Ocultarlos lo hace la base: el público nunca los recibe.
- **Pedidos**: el visitante arma una lista y la manda con nombre y teléfono (decidido con el usuario: «carrito → cotización», **sin pagos en línea**). Llega a **Ventas › Pedidos web**; el vendedor la atiende y se vuelve un carrito del mostrador con el precio de hoy, de ahí cotización o factura como siempre. Además, WhatsApp para preguntar.
- Usa la identidad de la empresa (paleta, color de marca, logo, fondo).

### 3.5 Facturación con CAI (Implementado · algunos puntos a verificar)

> Hecho en 0005 con estas **decisiones a confirmar con el usuario o su contador**: precios capturados **sin ISV** (el ISV 15 % se suma en la factura; se ve el precio con ISV en todo el mostrador); cotizaciones sin valor fiscal con numeración interna `COT-000001` y vigencia de 15 días; leyendas impresas «La factura es beneficio de todos. Exíjala.» y «Original: cliente · Copia: emisor»; no hay aviso anticipado de rango/fecha por agotarse (solo se ve en Ventas › CAI).
>
> **Confirmado por el usuario (2026-10-02)**: el SAR **no** exige registrar ni autorizar el sistema que emite; basta el CAI de cada empresa.
>
> Hecho en **0016** (pedido del usuario): notas de crédito y débito, devoluciones, exoneraciones y varios puntos de emisión. Detalle en §3.7.


> Resumen de lo que se entiende del Régimen de Facturación del SAR. **Confirmar con el usuario o su contador antes de implementar**; la normativa cambia.

**Configuración por empresa**
- Establecimientos (código de 3 dígitos) y puntos de emisión (3 dígitos).
- Registros de CAI: código CAI, tipo de documento, establecimiento, punto de emisión, **rango autorizado** (número inicial y final), **fecha límite de emisión**, fecha de recepción.
- Pueden coexistir varios CAI (uno por tipo de documento o punto de emisión); cuando uno se agota o vence, se registra otro.

**Numeración del documento**: `EEE-PPP-TT-NNNNNNNN`
- `EEE` establecimiento, `PPP` punto de emisión, `TT` tipo de documento (`01` factura, `06` nota de crédito, `07` nota de débito, según el Reglamento del Régimen de Facturación, Acuerdo 481-2017), `NNNNNNNN` correlativo de 8 dígitos.
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

### 3.7 Notas, devoluciones, exoneraciones y puntos de emisión (Implementado · 0016)

**Puntos de emisión**
- Cada empresa registra sus **establecimientos** (sucursal, código de 3 dígitos, dirección propia) y **puntos de emisión** (cajas, 3 dígitos). Uno es el **predeterminado**.
- Cada CAI pertenece a un punto y a un tipo de documento. Pueden coexistir varios CAI por punto (uno por tipo).
- Cada persona tiene un punto asignado (Usuarios); sin asignar usa el predeterminado. Toda factura o nota toma el siguiente número del CAI vigente **de su punto y su tipo**.
- La dirección de la sucursal se imprime si es distinta a la del taller, y el nombre de la caja en el pie.

**Notas de crédito (06) y débito (07)**
- Siempre sobre una **factura emitida** (no sobre cotizaciones ni otras notas). Solo dueño/admin.
- Copian el cliente de la factura e imprimen: factura que modifican, su fecha, su CAI (si es otro) y el **motivo** (tipo + detalle obligatorio).
- Crédito: **devolución** (unidades de las líneas de la factura; opcionalmente vuelven al inventario, kardex «devolución»), **rebaja**, **corrección** u otro (montos sin ISV). Débito: gastos/flete, intereses, corrección u otro.
- Límites: no se devuelven más unidades de las vendidas (menos lo ya devuelto) y una nota de crédito no supera el **saldo** de la factura (total + débitos − créditos vigentes). Al devolver todo una línea, se acredita exactamente lo que le queda (sin diferencias de centavos); hay una tolerancia de 2 centavos en el ISV por redondeo.
- El ISV de la nota sigue a la factura: 15 % sobre lo gravado; si la factura fue exonerada, lo gravado va como exonerado.
- Se anulan como cualquier documento (dueño/admin, con motivo). Anular una devolución reintegrada vuelve a sacar las piezas. **Una factura con notas vigentes no se anula**: primero se anulan sus notas.

**Exoneración**
- El cliente puede marcarse **exonerado** con su constancia de registro de exonerado y registro SAG; al elegirlo en el mostrador el carrito queda exonerado. También se puede activar a mano en el ticket (cualquier rol).
- Factura exonerada: lo gravado pasa a **importe exonerado** y no lleva ISV. Exige **RTN del cliente** y la **orden de compra exenta o la constancia** (**a verificar** con el contador cuál es obligatorio en cada caso). Se imprimen los tres datos (orden de compra exenta, constancia, registro SAG).
- La orden de compra exenta es de cada compra: no se guarda en el cliente ni se copia al repetir una factura.

**Pendiente**: el reporte de ventas todavía cuenta solo facturas (no resta notas de crédito); se ajustará con el módulo de Caja.

### 3.8 Ventas al crédito y cuentas por cobrar (Implementado · 0017)

- **Crédito por cliente**: lo habilitan dueño/admin en Ventas › Clientes, con **límite** (vacío = sin límite) y **plazo** en días (30 por defecto).
- **Venta al crédito**: en el ticket, con un cliente registrado con crédito, aparece «Contado | Crédito» con su disponible y lo vencido. La factura lleva `condicion = credito` y **vence** el día de hoy + plazo; se imprime «Condición: Crédito · vence dd/mm/aaaa».
- **Reglas** (decisión de diseño, ajustable): un vendedor **no** puede facturar al crédito a un cliente con facturas **vencidas** ni pasarse del **límite**; dueño/admin sí (es su riesgo). Cotizaciones sin efecto.
- **Pendiente** de cada factura = total + notas de débito − notas de crédito − abonos vigentes. Negativo = **saldo a favor** (p. ej. devolución de algo ya pagado).
- **Abonos**: cualquier miembro registra un abono desde el estado de cuenta (efectivo, transferencia, depósito, tarjeta, cheque u otro, con referencia). Se reparte a las facturas **más antiguas primero** o a las marcadas; lo que se ve es lo que se guarda. No se acepta más de lo pendiente. Genera un **recibo** `REC-000001` (sin valor fiscal) imprimible.
- **Anular**: un recibo lo anula dueño/admin (la deuda vuelve). Una factura con abonos vigentes no se anula hasta anular sus recibos.
- **Estados**: al día · por vencer (≤ 7 días) · vencida · pagada. Antigüedad de saldos: al día, 1–30, 31–60, 61–90, +90 días.
- Las facturas de **contado** se consideran cobradas al emitirse; el dinero real se cuadra en el módulo de **Caja** (siguiente).

## 4. Reglas transversales

- Montos en `numeric(14,2)` en la base; nunca `float`. Moneda: lempiras (HNL).
- Fechas en `timestamptz`; la zona de negocio es `America/Tegucigalpa`.
- Todo documento fiscal y movimiento de inventario guarda quién lo hizo (`id_usuario`) y cuándo.
- Borrado lógico (`activo` / `anulado`) en entidades con historia; nunca borrado físico de documentos fiscales.
