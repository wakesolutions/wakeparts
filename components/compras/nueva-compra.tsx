"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useApi } from "@/components/datos/apis";
import inv from "@/components/inventario/inventario.module.css";
import ui from "@/components/ui/controles.module.css";
import { IconoBuscar, IconoMas, IconoPapelera } from "@/components/ui/iconos";
import { Odometro } from "@/components/ventas/odometro";
import { FORMAS_PAGO, etiquetaForma, type FormaPago } from "@/lib/cobros";
import {
  hoyIso,
  sumarDiasIso,
  totalesCompra,
  type CondicionCompra,
  type ProveedorBreve,
  type TipoCompra,
} from "@/lib/compras";
import { cant, centavos, fechaDia, moneda } from "@/lib/formato";
import { formatoRtn, type ResultadoBusqueda } from "@/lib/ventas";
import styles from "./compras.module.css";

type LineaProducto = {
  id: number;
  codigo: string;
  nombre: string;
  existencia: number;
  costoActual: number;
  cantidad: string;
  costo: string;
  exento: boolean;
};

type LineaGasto = { clave: number; descripcion: string; monto: string; exento: boolean };

const num = (s: string) => {
  const n = Number(String(s).replace(/,/g, ""));
  return Number.isFinite(n) ? n : NaN;
};

const gastoVacio = (clave: number): LineaGasto => ({ clave, descripcion: "", monto: "", exento: false });

/**
 * Compras › Nueva compra: la factura del proveedor tal como llegó. De
 * productos (suben existencias y costo promedio) o de gasto; contado (y si el
 * efectivo sale de la caja) o crédito. Calcula igual que registrar_compra().
 */
