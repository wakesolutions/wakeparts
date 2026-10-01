"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { enviarPedidoWeb } from "@/app/acciones/pedido-web";
import { catalogoVehiculos } from "@/components/compatibilidad/api";
import { IconoBuscar, IconoCarrito, IconoCheck, IconoMas } from "@/components/ui/iconos";
import { resolverVehiculo, SelectorVehiculo } from "@/components/ventas/selector-vehiculo";
import { moneda } from "@/lib/formato";
import { enlaceWhatsapp, precioConIsv, rutaSitio, type ProductoWeb } from "@/lib/sitio-web";
import { textoVehiculo, type Vehiculo } from "@/lib/vehiculos";
import { useCarrito, type LineaCarrito } from "./carrito";
import { IconoPieza } from "./iconos";
import styles from "./sitio.module.css";

// ----------------------------------------------------------- encabezado ---

export function BotonCarrito({ slug }: { slug: string }) {
  const { unidades } = useCarrito(slug);
  const [cambio, setCambio] = useState(0);
  const previo = useRef(unidades);
  useEffect(() => {
    if (unidades > previo.current) setCambio((c) => c + 1);
    previo.current = unidades;
  }, [unidades]);

  return (
    <Link href={rutaSitio(slug, "/carrito")} className={styles.botonCarrito} aria-label={`Tu lista: ${unidades} ${unidades === 1 ? "pieza" : "piezas"}`}>
      <IconoCarrito tamano={16} />
      <span>Tu lista</span>
      {unidades > 0 && (
        <span key={cambio} className={styles.contador} data-cambio={cambio > 0 || undefined}>
          {unidades}
        </span>
      )}
    </Link>
  );
}

export function EnlaceNav({ href, children, exacto = false }: { href: string; children: React.ReactNode; exacto?: boolean }) {
  const ruta = usePathname();
  const actual = exacto ? ruta === href : ruta.startsWith(href);
  return (
    <Link href={href} aria-current={actual ? "page" : undefined}>
      {children}
    </Link>
  );
}

// -------------------------------------------------------------- agregar ---

type Agregable = Pick<ProductoWeb, "id" | "codigo" | "nombre" | "marca" | "precio" | "exento" | "imagen">;

export function BotonAgregar({ slug, producto }: { slug: string; producto: Agregable }) {
  const { agregar } = useCarrito(slug);
  const [listo, setListo] = useState(false);
  useEffect(() => {
    if (!listo) return;
    const t = setTimeout(() => setListo(false), 1400);
    return () => clearTimeout(t);
  }, [listo]);

  return (
    <button
      type="button"
      className={styles.agregar}
      data-listo={listo || undefined}
      aria-label={listo ? `${producto.nombre} agregado a tu lista` : `Agregar ${producto.nombre} a tu lista`}
      onClick={() => {
        agregar(producto);
        setListo(true);
      }}
    >
      {listo ? <IconoCheck tamano={16} /> : <IconoMas tamano={16} />}
    </button>
  );
}

/** Ficha: cantidad + agregar. */
export function AccionesFicha({ slug, producto }: { slug: string; producto: Agregable }) {
  const { agregar, lineas } = useCarrito(slug);
  const [cantidad, setCantidad] = useState(1);
  const [listo, setListo] = useState(false);
  const enLista = lineas.find((l) => l.id === producto.id)?.cantidad ?? 0;

  return (
    <div className={styles.fichaAcciones}>
      <div className={styles.cantidad} role="group" aria-label="Cantidad">
        <button type="button" onClick={() => setCantidad((c) => Math.max(1, c - 1))} aria-label="Menos">
          −
        </button>
        <output aria-live="polite">{cantidad}</output>
        <button type="button" onClick={() => setCantidad((c) => Math.min(99, c + 1))} aria-label="Más">
          +
        </button>
      </div>
      <button
        type="button"
        className={styles.botonPrimario}
        onClick={() => {
          agregar(producto, cantidad);
          setListo(true);
        }}
      >
        {listo ? <IconoCheck tamano={16} /> : <IconoCarrito tamano={16} />}
        {listo ? "Agregado a tu lista" : "Agregar a mi lista"}
      </button>
      {enLista > 0 && (
        <p className={styles.textoAyuda} style={{ gridColumn: "1 / -1" }}>
          Tenés {enLista} en tu lista ·{" "}
          <Link href={rutaSitio(slug, "/carrito")} className={styles.enlaceFlecha}>
            Ver lista y pedir
          </Link>
        </p>
      )}
    </div>
  );
}

