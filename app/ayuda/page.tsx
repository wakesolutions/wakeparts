import type { Metadata } from "next";
import Link from "next/link";
import {
  IconoActividad,
  IconoEquipo,
  IconoInicio,
  IconoInventario,
  IconoLlave,
  IconoMostrador,
  IconoTaller,
  IconoVentas,
} from "@/app/inicio/_components/modulos/iconos-modulos";
import { Capitulo, IconoDock, Led, Marco, Nota, Tecla } from "./_componentes/piezas";
import { Indice, type EntradaIndice } from "./_componentes/indice";
import { OdometroDemo } from "./_componentes/odometro-demo";
import styles from "./ayuda.module.css";
import { JsonLd } from "../_publico/piezas";
import { NOMBRE_SITIO, URL_SITIO } from "@/lib/sitio";

export const metadata: Metadata = {
  title: "Manual del propietario",
  alternates: { canonical: "/ayuda" },
  openGraph: { url: "/ayuda", title: "Manual del propietario · Wake Parts" },
  description: "Cómo usar Wake Parts: mostrador, inventario, compatibilidad con vehículos, facturación con CAI, usuarios y roles.",
};

const CAPITULOS: EntradaIndice[] = [
  { id: "arranque", numero: "01", titulo: "Arranque" },
  { id: "tablero", numero: "02", titulo: "El tablero" },
  { id: "mostrador", numero: "03", titulo: "Cotizar y facturar" },
  { id: "inventario", numero: "04", titulo: "Inventario" },
  { id: "tablas", numero: "05", titulo: "Tablas y formularios" },
  { id: "ventas", numero: "06", titulo: "Ventas y CAI" },
  { id: "taller", numero: "07", titulo: "Taller y Mi usuario" },
  { id: "equipo", numero: "08", titulo: "Usuarios y roles" },
  { id: "mantenimiento", numero: "09", titulo: "Mantenimiento" },
  { id: "glosario", numero: "10", titulo: "Glosario" },
];

const PERMISOS: [string, boolean, boolean, boolean][] = [
  ["Cotizar, facturar y crear clientes", true, true, true],
  ["Descuentos sin tope", true, true, false],
  ["Crear y editar productos, fotos y vehículos", true, true, false],
  ["Cargar inventario e importar desde Excel", true, true, false],
  ["Crear marcas y categorías propias", true, true, false],
  ["Ver utilidad y margen en el reporte", true, true, false],
  ["Anular facturas", true, true, false],
  ["Registrar CAI", true, true, false],
  ["Editar el taller, su apariencia y el formato de factura", true, true, false],
  ["Invitar y administrar usuarios", true, true, false],
  ["Ver la actividad: quién entró y qué cambió", true, true, false],
  ["Cambiar el rol de un dueño", true, false, false],
];