export function NuevaCompra({ onRegistrada }: { onRegistrada: (id: string, numero: string) => void }) {
  const api = useApi("compras");
  const [proveedor, setProveedor] = useState<ProveedorBreve | null>(null);
  const [documento, setDocumento] = useState("");
  const [cai, setCai] = useState("");
  const [fecha, setFecha] = useState(hoyIso);
  const [tipo, setTipo] = useState<TipoCompra>("inventario");
  const [productos, setProductos] = useState<LineaProducto[]>([]);
  const [gastos, setGastos] = useState<LineaGasto[]>([gastoVacio(1)]);
  const [condicion, setCondicion] = useState<CondicionCompra>("contado");
  const [vence, setVence] = useState("");
  const [forma, setForma] = useState<FormaPago>("efectivo");
  const [referencia, setReferencia] = useState("");
  const [deCaja, setDeCaja] = useState(true);
  const [caja, setCaja] = useState<{ punto: string; turno: number } | null>(null);
  const [isvEscrito, setIsvEscrito] = useState<string | null>(null);
  const [notas, setNotas] = useState("");
  const [confirmar, setConfirmar] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    api
      .cajaAbierta()
      .then((c) => vivo && setCaja(c))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [api]);

  const netos = useMemo(
    () =>
      tipo === "inventario"
        ? productos.map((l) => ({
            neto: centavos((num(l.cantidad) || 0) * (l.costo === "" ? l.costoActual : num(l.costo) || 0)),
            exento: l.exento,
          }))
        : gastos.map((g) => ({ neto: centavos(num(g.monto) || 0), exento: g.exento })),
    [tipo, productos, gastos],
  );
  const isvNum = isvEscrito === null ? null : num(isvEscrito);
  const t = totalesCompra(netos, isvNum === null || Number.isNaN(isvNum) ? null : isvNum);

  const lineasMalas =
    tipo === "inventario"
      ? productos.some((l) => !(num(l.cantidad) > 0) || (l.costo !== "" && !(num(l.costo) >= 0)))
      : gastos.some((g) => (g.monto.trim() || g.descripcion.trim()) && (!(num(g.monto) > 0) || !g.descripcion.trim()));
  const hayLineas = tipo === "inventario" ? productos.length > 0 : gastos.some((g) => num(g.monto) > 0);
  const venceFinal = condicion === "credito" ? vence || (proveedor ? sumarDiasIso(fecha, proveedor.dias_credito) : "") : "";
  const faltas = [
    !proveedor && "el proveedor",
    !hayLineas && (tipo === "inventario" ? "los productos" : "los montos"),
    lineasMalas && "líneas incompletas",
    !t.isvValido && "el ISV",
    condicion === "credito" && venceFinal < fecha && "el vencimiento",
  ].filter(Boolean) as string[];
  const puede = faltas.length === 0 && t.total > 0 && !ocupado;
  const sacaDeCaja = condicion === "contado" && forma === "efectivo" && deCaja && caja !== null;
  const formaActual = FORMAS_PAGO.find((f) => f.valor === forma)!;

  function tocar() {
    setConfirmar(false);
    setError(null);
  }

  function limpiar() {
    setProductos([]);
    setGastos([gastoVacio(1)]);
    setDocumento("");
    setCai("");
    setReferencia("");
    setIsvEscrito(null);
    setNotas("");
    setVence("");
  }

  async function registrar() {
    if (!proveedor) return;
    setOcupado(true);
    setError(null);
    const r = await api
      .registrar({
        tipo,
        id_proveedor: proveedor.id,
        documento: documento.trim() || null,
        cai: cai.trim() || null,
        fecha,
        condicion,
        vence: condicion === "credito" ? venceFinal : null,
        forma_pago: condicion === "contado" ? forma : null,
        referencia: formaActual.pideReferencia ? referencia : null,
        de_caja: sacaDeCaja,
        isv: isvEscrito === null ? null : t.isv,
        notas: notas.trim() || null,
        lineas:
          tipo === "inventario"
            ? productos.map((l) => ({
                id_producto: l.id,
                cantidad: num(l.cantidad),
                costo: l.costo === "" ? l.costoActual : num(l.costo),
                exento: l.exento,
              }))
            : gastos
                .filter((g) => num(g.monto) > 0)
                .map((g) => ({ descripcion: g.descripcion.trim(), monto: num(g.monto), exento: g.exento })),
      })
      .catch(() => ({ ok: false as const, error: "Sin conexión. Intentá de nuevo." }));
    setOcupado(false);
    setConfirmar(false);
    if (!r.ok) return setError(r.error);
    limpiar();
    onRegistrada(r.id, r.numero);
  }

  return (
    <div className={styles.compra}>
      <header className={styles.cabecera}>
        <ElegirProveedor
          proveedor={proveedor}
          onElegir={(p) => {
            setProveedor(p);
            setVence("");
            if (p && p.dias_credito > 0) setCondicion("credito");
            else if (p) setCondicion("contado");
            tocar();
          }}
        />
        <label className={styles.campo}>
          <span className={styles.etiqueta}>Factura del proveedor</span>
          <input
            className={`${ui.campo} ${ui.campoMono}`}
            placeholder="000-001-01-00001234"
            value={documento}
            maxLength={40}
            onChange={(e) => {
              setDocumento(e.target.value);
              tocar();
            }}
          />
        </label>
        <label className={styles.campo}>
          <span className={styles.etiqueta}>CAI de su factura</span>
          <input
            className={`${ui.campo} ${ui.campoMono}`}
            placeholder="Opcional"
            value={cai}
            maxLength={40}
            onChange={(e) => setCai(e.target.value)}
          />
        </label>
        <label className={styles.campo}>
          <span className={styles.etiqueta}>Fecha</span>
          <input
            type="date"
            className={`${ui.campo} ${ui.campoMono}`}
            value={fecha}
            max={hoyIso()}
            onChange={(e) => {
              setFecha(e.target.value || hoyIso());
              tocar();
            }}
          />
        </label>
      </header>

      <div className={styles.tipoBarra}>
        <div className={inv.segmento} role="radiogroup" aria-label="Qué se compró">
          {(
            [
              ["inventario", "Productos"],
              ["gasto", "Gasto"],
            ] as const
          ).map(([v, e]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={tipo === v}
              onClick={() => {
                setTipo(v);
                setIsvEscrito(null);
                tocar();
              }}
            >
              {e}
            </button>
          ))}
        </div>
        <p className={styles.ayuda}>
          {tipo === "inventario"
            ? "Mercadería: suben las existencias y el costo promedio. Costos sin ISV."
            : "Luz, alquiler, flete, papelería… sin pasar por inventario. Montos sin ISV."}
        </p>
      </div>

      <section className={styles.cuerpo}>
        {tipo === "inventario" ? (
          <LineasProductos
            lineas={productos}
            onCambiar={(ls) => {
              setProductos(ls);
              tocar();
            }}
          />
        ) : (
          <ul className={styles.gastos}>
            {gastos.map((g, i) => (
              <li key={g.clave}>
                <input
                  className={ui.campo}
                  placeholder={i === 0 ? "Energía eléctrica de septiembre" : "Descripción"}
                  value={g.descripcion}
                  maxLength={240}
                  aria-label="Descripción del gasto"
                  onChange={(e) => {
                    setGastos((gs) => gs.map((x) => (x.clave === g.clave ? { ...x, descripcion: e.target.value } : x)));
                    tocar();
                  }}
                />
                <input
                  className={`${ui.campo} ${ui.campoMono}`}
                  placeholder="0.00"
                  inputMode="decimal"
                  value={g.monto}
                  aria-label="Monto sin ISV"
                  onChange={(e) => {
                    setGastos((gs) => gs.map((x) => (x.clave === g.clave ? { ...x, monto: e.target.value } : x)));
                    tocar();
                  }}
                />
                <label className={styles.exento}>
                  <input
                    type="checkbox"
                    className={ui.casilla}
                    checked={g.exento}
                    onChange={(e) => {
                      setGastos((gs) => gs.map((x) => (x.clave === g.clave ? { ...x, exento: e.target.checked } : x)));
                      tocar();
                    }}
                  />
                  Exento
                </label>
                <button
                  type="button"
                  className={`${ui.boton} ${ui.fantasma} ${ui.icono}`}
                  aria-label="Quitar línea"
                  disabled={gastos.length === 1}
                  onClick={() => setGastos((gs) => gs.filter((x) => x.clave !== g.clave))}
                >
                  <IconoPapelera tamano={13} />
                </button>
              </li>
            ))}
            {gastos.length < 30 && (
              <li className={styles.otraLineaFila}>
                <button
                  type="button"
                  className={styles.otraLinea}
                  onClick={() => setGastos((gs) => [...gs, gastoVacio(Math.max(...gs.map((x) => x.clave)) + 1)])}
                >
                  <IconoMas tamano={11} /> Otra línea
                </button>
              </li>
            )}
          </ul>
        )}
      </section>

      <footer className={styles.pie}>
        <div className={styles.pago}>
          <span className={styles.etiqueta}>Pago</span>
          <div className={inv.segmento} role="radiogroup" aria-label="Condición">
            {(
              [
                ["contado", "Contado"],
                ["credito", "Crédito"],
              ] as const
            ).map(([v, e]) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={condicion === v}
                onClick={() => {
                  setCondicion(v);
                  tocar();
                }}
              >
                {e}
              </button>
            ))}
          </div>
          {condicion === "contado" ? (
            <>
              <div className={styles.formas} role="radiogroup" aria-label="Forma de pago">
                {FORMAS_PAGO.map((f) => (
                  <button
                    key={f.valor}
                    type="button"
                    role="radio"
                    aria-checked={forma === f.valor}
                    onClick={() => {
                      setForma(f.valor);
                      tocar();
                    }}
                  >
                    {f.etiqueta}
                  </button>
                ))}
              </div>
              {formaActual.pideReferencia && (
                <input
                  className={`${ui.campo} ${ui.campoMono}`}
                  placeholder={forma === "cheque" ? "N.º de cheque y banco" : "N.º de referencia"}
                  value={referencia}
                  maxLength={80}
                  aria-label="Referencia del pago"
                  onChange={(e) => setReferencia(e.target.value)}
                />
              )}
              {forma === "efectivo" &&
                (caja ? (
                  <label className={styles.deCaja}>
                    <input
                      type="checkbox"
                      className={ui.casilla}
                      checked={deCaja}
                      onChange={(e) => {
                        setDeCaja(e.target.checked);
                        tocar();
                      }}
                    />
                    <span>
                      Sale de la caja abierta
                      <small>
                        {caja.punto} · turno {caja.turno}. Desmarcalo si lo pagaste con otro dinero.
                      </small>
                    </span>
                  </label>
                ) : (
                  <p className={styles.ayuda}>No hay caja abierta en tu punto: el efectivo no se descuenta de ningún turno.</p>
                ))}
            </>
          ) : (
            <label className={styles.campo}>
              <span className={styles.etiqueta}>Vence</span>
              <input
                type="date"
                className={`${ui.campo} ${ui.campoMono}`}
                value={venceFinal}
                min={fecha}
                onChange={(e) => {
                  setVence(e.target.value);
                  tocar();
                }}
              />
              <span className={styles.ayuda}>
                {proveedor
                  ? proveedor.dias_credito > 0
                    ? `Plazo del proveedor: ${proveedor.dias_credito} días.`
                    : "El proveedor no tiene plazo: elegí la fecha."
                  : "Elegí el proveedor."}
              </span>
            </label>
          )}
          <input
            className={ui.campo}
            placeholder="Nota (opcional)"
            value={notas}
            maxLength={300}
            aria-label="Nota de la compra"
            onChange={(e) => setNotas(e.target.value)}
          />
        </div>

        <div className={styles.totales}>
          <dl>
            {t.exento > 0 && (
              <div>
                <dt>Exento</dt>
                <dd>{moneda(t.exento)}</dd>
              </div>
            )}
            <div>
              <dt>Gravado</dt>
              <dd>{moneda(t.gravado)}</dd>
            </div>
            <div>
              <dt>
                ISV
                {isvEscrito === null ? (
                  <button type="button" className={styles.enlace} onClick={() => setIsvEscrito(t.isvCalculado.toFixed(2))}>
                    ajustar
                  </button>
                ) : (
                  <button type="button" className={styles.enlace} onClick={() => setIsvEscrito(null)}>
                    15 %
                  </button>
                )}
              </dt>
              <dd>
                {isvEscrito === null ? (
                  moneda(t.isv)
                ) : (
                  <input
                    className={`${ui.campo} ${ui.campoMono} ${styles.isv}`}
                    inputMode="decimal"
                    autoFocus
                    value={isvEscrito}
                    aria-label="ISV de la factura del proveedor"
                    aria-invalid={!t.isvValido || undefined}
                    onChange={(e) => {
                      setIsvEscrito(e.target.value);
                      tocar();
                    }}
                  />
                )}
              </dd>
            </div>
          </dl>
          {!t.isvValido && <p className={styles.error}>El ISV no puede pasar del 18 % de lo gravado.</p>}
          <Odometro valor={t.total} etiqueta="Total de la compra" />

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          {confirmar && proveedor ? (
            <div className={styles.confirmar} role="alertdialog" aria-label="Confirmar compra">
              <p>
                ¿Registrar la compra de <strong>{moneda(t.total)}</strong> a <strong>{proveedor.nombre}</strong>?
              </p>
              <p className={styles.ayuda}>
                {condicion === "credito"
                  ? `Al crédito: vence el ${fechaDia(venceFinal)} y queda en Por pagar.`
                  : `De contado en ${etiquetaForma(forma).toLowerCase()}${sacaDeCaja ? ", sale de la caja" : ""}.`}
                {tipo === "inventario" && ` Suben ${cant(productos.reduce((s, l) => s + (num(l.cantidad) || 0), 0))} unidades al inventario.`}
              </p>
              <div className={styles.botones}>
                <button type="button" className={`${ui.boton} ${ui.fantasma}`} onClick={() => setConfirmar(false)}>
                  Volver
                </button>
                <button type="button" className={`${ui.boton} ${ui.primario}`} disabled={ocupado} autoFocus onClick={registrar}>
                  {ocupado ? "Registrando…" : "Sí, registrar"}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className={`${ui.boton} ${ui.primario} ${styles.registrar}`}
              disabled={!puede}
              title={faltas.length ? `Falta: ${faltas.join(", ")}` : undefined}
              onClick={() => setConfirmar(true)}
            >
              Registrar compra
            </button>
          )}
          {faltas.length > 0 && (hayLineas || proveedor) && <p className={styles.ayuda}>Falta: {faltas.join(", ")}.</p>}
        </div>
      </footer>
    </div>
  );
}

