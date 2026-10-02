"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useApi } from "@/components/datos/apis";
import ui from "@/components/ui/controles.module.css";
import { IconoCerrar, IconoDocumento, IconoMas, IconoMenos, IconoPapelera } from "@/components/ui/iconos";
import { FORMAS_PAGO, type CreditoCliente } from "@/lib/cobros";
import { cant, centavos, moneda, pct } from "@/lib/formato";
import { urlImagen } from "@/lib/imagenes";
import {
  calcularTotales,
  formatoRtn,
  type CambiosCarrito,
  type CambiosLinea,
  type Carrito,
  type Cliente,
  type LineaCarrito,
  type PuntoEmision,
  type TipoDocumento,
} from "@/lib/ventas";
import { Odometro } from "./odometro";
import styles from "./ticket.module.css";

type Props = {
  carrito: Carrito;
  lineas: LineaCarrito[];
  /** Dueño/admin: ven el margen de la venta. */
  veMargen: boolean;
  ocupado: boolean;
  error: string | null;
  onCambiarCarrito: (cambios: CambiosCarrito) => void;
  onCambiarLinea: (id: number, cambios: CambiosLinea) => void;
  onQuitarLinea: (id: number) => void;
  onLineaLibre: (descripcion: string, precio: number, exento: boolean) => void;
  onEmitir: (tipo: TipoDocumento) => void;
  onDescartar: () => void;
};