export default function Manual() {
  return (
    <div className={`wp-carbono ${styles.pagina}`}>
      <JsonLd
        datos={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "TechArticle",
              headline: "Manual del propietario de Wake Parts",
              description: "Cómo usar Wake Parts: mostrador, inventario, compatibilidad con vehículos, facturación con CAI, usuarios y roles.",
              inLanguage: "es-HN",
              url: `${URL_SITIO}/ayuda`,
              publisher: { "@type": "Organization", name: NOMBRE_SITIO, url: URL_SITIO },
              hasPart: CAPITULOS.map((c) => ({ "@type": "WebPageElement", name: c.titulo, url: `${URL_SITIO}/ayuda#${c.id}` })),
            },
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: NOMBRE_SITIO, item: `${URL_SITIO}/` },
                { "@type": "ListItem", position: 2, name: "Manual del propietario", item: `${URL_SITIO}/ayuda` },
              ],
            },
          ],
        }}
      />
      <header className={`wp-metal ${styles.barra}`}>
        <Link href="/inicio" className={styles.marca}>
          Wake<span className="text-wp-accent">Parts</span>
        </Link>
        <span className={styles.barraTitulo}>Manual del propietario</span>
        <Link href="/inicio" className={styles.volver}>
          Ir al tablero
        </Link>
      </header>

      <div className={styles.hero}>
        <p className={`wp-entra ${styles.sobretitulo}`} style={{ animationDelay: "80ms" }}>
          Edición 2026 · Leé antes de empezar
        </p>
        <h1 className={`wp-grabado ${styles.heroTitulo}`}>
          <span className="wp-linea">
            <span style={{ animationDelay: "160ms" }}>Manual</span>
          </span>
          <span className="wp-linea">
            <span style={{ animationDelay: "260ms" }}>
              del propietario<span className="text-wp-accent">.</span>
            </span>
          </span>
        </h1>
        <p className={`wp-entra ${styles.heroTexto}`} style={{ animationDelay: "440ms" }}>
          Todo lo que hace Wake Parts, capítulo por capítulo: del primer arranque a la factura con CAI. Si trabajás
          en mostrador, empezá por el capítulo 03.
        </p>
      </div>

      <div className={styles.cuerpo}>
        <Indice capitulos={CAPITULOS} />

        <main className={styles.contenido}>
          {/* 01 ------------------------------------------------------------ */}
          <Capitulo
            id="arranque"
            numero="01"
            titulo="Arranque"
            bajada="Entrar, registrar tu taller y tener algo con qué probar."
          >
            <ol className={styles.pasos}>
              <li>
                <strong>Entrá con un toque.</strong> No hay contraseñas que recordar: tocá <em>Entrar</em> en la
                portada.
              </li>
              <li>
                <strong>Registrá tu taller.</strong> La primera vez te pide nombre comercial y, si querés, razón social,
                RTN, teléfono, correo, dirección y paleta de colores. Quedás como <em>dueño</em>. Si marcás{" "}
                <em>Cargar productos de ejemplo</em>, arrancás con datos para practicar.
              </li>
              <li>
                <strong>¿Te invitaron?</strong> Si un dueño o administrador invitó tu correo, al entrar quedás dentro de
                su taller con el rol que te dio, sin registrar nada.
              </li>
              <li>
                <strong>Seguí el recorrido.</strong> La primera vez que entrás, un recorrido guiado te lleva por el
                mostrador y el dock. Se repite cuando querás desde <em>Mi usuario</em>.
              </li>
              <li>
                <strong>Cargá datos de ejemplo.</strong> En <em>Taller › Datos de ejemplo</em> hay un botón que agrega
                45 productos (repuestos, lubricantes y mano de obra) con vehículos asignados y 3 clientes. No borra
                nada tuyo y se puede apretar dos veces sin duplicar.
              </li>
            </ol>
            <Nota titulo="Varios talleres, una cuenta">
              Un mismo correo puede pertenecer a varios talleres, con un rol distinto en cada uno. Todo lo que ves
              (productos, clientes, facturas) es solo del taller activo.
            </Nota>
          </Capitulo>

          {/* 02 ------------------------------------------------------------ */}
          <Capitulo
            id="tablero"
            numero="02"
            titulo="El tablero"
            bajada="Un escritorio con barra de menú arriba, dock abajo y cada módulo en su ventana."
          >
            <ul className={styles.dock} aria-label="Módulos del dock">
              <IconoDock icono={<IconoInicio />} nombre="Inicio" />
              <IconoDock icono={<IconoMostrador />} nombre="Cotizar" />
              <IconoDock icono={<IconoInventario />} nombre="Inventario" />
              <IconoDock icono={<IconoVentas />} nombre="Ventas" />
              <IconoDock icono={<IconoLlave />} nombre="Mantenim." />
              <IconoDock icono={<IconoEquipo />} nombre="Usuarios" />
              <IconoDock icono={<IconoActividad />} nombre="Actividad" />
              <IconoDock icono={<IconoTaller />} nombre="Taller" />
            </ul>
            <div className={styles.dosColumnas}>
              <div>
                <h3 className={styles.subtitulo}>Barra de menú</h3>
                <p>
                  Muestra el módulo activo y tu taller (con su logo, si subiste uno). A la derecha: las perillas de <strong>paleta</strong> (solo
                  dueño y administrador; cambian los colores de todo el taller), el reloj, tu nombre (abre{" "}
                  <em>Mi usuario</em>), el enlace a este manual y <strong>Salir</strong> para cerrar sesión.
                </p>
                <h3 className={styles.subtitulo}>Dock</h3>
                <p>
                  Un ícono por módulo. El LED debajo indica que está abierto. Las ventanas minimizadas aparecen como
                  mosaicos a la derecha del dock; un clic las devuelve. <em>Inicio</em> minimiza todo y te deja ver el
                  escritorio.
                </p>
              </div>
              <div>
                <h3 className={styles.subtitulo}>Ventanas</h3>
                <p>
                  Cada módulo abre <strong>maximizado</strong>: ocupa todo y tapa barra y dock para darte el máximo
                  espacio. Solo queda el semáforo:
                </p>
                <ul className={styles.lista}>
                  <li>
                    <Led tono="acento" /> <strong>Rojo</strong> cierra la ventana.
                  </li>
                  <li>
                    <Led tono="aviso" /> <strong>Ámbar</strong> la minimiza al dock (y te devuelve al escritorio).
                  </li>
                  <li>
                    <Led /> <strong>Verde</strong> (o doble clic en el título) la vuelve flotante: se arrastra por el
                    título y se agranda por los bordes. Otro clic la maximiza de nuevo.
                  </li>
                </ul>
                <p>
                  Los formularios y detalles abren en <strong>ventanas hijas</strong> encima de su módulo; se minimizan
                  y vuelven junto con él.
                </p>
              </div>
            </div>
            <Nota titulo="En el celular">
              Las ventanas ocupan la pantalla pero dejan la barra y el dock a la vista, porque ahí el dock es la
              navegación.
            </Nota>
          </Capitulo>

          {/* 03 ------------------------------------------------------------ */}
          <Capitulo
            id="mostrador"
            numero="03"
            titulo="Cotizar y facturar"
            bajada="El mostrador: vehículo, búsqueda, carrito y documento. Pensado para teclado."
          >
            <div className={styles.dosColumnas}>
              <div>
                <h3 className={styles.subtitulo}>1 · El vehículo</h3>
                <p>
                  La placa de arriba pregunta <em>¿Qué vehículo?</em> Escribí como habla el cliente:{" "}
                  <code className={styles.codigo}>corolla 05</code>, <code className={styles.codigo}>hilux</code>. Elegí
                  marca, modelo, año y, si lo sabés, el motor. <Tecla>Retroceso</Tecla> con el campo vacío sube un
                  nivel. Sin vehículo se busca en todo el inventario.
                </p>
                <h3 className={styles.subtitulo}>2 · La búsqueda</h3>
                <p>
                  Busca por nombre, categoría, marca, código, OEM, número de parte y equivalencias, con o sin guiones.
                  Entiende cómo se dice en mostrador (<em>candelas</em>, <em>fricciones</em>, <em>balatas</em>) y
                  perdona errores: <em>pastiyas</em> encuentra pastillas.
                </p>
              </div>
              <Marco titulo="Resultados para Hilux 2010">
                <ul className={styles.grupos}>
                  <li>
                    <span className={styles.etiqueta} data-tono="ok">
                      Motor
                    </span>
                    <span>
                      <strong>Le queda</strong> a ese motor exacto.
                    </span>
                  </li>
                  <li>
                    <span className={styles.etiqueta} data-tono="ok">
                      Este año
                    </span>
                    <span>
                      <strong>Le queda</strong> por año, modelo o marca.
                    </span>
                  </li>
                  <li>
                    <span className={styles.etiqueta} data-tono="aviso">
                      Verificar
                    </span>
                    <span>Le queda a alguna versión: confirmá año o motor.</span>
                  </li>
                  <li>
                    <span className={styles.etiqueta}>General</span>
                    <span>Sin vehículo asignado: aceites, químicos, servicios.</span>
                  </li>
                  <li>
                    <span className={styles.etiqueta} data-tono="acento">
                      Complemento
                    </span>
                    <span>De categorías relacionadas: buscás aceite y te sugiere filtros.</span>
                  </li>
                </ul>
              </Marco>
            </div>

            <div className={styles.dosColumnas}>
              <div>
                <h3 className={styles.subtitulo}>3 · El carrito</h3>
                <ul className={styles.lista}>
                  <li>
                    Podés tener <strong>varios carritos abiertos</strong> (uno por cliente que atendés), en pestañas.
                    Se guardan en la base: sobreviven a recargar y se ven desde otra computadora.
                  </li>
                  <li>Cambiá cantidades, precio o descuento por línea; o un descuento general en % o en lempiras.</li>
                  <li>
                    <strong>Línea libre</strong> para mano de obra o una pieza que no está registrada.
                  </li>
                  <li>
                    El <strong>vendedor</strong> tiene tope de descuento (10 % por defecto; se cambia en Taller).
                  </li>
                  <li>
                    La existencia se ve con un LED: <Led /> hay, <Led tono="aviso" /> poca,{" "}
                    <Led tono="acento" /> agotado.
                  </li>
                </ul>
              </div>
              <Marco titulo="Carrito 1">
                <OdometroDemo />
              </Marco>
            </div>

            <h3 className={styles.subtitulo}>4 · El documento</h3>
            <p>
              Elegí el cliente (o dejá <em>Consumidor final</em>), y emití una <strong>cotización</strong> o una{" "}
              <strong>factura</strong>. La factura toma el número del CAI activo y descuenta existencias; al emitir se
              abre un carrito nuevo. El documento se imprime o se guarda como PDF desde su vista.
            </p>

            <table className={styles.tabla}>
              <caption>Atajos del mostrador</caption>
              <tbody>
                <tr>
                  <th scope="row">
                    <Tecla>F2</Tecla> o <Tecla>/</Tecla>
                  </th>
                  <td>Ir a la búsqueda</td>
                </tr>
                <tr>
                  <th scope="row">
                    <Tecla>F4</Tecla>
                  </th>
                  <td>Cambiar el vehículo</td>
                </tr>
                <tr>
                  <th scope="row">
                    <Tecla>↑</Tecla> <Tecla>↓</Tecla>
                  </th>
                  <td>Moverse entre resultados</td>
                </tr>
                <tr>
                  <th scope="row">
                    <Tecla>Enter</Tecla>
                  </th>
                  <td>Agregar el resultado marcado al carrito</td>
                </tr>
                <tr>
                  <th scope="row">
                    <Tecla>Esc</Tecla>
                  </th>
                  <td>Limpiar la búsqueda</td>
                </tr>
                <tr>
                  <th scope="row">
                    <Tecla>F9</Tecla>
                  </th>
                  <td>Facturar el carrito</td>
                </tr>
              </tbody>
            </table>
            <Nota tono="aviso" titulo="Para facturar necesitás un CAI">
              Sin un CAI vigente registrado en <em>Ventas › CAI</em> solo podés cotizar. Ver capítulo 06.
            </Nota>
          </Capitulo>

          {/* 04 ------------------------------------------------------------ */}
          <Capitulo
            id="inventario"
            numero="04"
            titulo="Inventario"
            bajada="Productos con fotos, vehículos que les quedan y el historial de cada unidad."
          >
            <div className={styles.dosColumnas}>
              <div>
                <h3 className={styles.subtitulo}>Productos</h3>
                <p>
                  Cada producto lleva código (si lo dejás vacío se genera), nombre, categoría, marca del repuesto,
                  OEM, número de parte, código de barras, equivalencias, condición (nuevo, usado, reconstruido),
                  origen, unidad, ubicación en bodega y garantía.
                </p>
                <p>
                  <strong>Costo y precio van sin ISV</strong>; la utilidad y el margen se calculan solos. La existencia
                  mínima enciende la alerta <Led tono="aviso" /> cuando queda poco. La mano de obra no lleva
                  inventario.
                </p>
                <h3 className={styles.subtitulo}>Fotos</h3>
                <p>
                  Soltá fotos en la pestaña <em>Fotos</em> (hasta 12). Se comprimen solas en tu navegador antes de
                  subir; la primera es la principal y se reordenan con las flechas.
                </p>
              </div>
              <div>
                <h3 className={styles.subtitulo}>Vehículos</h3>
                <p>En la pestaña Vehículos elegís a qué le queda el producto, en el nivel que sepás:</p>
                <ol className={styles.niveles}>
                  <li>
                    <span>Marca</span>
                    <small>Toda Toyota</small>
                  </li>
                  <li>
                    <span>Modelo</span>
                    <small>Todo Corolla</small>
                  </li>
                  <li>
                    <span>Año</span>
                    <small>Corolla 2003–2008</small>
                  </li>
                  <li>
                    <span>Motor</span>
                    <small>Hilux 2KD-FTV</small>
                  </li>
                </ol>
                <ul className={styles.lista}>
                  <li>
                    Columnas marca → modelo → año → motor. <Tecla>Mayús</Tecla> + clic marca un rango de años.
                  </li>
                  <li>
                    LEDs: <Led /> asignado, <Led estado="medio" /> asignado en parte, <Led estado="no" /> incluido por
                    un nivel de arriba.
                  </li>
                  <li>Filtro por rango de años y opción de copiar los vehículos de otro producto.</li>
                  <li>Un producto sin vehículos es general: aparece para cualquier vehículo.</li>
                </ul>
              </div>
            </div>
            <div className={styles.dosColumnas}>
              <div>
                <h3 className={styles.subtitulo}>Kardex</h3>
                <p>
                  Cada cambio de existencia queda registrado solo: la inicial, los ajustes a mano, las compras, las
                  ventas y las anulaciones, con quién lo hizo y por qué documento.
                </p>
                <h3 className={styles.subtitulo}>Entrada de inventario</h3>
                <p>
                  En <em>Productos</em>, el botón <strong>Entrada</strong> suma existencias de una compra o un conteo.
                  Buscá o escaneá el producto: <Tecla>Enter</Tecla> lo agrega y te lleva a la cantidad. Anotá el costo
                  de la compra y la referencia (factura del proveedor). El costo del producto puede quedar como{" "}
                  <strong>promedio</strong> con lo que había (recomendado), tomar el <strong>último costo</strong> o no
                  cambiar. Queda en el kardex como «compra».
                </p>
              </div>
              <div>
                <h3 className={styles.subtitulo}>Marcas y categorías</h3>
                <p>
                  Ya vienen 57 marcas de repuestos y un árbol de 186 categorías con sinónimos de mostrador; esas las
                  mantiene Wake Parts para todos. Si te falta una marca o una categoría, creala como{" "}
                  <strong>propia</strong> en <em>Inventario</em>: solo la ve y la usa tu taller, puede ir dentro de una
                  categoría general y sus sinónimos también entran en la búsqueda.
                </p>
                <h3 className={styles.subtitulo}>Importar desde Excel</h3>
                <p>
                  El botón <strong>Importar</strong> recibe un <code className={styles.codigo}>.xlsx</code> o{" "}
                  <code className={styles.codigo}>.csv</code> (hasta 5000 productos). Descargá la plantilla o usá tu
                  archivo: se reconocen encabezados como «Código», «Stock» o «Precio de venta». Primero{" "}
                  <strong>Revisar</strong> (no guarda nada y dice qué fila tiene qué problema), después importar. Con
                  código, un producto existente se actualiza; las marcas nuevas se crean como propias.
                </p>
              </div>
            </div>
            <Nota titulo="Productos con ventas no se borran">
              Si un producto ya salió en una factura, desactivalo en vez de borrarlo: así los documentos viejos
              siguen completos.
            </Nota>
          </Capitulo>

          {/* 05 ------------------------------------------------------------ */}
          <Capitulo
            id="tablas"
            numero="05"
            titulo="Tablas y formularios"
            bajada="Todos los listados y formularios funcionan igual, en cualquier módulo."
          >
            <div className={styles.dosColumnas}>
              <div>
                <h3 className={styles.subtitulo}>Tablas</h3>
                <ul className={styles.lista}>
                  <li>Buscador arriba y filtros por columna; los filtros activos quedan como fichas que se quitan.</li>
                  <li>
                    Clic en un encabezado ordena; <Tecla>Mayús</Tecla> + clic agrega un segundo orden.
                  </li>
                  <li>
                    Mostrá, ocultá, reordená y cambiá el ancho de las columnas. Se recuerdan por usuario (se reinician
                    desde <em>Mi usuario</em>).
                  </li>
                  <li>Filas compactas para ver más a la vez.</li>
                  <li>
                    <Tecla>↑</Tecla> <Tecla>↓</Tecla> recorren filas; <Tecla>Enter</Tecla> abre el registro.
                  </li>
                </ul>
              </div>
              <div>
                <h3 className={styles.subtitulo}>Formularios</h3>
                <ul className={styles.lista}>
                  <li>
                    El punto <Led tono="acento" /> junto a una etiqueta marca un campo obligatorio.
                  </li>
                  <li>Las listas relacionadas van en cascada: elegís marca y el modelo solo ofrece los de esa marca.</li>
                  <li>Los campos calculados (utilidad, margen) se ven como lectura de instrumento.</li>
                  <li>Si algo falta o está mal, el campo se marca y te dice qué revisar.</li>
                </ul>
              </div>
            </div>
          </Capitulo>

          {/* 06 ------------------------------------------------------------ */}
          <Capitulo
            id="ventas"
            numero="06"
            titulo="Ventas y CAI"
            bajada="Documentos emitidos, clientes, el reporte de ventas y la numeración autorizada por el SAR."
          >
            <div className={styles.dosColumnas}>
              <div>
                <h3 className={styles.subtitulo}>Documentos</h3>
                <ul className={styles.lista}>
                  <li>Todas las cotizaciones y facturas, con su total, estado y vendedor.</li>
                  <li>Abrí uno para imprimirlo o guardarlo como PDF.</li>
                  <li>
                    <strong>Pasar a carrito</strong>: una cotización (o una factura) se copia a un carrito nuevo para
                    facturarla o repetirla.
                  </li>
                  <li>
                    <strong>Anular</strong> (dueño o administrador) conserva el número, pide el motivo y devuelve las
                    existencias. Un documento emitido nunca se borra.
                  </li>
                  <li>Las cotizaciones se numeran aparte (COT-000001) y valen 15 días.</li>
                </ul>
                <h3 className={styles.subtitulo}>Clientes</h3>
                <p>
                  Con RTN (14 dígitos) salen con nombre y RTN en la factura; sin RTN, como consumidor final. Cualquier
                  miembro puede crearlos, también desde el mostrador.
                </p>
                <h3 className={styles.subtitulo}>Reporte de ventas</h3>
                <p>
                  En <em>Ventas › Análisis</em>: ventas con ISV, facturas, ticket promedio, utilidad y margen,
                  comparados con el período anterior del mismo largo (▲ verde es mejor). Ventas por día, lo más
                  vendido, categorías, vendedores y clientes. Elegí hoy, 7 o 30 días, el mes o un rango propio, y
                  exportalo a Excel. Los vendedores no ven utilidad ni costos.
                </p>
              </div>
              <div>
                <h3 className={styles.subtitulo}>CAI</h3>
                <p>
                  Registrá el CAI que te dio el SAR con su rango y fecha límite. La factura toma el siguiente número
                  sin saltos:
                </p>
                <div className={styles.numeracion} aria-label="Número de factura 000-001-01-00000001">
                  <span>
                    <b>000</b>
                    <small>Establec.</small>
                  </span>
                  <i>-</i>
                  <span>
                    <b>001</b>
                    <small>Punto</small>
                  </span>
                  <i>-</i>
                  <span>
                    <b>01</b>
                    <small>Tipo</small>
                  </span>
                  <i>-</i>
                  <span>
                    <b>00000001</b>
                    <small>Correlativo</small>
                  </span>
                </div>
                <p>
                  Si el rango se acaba o la fecha pasa, no deja facturar: registrá el siguiente CAI. Con facturas
                  emitidas, un CAI solo se puede desactivar.
                </p>
              </div>
            </div>
            <Nota tono="aviso" titulo="Reglas fiscales a confirmar con tu contador">
              Precios capturados sin ISV (15 % sumado en la factura), tipo de documento 01 para facturas, leyendas
              impresas y vigencia de cotizaciones. Todavía no hay notas de crédito ni exoneraciones.
            </Nota>
          </Capitulo>

          {/* 07 ------------------------------------------------------------ */}
          <Capitulo
            id="taller"
            numero="07"
            titulo="Taller y Mi usuario"
            bajada="Los datos de tu negocio y los tuyos."
          >
            <div className={styles.dosColumnas}>
              <div>
                <h3 className={styles.subtitulo}>Taller</h3>
                <p>
                  <strong>Datos</strong>: nombre, razón social, RTN, contacto y dirección, que son los que salen en las
                  facturas, el <strong>tope de descuento de los vendedores</strong> y los datos de ejemplo.
                </p>
                <p>
                  <strong>Apariencia</strong>: subí tu <strong>logo</strong> y una foto de <strong>fondo</strong> para el
                  escritorio de todo el equipo (con un velo para que se lea bien, o «Restablecer el de Wake Parts»).
                  Elegí la base clara u oscura y el <strong>color de tu marca</strong>: reemplaza al rojo en todo el
                  sistema. Lo ves en vivo antes de guardar.
                </p>
                <p>
                  <strong>Factura</strong>: el diseño de tus facturas y cotizaciones con vista previa: estilo, color o
                  solo negro, logo, tipo de tabla, un lema y un mensaje al pie. Los datos que pide el SAR se imprimen
                  siempre. Todo esto lo editan el dueño y los administradores.
                </p>
              </div>
              <div>
                <h3 className={styles.subtitulo}>Mi usuario</h3>
                <p>
                  Se abre tocando tu nombre en la barra de menú. Cambiá cómo te llamás en el sistema, reiniciá las
                  columnas de todas las tablas, repetí el recorrido guiado o cerrá la sesión.
                </p>
              </div>
            </div>
          </Capitulo>

          {/* 08 ------------------------------------------------------------ */}
          <Capitulo
            id="equipo"
            numero="08"
            titulo="Usuarios y roles"
            bajada="Invitá a tu equipo con su correo y dale el rol justo."
          >
            <p>
              En <em>Usuarios</em> (solo dueño y administrador) invitás un correo con un rol. Al entrar con ese correo,
              la persona queda dentro. A quien se va se le <strong>desactiva</strong>: no se borra, para que siga
              constando quién hizo cada factura.
            </p>
            <div className={styles.tablaScroll}>
              <table className={styles.tabla}>
                <caption>Qué puede hacer cada rol</caption>
                <thead>
                  <tr>
                    <th scope="col" />
                    <th scope="col">Dueño</th>
                    <th scope="col">Admin.</th>
                    <th scope="col">Vendedor</th>
                  </tr>
                </thead>
                <tbody>
                  {PERMISOS.map(([accion, ...roles]) => (
                    <tr key={accion}>
                      <th scope="row">{accion}</th>
                      {roles.map((si, i) => (
                        <td key={i} className={styles.celdaLed}>
                          <Led estado={si ? "si" : "no"} tono={si ? "ok" : "acento"} />
                          <span className="sr-only">{si ? "Sí" : "No"}</span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Nota titulo="Reglas que cuida la base de datos">
              Nadie se cambia su propio rol, solo un dueño toca a otro dueño y siempre queda al menos un dueño activo.
            </Nota>
            <h3 className={styles.subtitulo}>Actividad</h3>
            <p>
              El módulo <em>Actividad</em> (solo dueño y administrador) es la caja negra del taller: cada inicio y cierre
              de sesión con su <strong>IP y dispositivo</strong>, y cada producto, precio, cliente, factura, CAI o
              usuario que alguien creó, editó o eliminó, con la fecha y hora exactas. Abrí una fila para ver{" "}
              <strong>el antes y el después</strong> de cada campo. Nadie puede editar ni borrar ese registro.
            </p>
          </Capitulo>

          {/* 09 ------------------------------------------------------------ */}
          <Capitulo
            id="mantenimiento"
            numero="09"
            titulo="Mantenimiento"
            bajada="Los catálogos que comparten todos los talleres."
          >
            <p>
              Marcas, modelos, años, carrocerías y especificaciones (motor y carrocería) de vehículos, más el árbol de
              categorías generales y sus relacionadas. Hay más de 16 000 especificaciones cargadas. Todos pueden
              consultarlos; solo el administrador de Wake Parts los edita, para que el catálogo sea uno solo y limpio
              para todas las empresas.
            </p>
            <Nota titulo="¿Falta un vehículo o una categoría?">
              Una categoría la podés crear como propia en Inventario › Categorías. Un vehículo, avisale al equipo de
              Wake Parts; mientras tanto, asigná el producto al nivel de arriba (el modelo o la marca).
            </Nota>
          </Capitulo>

          {/* 10 ------------------------------------------------------------ */}
          <Capitulo id="glosario" numero="10" titulo="Glosario" bajada="Las palabras del oficio y del SAR.">
            <dl className={styles.glosario}>
              {[
                ["CAI", "Código de Autorización de Impresión. Lo emite el SAR y autoriza un rango de facturas hasta una fecha."],
                ["RTN", "Registro Tributario Nacional: 14 dígitos que identifican al contribuyente."],
                ["ISV", "Impuesto Sobre Ventas, 15 % general."],
                ["SAR", "Servicio de Administración de Rentas, la autoridad tributaria."],
                ["Consumidor final", "Quien compra sin RTN en la factura."],
                ["OEM", "Número de parte del fabricante original del vehículo."],
                ["Especificación", "Una versión concreta de un vehículo: modelo, año, carrocería y motor."],
                ["Kardex", "Historial de entradas y salidas de un producto."],
                ["Yonker", "Deshuesadero: vende piezas usadas de vehículos desarmados."],
              ].map(([t, d]) => (
                <div key={t}>
                  <dt>{t}</dt>
                  <dd>{d}</dd>
                </div>
              ))}
            </dl>
          </Capitulo>

          <footer className={styles.pie}>
            <p>¿Algo no está aquí o no funciona como dice? Contale al equipo de Wake Parts.</p>
            <Link href="/inicio" className={styles.volver}>
              Ir al tablero
            </Link>
          </footer>
        </main>
      </div>
    </div>
  );
}