// -------------------------------------------------------------- proveedor ----

function ElegirProveedor({ proveedor, onElegir }: { proveedor: ProveedorBreve | null; onElegir: (p: ProveedorBreve | null) => void }) {
  const api = useApi("compras");
  const [texto, setTexto] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [sugerencias, setSugerencias] = useState<ProveedorBreve[]>([]);
  const [nuevo, setNuevo] = useState<{ rtn: string; dias: string } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!abierto) return;
    let vivo = true;
    const t = setTimeout(() => {
      api
        .proveedores(texto)
        .then((s) => vivo && setSugerencias(s))
        .catch(() => {});
    }, 160);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [api, abierto, texto]);

  async function crear() {
    if (!nuevo) return;
    const r = await api.crearProveedor({ nombre: texto, rtn: nuevo.rtn || null, dias_credito: Number(nuevo.dias) || 0 });
    if (!r.ok) return setAviso(r.error);
    setNuevo(null);
    setAviso(null);
    setTexto("");
    setAbierto(false);
    onElegir(r.proveedor);
  }

  if (proveedor) {
    return (
      <div className={`${styles.campo} ${styles.proveedor}`}>
        <span className={styles.etiqueta}>Proveedor</span>
        <div className={styles.proveedorElegido}>
          <strong>{proveedor.nombre}</strong>
          <span>
            {proveedor.rtn ? `RTN ${formatoRtn(proveedor.rtn)}` : "Sin RTN"}
            {proveedor.dias_credito > 0 ? ` · crédito a ${proveedor.dias_credito} días` : " · contado"}
          </span>
          <button
            type="button"
            className={styles.enlace}
            onClick={() => {
              onElegir(null);
              setTimeout(() => campo.current?.focus(), 0);
            }}
          >
            Cambiar
          </button>
        </div>
      </div>
    );
  }

  const coincide = sugerencias.some((s) => s.nombre.toUpperCase() === texto.trim().toUpperCase());
  return (
    <div className={`${styles.campo} ${styles.proveedor}`}>
      <span className={styles.etiqueta}>Proveedor</span>
      <input
        ref={campo}
        autoFocus
        className={ui.campo}
        placeholder="Buscá por nombre, RTN o teléfono"
        value={texto}
        maxLength={160}
        aria-label="Proveedor"
        onFocus={() => setAbierto(true)}
        onBlur={() => !nuevo && setAbierto(false)}
        onChange={(e) => {
          setTexto(e.target.value);
          setNuevo(null);
          setAviso(null);
        }}
      />
      {abierto && (sugerencias.length > 0 || texto.trim()) && (
        <div className={styles.sugerencias}>
          <ul>
            {sugerencias.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setTexto("");
                    setAbierto(false);
                    onElegir(p);
                  }}
                >
                  <span>{p.nombre}</span>
                  <small>{p.rtn ? formatoRtn(p.rtn) : (p.telefono ?? "")}</small>
                </button>
              </li>
            ))}
          </ul>
          {texto.trim() && !coincide && !nuevo && (
            <button
              type="button"
              className={styles.nuevoProveedor}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setNuevo({ rtn: "", dias: "0" })}
            >
              <IconoMas tamano={11} /> Nuevo proveedor «{texto.trim().toUpperCase()}»
            </button>
          )}
          {nuevo && (
            <form
              className={styles.altaProveedor}
              onSubmit={(e) => {
                e.preventDefault();
                void crear();
              }}
            >
              <input
                className={`${ui.campo} ${ui.campoMono}`}
                placeholder="RTN (opcional)"
                inputMode="numeric"
                value={nuevo.rtn}
                autoFocus
                aria-label="RTN del proveedor"
                onChange={(e) => setNuevo({ ...nuevo, rtn: e.target.value })}
              />
              <label className={styles.dias}>
                <input
                  className={`${ui.campo} ${ui.campoMono}`}
                  inputMode="numeric"
                  value={nuevo.dias}
                  aria-label="Plazo de crédito en días"
                  onChange={(e) => setNuevo({ ...nuevo, dias: e.target.value.replace(/\D/g, "").slice(0, 3) })}
                />
                <span>días de crédito</span>
              </label>
              <div className={styles.botones}>
                <button
                  type="button"
                  className={`${ui.boton} ${ui.fantasma}`}
                  onClick={() => {
                    setNuevo(null);
                    campo.current?.focus();
                  }}
                >
                  Cancelar
                </button>
                <button type="submit" className={`${ui.boton} ${ui.primario}`}>
                  Crear y usar
                </button>
              </div>
              {aviso && <p className={styles.error}>{aviso}</p>}
            </form>
          )}
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------- productos ----