export function Ticket({
  carrito,
  lineas,
  veMargen,
  ocupado,
  error,
  onCambiarCarrito,
  onCambiarLinea,
  onQuitarLinea,
  onLineaLibre,
  onEmitir,
  onDescartar,
}: Props) {
  const api = useApi("ventas");
  const totales = calcularTotales(lineas, carrito.descuento_pct, carrito.exonerado);
  const [confirmar, setConfirmar] = useState<TipoDocumento | null>(null);
  const [libre, setLibre] = useState(false);
  const [punto, setPunto] = useState<PuntoEmision | null | undefined>(undefined);
  const [credito, setCredito] = useState<CreditoCliente | null>(null);
  const alCredito = carrito.condicion === "credito";
  const utilidad = totales.gravado + totales.exonerado + totales.exento - totales.costo;
  const [pagaCon, setPagaCon] = useState("");
  const formaPago = FORMAS_PAGO.find((f) => f.valor === carrito.forma_pago) ?? FORMAS_PAGO[0];
  const cambio = centavos((Number(pagaCon.replace(/,/g, "")) || 0) - totales.total);

  // Al confirmar una factura se dice con qué caja sale (su CAI y su numeración).
  useEffect(() => {
    if (confirmar !== "factura" || punto !== undefined) return;
    let vivo = true;
    api
      .puntoEmision()
      .then((p) => vivo && setPunto(p))
      .catch(() => vivo && setPunto(null));
    return () => {
      vivo = false;
    };
  }, [api, confirmar, punto]);

  return (
    <aside className={styles.ticket} aria-label="Carrito" data-recorrido="ticket">
      <div className={styles.encabezado}>
        <Cliente carrito={carrito} onCambiar={onCambiarCarrito} />
        <Exoneracion carrito={carrito} onCambiar={onCambiarCarrito} />
        <Condicion carrito={carrito} total={totales.total} onCredito={setCredito} onCambiar={onCambiarCarrito} />
      </div>

      <div className={styles.lineas}>
        {lineas.length === 0 ? (
          <div className={styles.vacio}>
            <p className={styles.vacioTitulo}>Carrito vacío</p>
            <p>Buscá a la izquierda y tocá un producto, o presioná Enter en el primero.</p>
          </div>
        ) : (
          <ul>
            {lineas.map((l, i) => (
              <Linea
                key={l.id}
                linea={l}
                neto={totales.lineas[i]?.neto ?? 0}
                onCambiar={(c) => onCambiarLinea(l.id, c)}
                onQuitar={() => onQuitarLinea(l.id)}
              />
            ))}
          </ul>
        )}
        {libre ? (
          <LineaLibre
            onAgregar={(d, p, e) => {
              onLineaLibre(d, p, e);
              setLibre(false);
            }}
            onCancelar={() => setLibre(false)}
          />
        ) : (
          <button type="button" className={styles.agregarLibre} onClick={() => setLibre(true)}>
            <IconoMas tamano={12} /> Línea libre (servicio o pieza sin registrar)
          </button>
        )}
      </div>

      <div className={styles.cierre}>
        <Descuento carrito={carrito} subtotal={totales.subtotal} onCambiar={onCambiarCarrito} />

        <dl className={styles.totales}>
          <div>
            <dt>Subtotal</dt>
            <dd>{moneda(totales.subtotal)}</dd>
          </div>
          {totales.descuento > 0 && (
            <div data-tono="descuento">
              <dt>Descuento</dt>
              <dd>− {moneda(totales.descuento)}</dd>
            </div>
          )}
          {totales.exento > 0 && (
            <div>
              <dt>Exento</dt>
              <dd>{moneda(totales.exento)}</dd>
            </div>
          )}
          {carrito.exonerado ? (
            <div data-tono="exonerado">
              <dt>Exonerado · sin ISV</dt>
              <dd>{moneda(totales.exonerado)}</dd>
            </div>
          ) : (
            <>
              <div>
                <dt>Gravado 15 %</dt>
                <dd>{moneda(totales.gravado)}</dd>
              </div>
              <div>
                <dt>ISV 15 %</dt>
                <dd>{moneda(totales.isv)}</dd>
              </div>
            </>
          )}
          {veMargen && lineas.length > 0 && (
            <div data-tono={utilidad < 0 ? "negativo" : "utilidad"}>
              <dt>Utilidad</dt>
              <dd>{moneda(utilidad)}</dd>
            </div>
          )}
        </dl>

        <Odometro valor={totales.total} />

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        {confirmar ? (
          <div className={styles.confirmar} role="alertdialog" aria-label="Confirmar emisión">
            <p>
              {confirmar === "factura" ? "¿Facturar" : "¿Cotizar"} <strong>{moneda(totales.total)}</strong> a{" "}
              <strong>{carrito.cliente_nombre ?? "Consumidor final"}</strong>
              {carrito.cliente_rtn ? ` (RTN ${formatoRtn(carrito.cliente_rtn)})` : ""}?
            </p>
            {confirmar === "factura" && (
              <p className={styles.confirmarNota}>
                {punto
                  ? `Sale de ${punto.nombre} (${punto.codigo}) con el siguiente número de su CAI`
                  : "La factura usa el siguiente número del CAI"}
                {carrito.exonerado ? ", exonerada del ISV" : ""}
                {alCredito ? `, al crédito a ${credito?.dias_credito ?? 30} días` : ""} y descuenta existencias.
              </p>
            )}
            {confirmar === "factura" && !alCredito && (
              <div className={styles.pago}>
                <div className={styles.formasPago} role="radiogroup" aria-label="Forma de pago">
                  {FORMAS_PAGO.map((f) => (
                    <button
                      key={f.valor}
                      type="button"
                      role="radio"
                      aria-checked={formaPago.valor === f.valor}
                      onClick={() => f.valor !== carrito.forma_pago && onCambiarCarrito({ forma_pago: f.valor })}
                    >
                      {f.etiqueta}
                    </button>
                  ))}
                </div>
                {formaPago.valor === "efectivo" ? (
                  <label className={styles.pagaCon}>
                    <span>Paga con</span>
                    <input
                      className={`${ui.campo} ${ui.campoMono}`}
                      inputMode="decimal"
                      placeholder={totales.total.toFixed(2)}
                      value={pagaCon}
                      onChange={(e) => setPagaCon(e.target.value.replace(/[^\d.,]/g, ""))}
                      aria-label="Paga con"
                    />
                    <strong data-mal={(pagaCon !== "" && cambio < 0) || undefined}>
                      {pagaCon === "" ? "Cambio —" : cambio < 0 ? `Faltan ${moneda(-cambio)}` : `Cambio ${moneda(cambio)}`}
                    </strong>
                  </label>
                ) : (
                  formaPago.pideReferencia && (
                    <input
                      className={`${ui.campo} ${ui.campoMono}`}
                      key={`${carrito.id}-${carrito.referencia_pago ?? ""}`}
                      defaultValue={carrito.referencia_pago ?? ""}
                      placeholder="N.º de autorización o referencia"
                      maxLength={80}
                      aria-label="Referencia del pago"
                      onBlur={(e) => {
                        const v = e.target.value.trim() || null;
                        if (v !== carrito.referencia_pago) onCambiarCarrito({ referencia_pago: v });
                      }}
                    />
                  )
                )}
              </div>
            )}
            <div className={styles.botones}>
              <button type="button" className={`${ui.boton} ${ui.fantasma}`} onClick={() => setConfirmar(null)}>
                Volver
              </button>
              <button
                type="button"
                className={`${ui.boton} ${ui.primario}`}
                disabled={ocupado}
                autoFocus
                onClick={() => {
                  onEmitir(confirmar);
                  setConfirmar(null);
                }}
              >
                {ocupado ? "Emitiendo…" : confirmar === "factura" ? "Sí, facturar" : "Sí, cotizar"}
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.botones} data-recorrido="emitir">
            <button
              type="button"
              className={`${ui.boton} ${ui.fantasma} ${styles.descartar}`}
              onClick={onDescartar}
              title="Descartar carrito"
              aria-label="Descartar carrito"
            >
              <IconoPapelera tamano={14} />
            </button>
            <button type="button" className={ui.boton} disabled={!lineas.length || ocupado} onClick={() => setConfirmar("cotizacion")}>
              <IconoDocumento tamano={14} /> Cotizar
            </button>
            <button
              type="button"
              className={`${ui.boton} ${ui.primario} ${styles.facturar}`}
              disabled={!lineas.length || ocupado}
              data-facturar=""
              onClick={() => setConfirmar("factura")}
            >
              Facturar <kbd>F9</kbd>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

// ----------------------------------------------------------------- línea ----

function Linea({
  linea,
  neto,
  onCambiar,
  onQuitar,
}: {
  linea: LineaCarrito;
  neto: number;
  onCambiar: (c: CambiosLinea) => void;
  onQuitar: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const falta = linea.controla_inventario && linea.existencia !== null && linea.cantidad > linea.existencia;
  return (
    <li className={styles.linea}>
      <span className={styles.lineaFoto}>
        {linea.imagen ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={urlImagen(linea.imagen)} alt="" />
        ) : (
          <span className={styles.sinFoto} />
        )}
      </span>
      <div className={styles.lineaInfo}>
        <p className={styles.lineaNombre}>{linea.descripcion}</p>
        <p className={styles.lineaMeta}>
          {linea.codigo && <span>{linea.codigo}</span>}
          <button type="button" className={styles.lineaPrecio} onClick={() => setEditando((e) => !e)} aria-expanded={editando}>
            {moneda(linea.precio)}
            {linea.descuento_pct > 0 && <span className={styles.lineaDescuento}>−{pct(linea.descuento_pct)}</span>}
          </button>
          {falta && <span className={styles.falta}>Solo hay {cant(linea.existencia)}</span>}
        </p>
        {editando && <EditorLinea linea={linea} onCambiar={onCambiar} onListo={() => setEditando(false)} />}
      </div>
      <div className={styles.lineaDerecha}>
        <div className={styles.cantidad}>
          <button
            type="button"
            aria-label="Menos"
            onClick={() => (linea.cantidad > 1 ? onCambiar({ cantidad: linea.cantidad - 1 }) : onQuitar())}
          >
            {linea.cantidad > 1 ? <IconoMenos tamano={12} /> : <IconoPapelera tamano={12} />}
          </button>
          <input
            aria-label="Cantidad"
            inputMode="decimal"
            key={linea.cantidad}
            defaultValue={cant(linea.cantidad)}
            onBlur={(e) => {
              const n = Number(e.target.value.replace(",", "."));
              if (n > 0 && n !== linea.cantidad) onCambiar({ cantidad: n });
              else e.target.value = cant(linea.cantidad);
            }}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          />
          <button type="button" aria-label="Más" onClick={() => onCambiar({ cantidad: linea.cantidad + 1 })}>
            <IconoMas tamano={12} />
          </button>
        </div>
        <strong className={styles.lineaTotal}>{moneda(neto)}</strong>
      </div>
    </li>
  );
}

function EditorLinea({ linea, onCambiar, onListo }: { linea: LineaCarrito; onCambiar: (c: CambiosLinea) => void; onListo: () => void }) {
  const [precio, setPrecio] = useState(String(linea.precio));
  const [descuento, setDescuento] = useState(String(linea.descuento_pct || ""));
  function guardar(e: FormEvent) {
    e.preventDefault();
    const p = Number(precio.replace(",", "."));
    const d = Number((descuento || "0").replace(",", "."));
    const cambios: CambiosLinea = {};
    if (Number.isFinite(p) && p >= 0 && p !== linea.precio) cambios.precio = p;
    if (Number.isFinite(d) && d >= 0 && d <= 100 && d !== linea.descuento_pct) cambios.descuento_pct = d;
    if (Object.keys(cambios).length) onCambiar(cambios);
    onListo();
  }
  const costo = linea.costo ?? null;
  return (
    <form className={styles.editorLinea} onSubmit={guardar}>
      <label>
        <span>Precio (sin ISV)</span>
        <input className={`${ui.campo} ${ui.campoMono}`} inputMode="decimal" value={precio} onChange={(e) => setPrecio(e.target.value)} autoFocus />
      </label>
      <label>
        <span>Descuento %</span>
        <input className={`${ui.campo} ${ui.campoMono}`} inputMode="decimal" value={descuento} placeholder="0" onChange={(e) => setDescuento(e.target.value)} />
      </label>
      <button type="submit" className={`${ui.boton} ${ui.primario}`}>
        Aplicar
      </button>
      {costo !== null && Number(precio) < costo && <p className={styles.falta}>Por debajo del costo ({moneda(costo)}).</p>}
    </form>
  );
}

function LineaLibre({ onAgregar, onCancelar }: { onAgregar: (d: string, p: number, exento: boolean) => void; onCancelar: () => void }) {
  const [descripcion, setDescripcion] = useState("");
  const [precio, setPrecio] = useState("");
  const [exento, setExento] = useState(false);
  return (
    <form
      className={styles.libre}
      onSubmit={(e) => {
        e.preventDefault();
        const p = Number(precio.replace(",", "."));
        if (descripcion.trim() && p >= 0) onAgregar(descripcion.trim(), p, exento);
      }}
    >
      <input
        className={ui.campo}
        placeholder="Mano de obra: cambio de pastillas"
        value={descripcion}
        onChange={(e) => setDescripcion(e.target.value)}
        aria-label="Descripción"
        autoFocus
      />
      <input
        className={`${ui.campo} ${ui.campoMono}`}
        placeholder="Precio sin ISV"
        inputMode="decimal"
        value={precio}
        onChange={(e) => setPrecio(e.target.value)}
        aria-label="Precio sin ISV"
      />
      <label className={styles.libreExento}>
        <input type="checkbox" className={ui.casilla} checked={exento} onChange={(e) => setExento(e.target.checked)} /> Exento
      </label>
      <button type="submit" className={`${ui.boton} ${ui.primario}`}>
        Agregar
      </button>
      <button type="button" className={`${ui.boton} ${ui.fantasma}`} onClick={onCancelar} aria-label="Cancelar">
        <IconoCerrar tamano={12} />
      </button>
    </form>
  );
}

// ------------------------------------------------------------- descuento ----

function Descuento({ carrito, subtotal, onCambiar }: { carrito: Carrito; subtotal: number; onCambiar: (c: CambiosCarrito) => void }) {
  const [modo, setModo] = useState<"pct" | "monto">("pct");
  const [valor, setValor] = useState("");
  const actual = carrito.descuento_pct;

  function aplicar(e: FormEvent) {
    e.preventDefault();
    const n = Number(valor.replace(",", "."));
    if (!Number.isFinite(n) || n < 0) return;
    const porcentaje = modo === "pct" ? n : subtotal > 0 ? (n / subtotal) * 100 : 0;
    onCambiar({ descuento_pct: Math.min(100, Math.round(porcentaje * 1000) / 1000) });
    setValor("");
  }

  return (
    <form className={styles.descuento} onSubmit={aplicar}>
      <span className={styles.descuentoEtiqueta}>Descuento general</span>
      {actual > 0 && (
        <button type="button" className={styles.descuentoActual} onClick={() => onCambiar({ descuento_pct: 0 })} title="Quitar descuento">
          {pct(actual)} <IconoCerrar tamano={10} />
        </button>
      )}
      <div className={styles.descuentoControl}>
        <div className={styles.segmento} role="radiogroup" aria-label="Tipo de descuento">
          <button type="button" role="radio" aria-checked={modo === "pct"} onClick={() => setModo("pct")}>
            %
          </button>
          <button type="button" role="radio" aria-checked={modo === "monto"} onClick={() => setModo("monto")}>
            L
          </button>
        </div>
        <input
          className={`${ui.campo} ${ui.campoMono}`}
          inputMode="decimal"
          placeholder={modo === "pct" ? "5" : "100.00"}
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          aria-label={modo === "pct" ? "Porcentaje de descuento" : "Monto de descuento"}
        />
        <button type="submit" className={ui.boton} disabled={!valor}>
          Aplicar
        </button>
      </div>
    </form>
  );
}

// ------------------------------------------------------------- condición ----

/**
 * Contado o crédito. Solo con un cliente registrado; el crédito, si el dueño se
 * lo habilitó (Ventas › Clientes). Muestra cuánto le queda disponible y si
 * debe algo vencido: la base decide (vencidas y límite solo los pasa dueño/admin).
 */
function Condicion({
  carrito,
  total,
  onCredito,
  onCambiar,
}: {
  carrito: Carrito;
  total: number;
  onCredito: (c: CreditoCliente | null) => void;
  onCambiar: (c: CambiosCarrito) => void;
}) {
  const api = useApi("cobros");
  // Lo leído queda guardado con su cliente: al cambiar de cliente se ve «cargando» sin un setState en el efecto.
  const [leido, setLeido] = useState<{ id: number; dato: CreditoCliente | null } | null>(null);
  const credito = !carrito.id_cliente ? null : leido?.id === carrito.id_cliente ? leido.dato : undefined;
  const alCredito = carrito.condicion === "credito";

  useEffect(() => {
    const id = carrito.id_cliente;
    if (!id) return;
    let vivo = true;
    api
      .credito(id)
      .catch(() => null)
      .then((c) => {
        if (!vivo) return;
        setLeido({ id, dato: c });
        onCredito(c);
      });
    return () => {
      vivo = false;
    };
  }, [api, carrito.id_cliente, onCredito]);

  // Sin cliente registrado no hay crédito: solo se avisa si quedó marcado.
  if (!carrito.id_cliente) {
    return alCredito ? (
      <p className={styles.condicionAviso}>
        Al crédito solo con un cliente registrado.{" "}
        <button type="button" onClick={() => onCambiar({ condicion: "contado" })}>
          Volver a contado
        </button>
      </p>
    ) : null;
  }
  if (credito === undefined) return null;
  const habilitado = Boolean(credito?.credito_habilitado);
  if (!habilitado && !alCredito) return null;

  const disponible = credito?.disponible ?? null;
  const excede = alCredito && disponible !== null && total > disponible;

  return (
    <div className={styles.condicion}>
      <div className={styles.segmento} role="radiogroup" aria-label="Condición de la venta">
        <button type="button" role="radio" aria-checked={!alCredito} onClick={() => onCambiar({ condicion: "contado" })}>
          Contado
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={alCredito}
          disabled={!habilitado}
          onClick={() => onCambiar({ condicion: "credito" })}
        >
          Crédito
        </button>
      </div>
      <p className={styles.condicionDato}>
        {!habilitado ? (
          <span data-tono="mal">Este cliente no tiene crédito.</span>
        ) : (
          <>
            <span>{credito!.dias_credito} días</span>
            <span>{disponible === null ? "Sin límite" : `Disponible ${moneda(disponible)}`}</span>
            {credito!.vencido > 0 && <span data-tono="mal">Vencido {moneda(credito!.vencido)}</span>}
          </>
        )}
      </p>
      {excede && <p className={styles.condicionAviso}>Esta venta pasa el límite: solo el dueño o un administrador la pueden facturar.</p>}
    </div>
  );
}

// ----------------------------------------------------------- exoneración ----

/**
 * Cliente exonerado (embajadas, ONG, zonas libres…): lo gravado sale como
 * importe exonerado, sin ISV. La factura pide RTN y la orden de compra exenta
 * o la constancia de registro de exonerado.
 */
function Exoneracion({ carrito, onCambiar }: { carrito: Carrito; onCambiar: (c: CambiosCarrito) => void }) {
  const faltaRtn = carrito.exonerado && !carrito.cliente_rtn;
  const faltaDocumento = carrito.exonerado && !carrito.exo_orden_compra && !carrito.exo_constancia;

  if (!carrito.exonerado) {
    return (
      <button type="button" className={styles.exoActivar} onClick={() => onCambiar({ exonerado: true })}>
        <span className={styles.exoLed} aria-hidden="true" /> Exonerado del ISV
      </button>
    );
  }

  const campo = (clave: "exo_orden_compra" | "exo_constancia" | "exo_registro_sag", etiqueta: string, ejemplo: string) => (
    <label className={styles.exoCampo}>
      <span>{etiqueta}</span>
      <input
        className={`${ui.campo} ${ui.campoMono}`}
        key={`${carrito.id}-${clave}-${carrito[clave] ?? ""}`}
        defaultValue={carrito[clave] ?? ""}
        placeholder={ejemplo}
        maxLength={60}
        onBlur={(e) => {
          const v = e.target.value.trim().toUpperCase() || null;
          if (v !== carrito[clave]) onCambiar({ [clave]: v });
        }}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      />
    </label>
  );

  return (
    <fieldset className={styles.exo}>
      <legend className={styles.exoTitulo}>
        <span className={styles.exoLed} data-encendido="" aria-hidden="true" /> Exonerado del ISV
        <button type="button" className={styles.exoQuitar} onClick={() => onCambiar({ exonerado: false })}>
          Quitar
        </button>
      </legend>
      <div className={styles.exoCampos}>
        {campo("exo_orden_compra", "Orden de compra exenta", "OCE-0001")}
        {campo("exo_constancia", "Constancia de exonerado", "CRE-0001")}
        {campo("exo_registro_sag", "Registro SAG", "Si aplica")}
      </div>
      {(faltaRtn || faltaDocumento) && (
        <p className={styles.exoAviso}>
          {faltaRtn ? "Para facturar exonerado, el cliente lleva RTN. " : ""}
          {faltaDocumento ? "Escribí la orden de compra exenta o la constancia." : ""}
        </p>
      )}
    </fieldset>
  );
}

// --------------------------------------------------------------- cliente ----

function Cliente({ carrito, onCambiar }: { carrito: Carrito; onCambiar: (c: CambiosCarrito) => void }) {
  const api = useApi("ventas");
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [rtn, setRtn] = useState("");
  const [sugerencias, setSugerencias] = useState<Cliente[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const primero = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editando) return;
    let vivo = true;
    const t = setTimeout(() => {
      api
        .clientes(nombre || rtn)
        .then((s) => vivo && setSugerencias(s))
        .catch(() => {});
    }, 160);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [api, editando, nombre, rtn]);

  function abrir() {
    setNombre(carrito.cliente_nombre ?? "");
    setRtn(carrito.cliente_rtn ?? "");
    setAviso(null);
    setEditando(true);
    setTimeout(() => primero.current?.focus(), 0);
  }

  const rtnLimpio = rtn.replace(/\D/g, "");
  const rtnValido = !rtnLimpio || rtnLimpio.length === 14;

  function usar(e?: FormEvent) {
    e?.preventDefault();
    if (!rtnValido) return setAviso("El RTN son 14 dígitos.");
    onCambiar({ id_cliente: null, cliente_nombre: nombre.trim() || null, cliente_rtn: rtnLimpio || null });
    setEditando(false);
  }

  async function guardar() {
    if (!nombre.trim()) return setAviso("Escribí el nombre.");
    if (!rtnValido) return setAviso("El RTN son 14 dígitos.");
    const r = await api.crearCliente({ nombre: nombre.trim(), rtn: rtnLimpio || null });
    if (!r.ok) return setAviso(r.error);
    onCambiar({ id_cliente: r.cliente.id });
    setEditando(false);
  }

  if (!editando) {
    return (
      <button type="button" className={styles.cliente} onClick={abrir} data-recorrido="cliente">
        <span className={styles.clienteEtiqueta}>Cliente</span>
        <span className={styles.clienteNombre}>{carrito.cliente_nombre ?? "Consumidor final"}</span>
        <span className={styles.clienteRtn}>
          {carrito.cliente_rtn ? `RTN ${formatoRtn(carrito.cliente_rtn)}` : "Sin RTN · tocá para cambiar"}
        </span>
      </button>
    );
  }

  return (
    <form className={styles.clienteForm} onSubmit={usar}>
      <div className={styles.clienteCampos}>
        <input
          ref={primero}
          className={ui.campo}
          placeholder="Nombre o razón social"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          aria-label="Nombre del cliente"
        />
        <input
          className={`${ui.campo} ${ui.campoMono}`}
          placeholder="RTN (opcional)"
          inputMode="numeric"
          value={rtn}
          onChange={(e) => setRtn(e.target.value)}
          aria-invalid={!rtnValido || undefined}
          aria-label="RTN del cliente"
        />
      </div>
      {sugerencias.length > 0 && (
        <ul className={styles.clienteSugerencias}>
          {sugerencias.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  onCambiar({ id_cliente: c.id });
                  setEditando(false);
                }}
              >
                <span>{c.nombre}</span>
                <small>{c.rtn ? formatoRtn(c.rtn) : c.telefono ?? ""}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
      {aviso && <p className={styles.falta}>{aviso}</p>}
      <div className={styles.botones}>
        <button type="button" className={`${ui.boton} ${ui.fantasma}`} onClick={() => { onCambiar({ id_cliente: null, cliente_nombre: null, cliente_rtn: null }); setEditando(false); }}>
          Consumidor final
        </button>
        <button type="button" className={ui.boton} onClick={guardar}>
          Guardar cliente
        </button>
        <button type="submit" className={`${ui.boton} ${ui.primario}`}>
          Usar
        </button>
      </div>
    </form>
  );
}
