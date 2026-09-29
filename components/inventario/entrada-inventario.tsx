"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useApi } from "@/components/datos/apis";
import ui from "@/components/ui/controles.module.css";
import { IconoBuscar, IconoPapelera } from "@/components/ui/iconos";
import { cant, moneda } from "@/lib/formato";
import type { ModoCosto } from "@/lib/inventario";
import type { ResultadoBusqueda } from "@/lib/ventas";
import styles from "./inventario.module.css";

type Linea = {
  id: number;
  codigo: string;
  nombre: string;
  existencia: number;
  costoActual: number;
  cantidad: string;
  costo: string;
};

const MODOS: { id: ModoCosto; etiqueta: string; ayuda: string }[] = [
  { id: "promedio", etiqueta: "Promedio", ayuda: "Mezcla el costo de lo que había con el de lo que entra (recomendado)." },
  { id: "ultimo", etiqueta: "Último costo", ayuda: "El costo del producto pasa a ser el de esta compra." },
  { id: "mantener", etiqueta: "No cambiar", ayuda: "Solo suma existencias; el costo queda igual." },
];

const num = (s: string) => {
  const n = Number(String(s).replace(/,/g, ""));
  return Number.isFinite(n) ? n : NaN;
};

/** Carga existencias (compras, conteos, devoluciones) de varios productos a la vez. */
export function EntradaInventario({ onListo }: { onListo?: () => void }) {
  const api = useApi("inventario");
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState<ResultadoBusqueda[]>([]);
  const [indice, setIndice] = useState(0);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [referencia, setReferencia] = useState("");
  const [modo, setModo] = useState<ModoCosto>("promedio");
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<{ tono: "ok" | "error"; texto: string } | null>(null);
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
          // Los servicios van al final: Enter agrega el primer producto con inventario.
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

  // Al agregar un producto, el foco va a su cantidad.
  useEffect(() => {
    if (ultimo.current === null) return;
    const el = cantidades.current.get(ultimo.current);
    el?.focus();
    el?.select();
    ultimo.current = null;
  }, [lineas]);

  function agregar(p: ResultadoBusqueda) {
    if (!p.controla_inventario) {
      setAviso({ tono: "error", texto: `«${p.nombre}» es un servicio: no lleva inventario.` });
      return;
    }
    setAviso(null);
    setTexto("");
    setResultados([]);
    ultimo.current = p.id;
    setLineas((ls) =>
      ls.some((l) => l.id === p.id)
        ? ls
        : [
            ...ls,
            {
              id: p.id,
              codigo: p.codigo,
              nombre: p.nombre,
              existencia: Number(p.existencia ?? 0),
              costoActual: Number(p.costo ?? 0),
              cantidad: "1",
              costo: p.costo === null ? "" : String(p.costo),
            },
          ],
    );
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

  const cambiar = (id: number, c: Partial<Linea>) => setLineas((ls) => ls.map((l) => (l.id === id ? { ...l, ...c } : l)));

  const invalidas = lineas.filter((l) => !(num(l.cantidad) > 0) || (l.costo !== "" && !(num(l.costo) >= 0)));
  const unidades = lineas.reduce((s, l) => s + (num(l.cantidad) || 0), 0);
  const valor = lineas.reduce((s, l) => s + (num(l.cantidad) || 0) * (l.costo === "" ? l.costoActual : num(l.costo) || 0), 0);

  async function cargar() {
    if (!lineas.length || invalidas.length) return;
    setOcupado(true);
    setAviso(null);
    const r = await api
      .entrada(
        lineas.map((l) => ({ id_producto: l.id, cantidad: num(l.cantidad), costo: l.costo === "" ? null : num(l.costo) })),
        referencia,
        modo,
      )
      .catch(() => ({ ok: false as const, error: "Sin conexión. Intentá de nuevo." }));
    setOcupado(false);
    if (!r.ok) return setAviso({ tono: "error", texto: r.error });
    setAviso({
      tono: "ok",
      texto: `Listo: ${cant(r.unidades)} unidades en ${r.productos} ${r.productos === 1 ? "producto" : "productos"} (${moneda(r.valor)}). Quedó en el kardex como compra.`,
    });
    setLineas([]);
    setReferencia("");
    onListo?.();
    buscador.current?.focus();
  }

  return (
    <div className={styles.hoja}>
      <div className={styles.buscarProducto}>
        <label className={styles.buscar}>
          <IconoBuscar tamano={16} />
          <input
            ref={buscador}
            autoFocus
            className={styles.buscarCampo}
            placeholder="Buscá o escaneá: nombre, código, OEM o código de barras…"
            aria-label="Buscar producto"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={teclear}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        {resultados.length > 0 && (
          <ul className={styles.sugerencias} role="listbox" aria-label="Productos">
            {resultados.map((p, i) => (
              <li key={p.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === indice}
                  className={styles.sugerencia}
                  data-servicio={!p.controla_inventario || undefined}
                  onPointerEnter={() => setIndice(i)}
                  onClick={() => agregar(p)}
                >
                  <span className={styles.sugerenciaCodigo}>{p.codigo}</span>
                  <span className={styles.sugerenciaNombre}>
                    {p.nombre}
                    {p.marca && <small> · {p.marca}</small>}
                  </span>
                  <span className={styles.sugerenciaExistencia}>{p.controla_inventario ? `Hay ${cant(p.existencia ?? 0)}` : "Servicio"}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {lineas.length === 0 ? (
        <div className={styles.vacio}>
          <p className={styles.vacioTitulo}>Nada que cargar todavía</p>
          <p>Buscá los productos de la factura del proveedor. Con Enter se agrega el primero y el cursor salta a la cantidad.</p>
        </div>
      ) : (
        <div className={styles.tablaScroll}>
          <table className={styles.lineas}>
            <thead>
              <tr>
                <th scope="col">Producto</th>
                <th scope="col" className={styles.num}>
                  Existencia
                </th>
                <th scope="col" className={styles.num}>
                  Entra
                </th>
                <th scope="col" className={styles.num}>
                  Costo unit.
                </th>
                <th scope="col" className={styles.num}>
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
                return (
                  <tr key={l.id}>
                    <td>
                      <span className={styles.lineaNombre}>{l.nombre}</span>
                      <span className={styles.lineaCodigo}>{l.codigo}</span>
                    </td>
                    <td className={styles.num}>
                      {cant(l.existencia)} <span className={styles.flechaExistencia}>→</span>{" "}
                      <strong>{mala ? "—" : cant(l.existencia + n)}</strong>
                    </td>
                    <td className={styles.num}>
                      <input
                        ref={(el) => {
                          if (el) cantidades.current.set(l.id, el);
                          else cantidades.current.delete(l.id);
                        }}
                        className={`${ui.campo} ${ui.campoMono} ${styles.campoNum}`}
                        inputMode="decimal"
                        aria-label={`Cantidad de ${l.nombre}`}
                        aria-invalid={mala || undefined}
                        value={l.cantidad}
                        onChange={(e) => cambiar(l.id, { cantidad: e.target.value })}
                        onKeyDown={(e) => e.key === "Enter" && buscador.current?.focus()}
                      />
                    </td>
                    <td className={styles.num}>
                      <input
                        className={`${ui.campo} ${ui.campoMono} ${styles.campoNum}`}
                        inputMode="decimal"
                        aria-label={`Costo unitario de ${l.nombre}`}
                        placeholder={String(l.costoActual)}
                        value={l.costo}
                        onChange={(e) => cambiar(l.id, { costo: e.target.value })}
                        onKeyDown={(e) => e.key === "Enter" && buscador.current?.focus()}
                      />
                    </td>
                    <td className={styles.num}>{moneda((n || 0) * (l.costo === "" ? l.costoActual : num(l.costo) || 0))}</td>
                    <td>
                      <button
                        type="button"
                        className={`${ui.boton} ${ui.fantasma} ${ui.icono}`}
                        aria-label={`Quitar ${l.nombre}`}
                        onClick={() => setLineas((ls) => ls.filter((x) => x.id !== l.id))}
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

      <footer className={styles.pie}>
        <div className={styles.pieCampos}>
          <label className={styles.campo}>
            <span className={styles.etiqueta}>Referencia</span>
            <input
              className={ui.campo}
              placeholder="Factura del proveedor, conteo físico…"
              value={referencia}
              maxLength={120}
              onChange={(e) => setReferencia(e.target.value)}
            />
          </label>
          <div className={styles.campo}>
            <span className={styles.etiqueta} id="modo-costo">
              Costo del producto
            </span>
            <div className={styles.segmento} role="radiogroup" aria-labelledby="modo-costo">
              {MODOS.map((m) => (
                <button key={m.id} type="button" role="radio" aria-checked={modo === m.id} onClick={() => setModo(m.id)} title={m.ayuda}>
                  {m.etiqueta}
                </button>
              ))}
            </div>
            <span className={styles.ayuda}>{MODOS.find((m) => m.id === modo)?.ayuda}</span>
          </div>
        </div>
        <div className={styles.pieTotales}>
          <dl>
            <div>
              <dt>Unidades</dt>
              <dd>{cant(unidades)}</dd>
            </div>
            <div>
              <dt>Valor</dt>
              <dd>{moneda(valor)}</dd>
            </div>
          </dl>
          <button
            type="button"
            className={`${ui.boton} ${ui.primario}`}
            disabled={!lineas.length || invalidas.length > 0 || ocupado}
            onClick={cargar}
          >
            {ocupado ? "Cargando…" : "Cargar al inventario"}
          </button>
        </div>
        {aviso && (
          <p className={styles.aviso} data-tono={aviso.tono} role={aviso.tono === "error" ? "alert" : "status"}>
            {aviso.texto}
          </p>
        )}
      </footer>
    </div>
  );
}
