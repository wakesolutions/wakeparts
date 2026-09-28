"use client";

import { memo } from "react";
import { IconoMas } from "@/components/ui/iconos";
import { cant, moneda } from "@/lib/formato";
import { urlImagen } from "@/lib/imagenes";
import { precioConIsv, type ResultadoBusqueda } from "@/lib/ventas";
import styles from "./mostrador.module.css";

type Props = {
  resultados: ResultadoBusqueda[];
  vehiculo: string;
  texto: string;
  activo: number;
  enCarrito: Map<number, number>;
  onAgregar: (r: ResultadoBusqueda) => void;
  onActivo: (i: number) => void;
};

const AJUSTE: Record<string, string> = {
  motor: "Motor exacto",
  anio: "Este año",
  modelo: "Todo el modelo",
  marca: "Toda la marca",
  verificar: "Verificar",
  vehiculo: "Le queda",
};

type Bloque = { clave: string; titulo: string; nota?: string; filas: { r: ResultadoBusqueda; i: number }[] };

/** Agrupa en el orden en que llegan: le queda › puede quedarle › generales › complementos. */
function agrupar(resultados: ResultadoBusqueda[], vehiculo: string): Bloque[] {
  const bloques: Bloque[] = [
    { clave: "exacto", titulo: `Le queda a ${vehiculo}`, filas: [] },
    { clave: "verificar", titulo: "Puede quedarle", nota: "Sirve para alguna versión: confirmá año o motor.", filas: [] },
    { clave: "general", titulo: "Productos generales", nota: "Sin vehículo asignado: sirven para cualquiera.", filas: [] },
    { clave: "todos", titulo: "Productos", filas: [] },
    { clave: "complemento", titulo: "Complementos sugeridos", nota: "Lo que se suele llevar junto.", filas: [] },
  ];
  const porClave = new Map(bloques.map((b) => [b.clave, b]));
  resultados.forEach((r, i) => {
    const clave =
      r.grupo === "vehiculo" ? (r.ajuste === "verificar" ? "verificar" : "exacto") : r.grupo === "general" ? "general" : r.grupo;
    porClave.get(clave)?.filas.push({ r, i });
  });
  return bloques.filter((b) => b.filas.length);
}

export const Resultados = memo(function Resultados({ resultados, vehiculo, texto, activo, enCarrito, onAgregar, onActivo }: Props) {
  const bloques = agrupar(resultados, vehiculo);
  let n = 0;
  return (
    <div className={styles.bloques}>
      {bloques.map((b) => (
        <section key={b.clave} className={styles.bloque} data-grupo={b.clave} aria-label={b.titulo}>
          <header className={styles.bloqueCabeza}>
            <h3 className={styles.bloqueTitulo}>{b.titulo}</h3>
            <span className={styles.bloqueCuenta}>{b.filas.length}</span>
            {b.nota && <p className={styles.bloqueNota}>{b.nota}</p>}
          </header>
          <ul className={styles.filas} role="listbox" aria-label={b.titulo}>
            {b.filas.map(({ r, i }) => {
              const final = precioConIsv(r.precio, r.exento);
              const llevados = enCarrito.get(r.id) ?? 0;
              const existencia = r.existencia;
              const nivel =
                !r.controla_inventario ? "servicio" : existencia === null ? (r.disponible ? "ok" : "agotado") : existencia <= 0 ? "agotado" : existencia - llevados <= 0 ? "justo" : "ok";
              const retraso = Math.min(n++, 14) * 22;
              return (
                <li
                  key={`${b.clave}-${r.id}`}
                  role="option"
                  aria-selected={i === activo}
                  className={styles.fila}
                  data-activo={i === activo || undefined}
                  data-indice={i}
                  style={{ animationDelay: `${retraso}ms` }}
                  onPointerEnter={() => onActivo(i)}
                  onClick={() => onAgregar(r)}
                >
                  <span className={styles.foto}>
                    {r.imagen ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={urlImagen(r.imagen)} alt="" loading="lazy" decoding="async" />
                    ) : (
                      <span className={styles.sinFoto} aria-hidden="true" />
                    )}
                  </span>
                  <span className={styles.info}>
                    <span className={styles.nombre}>
                      <Resaltar texto={r.nombre} busqueda={texto} />
                    </span>
                    <span className={styles.meta}>
                      {r.marca && <span className={styles.marca}>{r.marca}</span>}
                      <span>{r.codigo}</span>
                      {r.oem && <span>OEM {r.oem}</span>}
                      <span className={styles.categoria}>{r.categoria}</span>
                      {r.condicion !== "nuevo" && <span className={styles.condicion}>{r.condicion}</span>}
                    </span>
                  </span>
                  {r.ajuste && (
                    <span className={styles.ajuste} data-ajuste={r.ajuste}>
                      {AJUSTE[r.ajuste]}
                    </span>
                  )}
                  <span className={styles.existencia} data-nivel={nivel} title={r.ubicacion ? `Ubicación: ${r.ubicacion}` : undefined}>
                    <span className={styles.led} aria-hidden="true" />
                    {nivel === "servicio" ? "Servicio" : existencia === null ? (r.disponible ? "Disponible" : "Agotado") : cant(existencia)}
                    {r.ubicacion && <small>{r.ubicacion}</small>}
                  </span>
                  <span className={styles.precio}>
                    <strong>{moneda(final)}</strong>
                    <small>{r.exento ? "Exento" : `${moneda(r.precio)} + ISV`}</small>
                  </span>
                  <span className={styles.agregar} aria-hidden="true">
                    {llevados > 0 ? <span className={styles.llevados}>{cant(llevados)}</span> : <IconoMas tamano={16} />}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
});

/** Resalta las palabras buscadas dentro del nombre (sin tildes ni mayúsculas). */
function Resaltar({ texto, busqueda }: { texto: string; busqueda: string }) {
  const normal = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const palabras = normal(busqueda).split(/\s+/).filter((p) => p.length >= 2);
  if (!palabras.length) return <>{texto}</>;
  const base = normal(texto);
  const marcas = new Array<boolean>(texto.length).fill(false);
  for (const p of palabras) {
    let desde = base.indexOf(p);
    while (desde !== -1) {
      for (let k = desde; k < desde + p.length; k++) marcas[k] = true;
      desde = base.indexOf(p, desde + p.length);
    }
  }
  const partes: { t: string; m: boolean }[] = [];
  for (let k = 0; k < texto.length; k++) {
    const ultima = partes[partes.length - 1];
    if (ultima && ultima.m === marcas[k]) ultima.t += texto[k];
    else partes.push({ t: texto[k], m: marcas[k] });
  }
  return (
    <>
      {partes.map((p, k) => (p.m ? <mark key={k}>{p.t}</mark> : <span key={k}>{p.t}</span>))}
    </>
  );
}