// ------------------------------------------------------------- buscador ---

export type IdsVehiculo = { marca?: number; modelo?: number; anio?: number; motor?: number };

/**
 * «¿Qué carro tenés?»: el selector de vehículo del mostrador + texto libre.
 * Lleva al catálogo con los filtros en la URL y recuerda el vehículo para el pedido.
 */
export function Buscador({
  slug,
  inicial,
  texto: textoInicial = "",
  categoria,
  compacto = false,
}: {
  slug: string;
  inicial?: IdsVehiculo;
  texto?: string;
  categoria?: number;
  compacto?: boolean;
}) {
  const router = useRouter();
  const { recordarVehiculo, vehiculo: guardado } = useCarrito(slug);
  const [vehiculo, setVehiculo] = useState<Vehiculo>({});
  const [texto, setTexto] = useState(textoInicial);

  // Vehículo de la URL o, si no hay, el último que usó el visitante.
  const marca = inicial?.marca ?? guardado?.id_marca;
  const modelo = inicial?.modelo ?? guardado?.id_modelo;
  const anio = inicial?.anio ?? guardado?.id_modelo_anio;
  const motor = inicial?.motor ?? guardado?.id_especificacion;
  useEffect(() => {
    if (!marca) return;
    let vivo = true;
    resolverVehiculo(catalogoVehiculos, {
      id_marca: marca,
      id_modelo: modelo,
      id_modelo_anio: anio,
      id_especificacion: motor,
    })
      .then((v) => vivo && setVehiculo(v))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [marca, modelo, anio, motor]);

  function ir(v: Vehiculo, t: string) {
    const p = new URLSearchParams();
    if (t.trim()) p.set("q", t.trim().slice(0, 120));
    if (v.marca) p.set("marca", String(v.marca.id));
    if (v.modelo) p.set("modelo", String(v.modelo.id));
    if (v.anio) p.set("anio", String(v.anio.id));
    if (v.motor) p.set("motor", String(v.motor.id));
    if (categoria) p.set("cat", String(categoria));
    recordarVehiculo(
      v.marca
        ? {
            texto: textoVehiculo(v),
            id_marca: v.marca.id,
            id_modelo: v.modelo?.id,
            id_modelo_anio: v.anio?.id,
            id_especificacion: v.motor?.id,
          }
        : null,
    );
    router.push(`${rutaSitio(slug, "/catalogo")}${p.size ? `?${p}` : ""}`);
  }

  function enviar(e: FormEvent) {
    e.preventDefault();
    ir(vehiculo, texto);
  }

  return (
    <form className={styles.buscador} onSubmit={enviar} role="search" aria-label="Buscar repuestos">
      {!compacto && <p className={styles.buscadorEtiqueta}>¿Qué carro tenés? Te mostramos lo que le queda.</p>}
      <div className={styles.buscadorFila}>
        <SelectorVehiculo
          publico
          valor={vehiculo}
          onCambiar={(v) => {
            setVehiculo(v);
            // Al completar el vehículo (o quitarlo) ya se puede buscar.
            if (!v.marca || v.motor || (compacto && v.modelo)) ir(v, texto);
          }}
        />
        <input
          type="search"
          className={styles.campoTexto}
          placeholder="Pieza, marca o número de parte"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          aria-label="Pieza, marca o número de parte"
          maxLength={120}
        />
        <button type="submit" className={styles.botonPrimario}>
          <IconoBuscar tamano={16} /> Buscar
        </button>
      </div>
    </form>
  );
}

// -------------------------------------------------------------- galería ---

export function Galeria({ imagenes, nombre }: { imagenes: { grande: string; miniatura: string }[]; nombre: string }) {
  const [actual, setActual] = useState(0);
  if (!imagenes.length) {
    return (
      <div className={styles.galeriaPrincipal}>
        <IconoPieza tamano={96} />
      </div>
    );
  }
  return (
    <div className={styles.galeria}>
      <div className={styles.galeriaPrincipal}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imagenes[actual].grande} alt={nombre} />
      </div>
      {imagenes.length > 1 && (
        <div className={styles.miniaturas}>
          {imagenes.map((img, i) => (
            <button
              key={img.grande}
              type="button"
              className={styles.miniatura}
              aria-pressed={i === actual}
              aria-label={`Foto ${i + 1} de ${imagenes.length}`}
              onClick={() => setActual(i)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.miniatura} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------- pedido ---

function totalEstimado(lineas: LineaCarrito[]) {
  if (lineas.some((l) => l.precio == null)) return null;
  return lineas.reduce((s, l) => s + precioConIsv(l.precio!, l.exento) * l.cantidad, 0);
}

/** Tu lista + datos de contacto → pedido web (llega al mostrador del taller). */
export function PaginaCarrito({ slug, nombreTaller, whatsapp }: { slug: string; nombreTaller: string; whatsapp: string }) {
  const { lineas, vehiculo, cambiar, vaciar, recordarVehiculo } = useCarrito(slug);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<{ numero: number } | null>(null);
  const [cliente, setCliente] = useState({ nombre: "", telefono: "", correo: "", mensaje: "" });
  const total = totalEstimado(lineas);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    const r = await enviarPedidoWeb({
      slug,
      cliente,
      vehiculo: vehiculo
        ? {
            id_marca: vehiculo.id_marca,
            id_modelo: vehiculo.id_modelo,
            id_modelo_anio: vehiculo.id_modelo_anio,
            id_especificacion: vehiculo.id_especificacion,
          }
        : null,
      lineas: lineas.map((l) => ({ id_producto: l.id, cantidad: l.cantidad })),
    }).catch(() => ({ ok: false as const, error: "Sin conexión. Revisá tu internet e intentá otra vez." }));
    setEnviando(false);
    if (!r.ok) return setError(r.error);
    vaciar();
    setHecho({ numero: r.numero });
  }

  if (hecho) {
    const wa = enlaceWhatsapp(whatsapp, `Hola, acabo de mandar el pedido web #${hecho.numero} desde su página.`);
    return (
      <div className={`${styles.exito} ${styles.entra}`}>
        <p className={styles.exitoNumero}>Pedido #{hecho.numero} recibido</p>
        <h1 className={styles.catalogoTitulo}>¡Listo, {cliente.nombre.split(" ")[0]}!</h1>
        <p className={styles.heroBajada}>
          {nombreTaller} ya tiene tu lista. Te van a llamar o escribir al {cliente.telefono} para confirmar precio,
          existencia y entrega. No pagaste nada todavía.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href={rutaSitio(slug, "/catalogo")} className={styles.botonSecundario}>
            Seguir viendo piezas
          </Link>
          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer" className={styles.botonPrimario}>
              Avisar por WhatsApp
            </a>
          )}
        </div>
      </div>
    );
  }

  if (!lineas.length) {
    return (
      <div className={styles.vacio} style={{ marginBlock: "3rem 6rem" }}>
        <p className={styles.vacioTitulo}>Tu lista está vacía</p>
        <p>Buscá las piezas de tu carro y tocá «+» para agregarlas. Después nos mandás la lista y te confirmamos todo.</p>
        <Link href={rutaSitio(slug, "/catalogo")} className={styles.botonPrimario}>
          Ver el catálogo
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.pedido}>
      <section aria-label="Piezas de tu lista">
        <h1 className={styles.catalogoTitulo} style={{ marginBottom: "1.4rem" }}>
          Tu lista
        </h1>
        {vehiculo && (
          <p className={styles.resumen} style={{ marginBottom: "1rem" }}>
            Para: <strong>{vehiculo.texto}</strong> ·{" "}
            <button type="button" className={styles.quitar} onClick={() => recordarVehiculo(null)}>
              quitar vehículo
            </button>
          </p>
        )}
        <ul className={styles.lineas}>
          {lineas.map((l) => (
            <li key={l.id} className={styles.linea}>
              <span className={styles.lineaImagen}>
                {l.imagen ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={l.imagen} alt="" />
                ) : (
                  <IconoPieza tamano={28} />
                )}
              </span>
              <span>
                <span className={styles.tarjetaMarca}>{[l.marca, l.codigo].filter(Boolean).join(" · ")}</span>
                <Link href={rutaSitio(slug, `/producto/${l.id}`)} className={styles.tarjetaNombre} style={{ display: "block" }}>
                  {l.nombre}
                </Link>
                {l.precio != null && (
                  <span className={styles.precioNota}>{moneda(precioConIsv(l.precio, l.exento))} c/u</span>
                )}
              </span>
              <span className={styles.lineaControles}>
                <span className={styles.cantidad} role="group" aria-label={`Cantidad de ${l.nombre}`}>
                  <button type="button" onClick={() => cambiar(l.id, l.cantidad - 1)} aria-label="Menos">
                    −
                  </button>
                  <output>{l.cantidad}</output>
                  <button type="button" onClick={() => cambiar(l.id, l.cantidad + 1)} aria-label="Más">
                    +
                  </button>
                </span>
                <button type="button" className={styles.quitar} onClick={() => cambiar(l.id, 0)}>
                  Quitar
                </button>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <form className={styles.panelPedido} onSubmit={enviar}>
        <h2 className={styles.panelTitulo}>Mandar pedido</h2>
        <p className={styles.textoAyuda}>
          No se cobra nada en línea. El taller te confirma precio, existencia y entrega.
        </p>
        <div className={styles.campoGrupo}>
          <label htmlFor="pedido-nombre">Tu nombre</label>
          <input
            id="pedido-nombre"
            className={styles.campoTexto}
            required
            minLength={2}
            maxLength={120}
            autoComplete="name"
            value={cliente.nombre}
            onChange={(e) => setCliente({ ...cliente, nombre: e.target.value })}
          />
        </div>
        <div className={styles.campoGrupo}>
          <label htmlFor="pedido-telefono">Teléfono o WhatsApp</label>
          <input
            id="pedido-telefono"
            className={styles.campoTexto}
            required
            inputMode="tel"
            autoComplete="tel"
            pattern="[0-9 +\-]{8,20}"
            placeholder="9999-9999"
            value={cliente.telefono}
            onChange={(e) => setCliente({ ...cliente, telefono: e.target.value })}
          />
        </div>
        <div className={styles.campoGrupo}>
          <label htmlFor="pedido-correo">Correo (opcional)</label>
          <input
            id="pedido-correo"
            type="email"
            className={styles.campoTexto}
            maxLength={120}
            autoComplete="email"
            value={cliente.correo}
            onChange={(e) => setCliente({ ...cliente, correo: e.target.value })}
          />
        </div>
        <div className={styles.campoGrupo}>
          <label htmlFor="pedido-mensaje">¿Algo más? (opcional)</label>
          <textarea
            id="pedido-mensaje"
            className={styles.campoTexto}
            maxLength={600}
            placeholder="Ej.: es para un Corolla 2008 automático, lo paso a traer el sábado."
            value={cliente.mensaje}
            onChange={(e) => setCliente({ ...cliente, mensaje: e.target.value })}
          />
        </div>
        {total != null && (
          <p className={styles.totalEstimado}>
            <span className={styles.resumen}>Total estimado con ISV</span>
            <span className={styles.precio}>{moneda(total)}</span>
          </p>
        )}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <button type="submit" className={styles.botonPrimario} disabled={enviando}>
          {enviando ? "Mandando…" : "Mandar pedido"}
        </button>
        <p className={styles.textoAyuda}>
          Tus datos solo los ve {nombreTaller} para atender tu pedido.{" "}
          <Link href="/privacidad" className="underline underline-offset-2">
            Privacidad
          </Link>
          .
        </p>
      </form>
    </div>
  );
}