function LineasProductos({ lineas, onCambiar }: { lineas: LineaProducto[]; onCambiar: (ls: LineaProducto[]) => void }) {
  const api = useApi("inventario");
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState<ResultadoBusqueda[]>([]);
  const [indice, setIndice] = useState(0);
  const [aviso, setAviso] = useState<string | null>(null);
  const buscador = useRef<HTMLInputElement>(null);
  const cantidades = useRef(new Map<number, HTMLInputElement>());
  const ultimo = useRef<number | null>(null);

  useEffect(() => {
    let vivo = true;
    const t = setTimeout(() => {
      if (!texto.trim()) return vivo && setResultados([]);
      api
        .buscar(texto)
        .then((r) => {
          if (!vivo) return;
          const lista = r.filter((p) => p.grupo !== "complemento");
          setResultados([...lista.filter((p) => p.controla_inventario), ...lista.filter((p) => !p.controla_inventario)].slice(0, 8));
          setIndice(0);
        })
        .catch(() => vivo && setResultados([]));
    }, 160);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [api, texto]);

  useEffect(() => {
    if (ultimo.current === null) return;
    const el = cantidades.current.get(ultimo.current);
    el?.focus();
    el?.select();
    ultimo.current = null;
  }, [lineas]);

  function agregar(p: ResultadoBusqueda) {
    if (!p.controla_inventario) return setAviso(`«${p.nombre}» es un servicio: no lleva inventario.`);
    setAviso(null);
    setTexto("");
    setResultados([]);
    ultimo.current = p.id;
    if (lineas.some((l) => l.id === p.id)) return;
    onCambiar([
      ...lineas,
      {
        id: p.id,
        codigo: p.codigo,
        nombre: p.nombre,
        existencia: Number(p.existencia ?? 0),
        costoActual: Number(p.costo ?? 0),
        cantidad: "1",
        costo: p.costo === null ? "" : String(p.costo),
        exento: Boolean(p.exento),
      },
    ]);
  }

  function teclear(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndice((i) => Math.min(i + 1, resultados.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndice((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && resultados[indice]) {
      e.preventDefault();
      agregar(resultados[indice]);
    } else if (e.key === "Escape") {
      setTexto("");
    }
  }

  const cambiar = (id: number, c: Partial<LineaProducto>) => onCambiar(lineas.map((l) => (l.id === id ? { ...l, ...c } : l)));

  return (
    <>
      <div className={inv.buscarProducto}>
        <label className={inv.buscar}>
          <IconoBuscar tamano={16} />
          <input
            ref={buscador}
            className={inv.buscarCampo}
            placeholder="Buscá o escaneá los productos de la factura…"
            aria-label="Buscar producto"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={teclear}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        {resultados.length > 0 && (
          <ul className={inv.sugerencias} role="listbox" aria-label="Productos">
            {resultados.map((p, i) => (
              <li key={p.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === indice}
                  className={inv.sugerencia}
                  data-servicio={!p.controla_inventario || undefined}
                  onPointerEnter={() => setIndice(i)}
                  onClick={() => agregar(p)}
                >
                  <span className={inv.sugerenciaCodigo}>{p.codigo}</span>
                  <span className={inv.sugerenciaNombre}>
                    {p.nombre}
                    {p.marca && <small> · {p.marca}</small>}
                  </span>
                  <span className={inv.sugerenciaExistencia}>{p.controla_inventario ? `Hay ${cant(p.existencia ?? 0)}` : "Servicio"}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {aviso && <p className={styles.error}>{aviso}</p>}

      {lineas.length === 0 ? (
        <div className={inv.vacio}>
          <p className={inv.vacioTitulo}>Nada en la factura todavía</p>
          <p>Buscá los productos que llegaron. Con Enter se agrega el primero y el cursor salta a la cantidad. ¿No existe? Crealo en Inventario o con Toma rápida.</p>
        </div>
      ) : (
        <div className={inv.tablaScroll}>
          <table className={inv.lineas}>
            <thead>
              <tr>
                <th scope="col">Producto</th>
                <th scope="col" className={inv.num}>
                  Existencia
                </th>
                <th scope="col" className={inv.num}>
                  Cantidad
                </th>
                <th scope="col" className={inv.num}>
                  Costo unit.
                </th>
                <th scope="col">Exento</th>
                <th scope="col" className={inv.num}>
                  Subtotal
                </th>
                <th scope="col">
                  <span className="sr-only">Quitar</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {lineas.map((l) => {
                const n = num(l.cantidad);
                const mala = !(n > 0);
                const costo = l.costo === "" ? l.costoActual : num(l.costo);
                return (
                  <tr key={l.id}>
                    <td>
                      <span className={inv.lineaNombre}>{l.nombre}</span>
                      <span className={inv.lineaCodigo}>{l.codigo}</span>
                    </td>
                    <td className={inv.num}>
                      {cant(l.existencia)} <span className={inv.flechaExistencia}>→</span> <strong>{mala ? "—" : cant(l.existencia + n)}</strong>
                    </td>
                    <td className={inv.num}>
                      <input
                        ref={(el) => {
                          if (el) cantidades.current.set(l.id, el);
                          else cantidades.current.delete(l.id);
                        }}
                        className={`${ui.campo} ${ui.campoMono} ${inv.campoNum}`}
                        inputMode="decimal"
                        aria-label={`Cantidad de ${l.nombre}`}
                        aria-invalid={mala || undefined}
                        value={l.cantidad}
                        onChange={(e) => cambiar(l.id, { cantidad: e.target.value })}
                        onKeyDown={(e) => e.key === "Enter" && buscador.current?.focus()}
                      />
                    </td>
                    <td className={inv.num}>
                      <input
                        className={`${ui.campo} ${ui.campoMono} ${inv.campoNum}`}
                        inputMode="decimal"
                        aria-label={`Costo unitario sin ISV de ${l.nombre}`}
                        placeholder={String(l.costoActual)}
                        value={l.costo}
                        onChange={(e) => cambiar(l.id, { costo: e.target.value })}
                        onKeyDown={(e) => e.key === "Enter" && buscador.current?.focus()}
                      />
                      {l.costo !== "" && num(l.costo) !== l.costoActual && l.costoActual > 0 && (
                        <span className={styles.costoAntes}>antes {moneda(l.costoActual)}</span>
                      )}
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        className={ui.casilla}
                        checked={l.exento}
                        aria-label={`${l.nombre} exento de ISV`}
                        onChange={(e) => cambiar(l.id, { exento: e.target.checked })}
                      />
                    </td>
                    <td className={inv.num}>{moneda((n || 0) * (costo || 0))}</td>
                    <td>
                      <button
                        type="button"
                        className={`${ui.boton} ${ui.fantasma} ${ui.icono}`}
                        aria-label={`Quitar ${l.nombre}`}
                        onClick={() => onCambiar(lineas.filter((x) => x.id !== l.id))}
                      >
                        <IconoPapelera tamano={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
