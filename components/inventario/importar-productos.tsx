"use client";

import { useRef, useState, type DragEvent } from "react";
import { useApi } from "@/components/datos/apis";
import ui from "@/components/ui/controles.module.css";
import { IconoDocumento } from "@/components/ui/iconos";
import {
  COLUMNAS_IMPORTACION,
  construirFilas,
  mapearEncabezados,
  type CampoImportacion,
  type FilaImportacion,
  type ResultadoImportacion,
} from "@/lib/inventario";
import styles from "./inventario.module.css";

const LOTE = 400;

type Archivo = {
  nombre: string;
  encabezados: string[];
  mapa: (CampoImportacion | null)[];
  filas: FilaImportacion[];
  crudas: unknown[][];
};

type Etapa = "elegir" | "revisar" | "revisado" | "importando" | "listo";

const sumar = (a: ResultadoImportacion, b: ResultadoImportacion): ResultadoImportacion => ({
  creados: a.creados + b.creados,
  actualizados: a.actualizados + b.actualizados,
  saltados: a.saltados + b.saltados,
  marcas_nuevas: [...new Set([...a.marcas_nuevas, ...b.marcas_nuevas])],
  errores: [...a.errores, ...b.errores],
  probado: b.probado,
});
const CERO: ResultadoImportacion = { creados: 0, actualizados: 0, saltados: 0, marcas_nuevas: [], errores: [], probado: true };

/** CSV con comas o punto y coma, comillas y saltos de línea dentro de comillas. */
function leerCsv(texto: string): unknown[][] {
  const limpio = texto.replace(/^﻿/, "");
  const primera = limpio.split(/\r?\n/, 1)[0] ?? "";
  const sep = (primera.match(/;/g)?.length ?? 0) > (primera.match(/,/g)?.length ?? 0) ? ";" : ",";
  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = "";
  let comillas = false;
  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i];
    if (comillas) {
      if (c === '"' && limpio[i + 1] === '"') {
        celda += '"';
        i++;
      } else if (c === '"') comillas = false;
      else celda += c;
    } else if (c === '"') comillas = true;
    else if (c === sep) {
      fila.push(celda);
      celda = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && limpio[i + 1] === "\n") i++;
      fila.push(celda);
      filas.push(fila);
      fila = [];
      celda = "";
    } else celda += c;
  }
  if (celda !== "" || fila.length) {
    fila.push(celda);
    filas.push(fila);
  }
  return filas;
}

async function leerArchivo(archivo: File): Promise<unknown[][]> {
  if (/\.csv$|\.txt$/i.test(archivo.name)) return leerCsv(await archivo.text());
  const { readSheet } = await import("read-excel-file/browser");
  return (await readSheet(archivo)) as unknown[][];
}

/** Plantilla .xlsx con los encabezados que se reconocen y dos filas de ejemplo. */
async function descargarPlantilla() {
  const { default: escribir } = await import("write-excel-file/browser");
  const encabezados = COLUMNAS_IMPORTACION.map((c) => ({ value: c.titulo, fontWeight: "bold" as const, backgroundColor: "#efebe4" }));
  const ejemplo = COLUMNAS_IMPORTACION.map((c) => c.ejemplo);
  const ejemplo2 = COLUMNAS_IMPORTACION.map((c) =>
    ({ codigo: "AC-2101", nombre: "Aceite 20W50 mineral galón", categoria: "Aceite de motor", marca: "CASTROL", unidad: "galón", costo: 520, precio: 780, existencia: 24, existencia_minima: 8, ubicacion: "I1", condicion: "nuevo", exento: "no" } as Record<string, string | number>)[c.campo] ?? "",
  );
  await escribir([encabezados, ejemplo, ejemplo2], {
    sheet: "Productos",
    columns: COLUMNAS_IMPORTACION.map((c) => ({ width: c.campo === "nombre" ? 36 : c.campo === "categoria" ? 24 : 14 })),
    stickyRowsCount: 1,
  }).toFile("plantilla-productos-wake-parts.xlsx");
}

/** Importa productos desde un Excel o CSV: revisa primero (sin guardar) y después importa. */
export function ImportarProductos({ onListo }: { onListo?: () => void }) {
  const api = useApi("inventario");
  const [archivo, setArchivo] = useState<Archivo | null>(null);
  const [etapa, setEtapa] = useState<Etapa>("elegir");
  const [actualizar, setActualizar] = useState(true);
  const [resultado, setResultado] = useState<ResultadoImportacion | null>(null);
  const [progreso, setProgreso] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [encima, setEncima] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);

  async function elegir(f: File | undefined) {
    if (!f) return;
    setError(null);
    setResultado(null);
    if (!/\.(xlsx|csv|txt)$/i.test(f.name)) return setError("Usá un archivo de Excel (.xlsx) o CSV. Si es .xls viejo, guardalo como .xlsx.");
    try {
      const todas = (await leerArchivo(f)).filter((r) => r.some((c) => c !== null && c !== undefined && String(c).trim() !== ""));
      if (todas.length < 2) return setError("El archivo no tiene filas debajo de los encabezados.");
      const encabezados = todas[0].map((c) => String(c ?? ""));
      const mapa = mapearEncabezados(encabezados);
      if (!mapa.includes("nombre") && !mapa.includes("codigo")) {
        return setError("No encontramos una columna «Nombre» ni «Código». Revisá la primera fila o usá la plantilla.");
      }
      const crudas = todas.slice(1);
      const filas = construirFilas(crudas, mapa);
      if (filas.length > 5000) return setError("Máximo 5000 productos por archivo. Dividilo en partes.");
      setArchivo({ nombre: f.name, encabezados, mapa, filas, crudas });
      setEtapa("revisar");
    } catch {
      setError("No se pudo leer el archivo. ¿Está protegido o dañado?");
    }
  }

  async function enviar(probar: boolean) {
    if (!archivo) return;
    setError(null);
    setEtapa(probar ? "revisar" : "importando");
    setProgreso(0);
    let total = CERO;
    for (let i = 0; i < archivo.filas.length; i += LOTE) {
      const r = await api
        .importar(archivo.filas.slice(i, i + LOTE), actualizar, probar)
        .catch(() => ({ ok: false as const, error: "Sin conexión. Intentá de nuevo." }));
      if (!r.ok) {
        setError(i > 0 && !probar ? `${r.error} Se alcanzaron a importar ${total.creados + total.actualizados} productos.` : r.error);
        setResultado(i > 0 ? total : null);
        setEtapa(probar ? "revisar" : "revisado");
        return;
      }
      total = sumar(total, r.resultado);
      setProgreso(Math.min(1, (i + LOTE) / archivo.filas.length));
    }
    setResultado(total);
    setEtapa(probar ? "revisado" : "listo");
    if (!probar) onListo?.();
  }

  function soltar(e: DragEvent) {
    e.preventDefault();
    setEncima(false);
    void elegir(e.dataTransfer.files[0]);
  }

  function reiniciar() {
    setArchivo(null);
    setResultado(null);
    setEtapa("elegir");
    setError(null);
  }

  const buenas = resultado ? resultado.creados + resultado.actualizados : 0;
  const reconocidas = archivo ? archivo.mapa.filter(Boolean).length : 0;

  return (
    <div className={styles.hoja}>
      {etapa === "elegir" || !archivo ? (
        <>
          <button
            type="button"
            className={styles.zona}
            data-encima={encima || undefined}
            onClick={() => entrada.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setEncima(true);
            }}
            onDragLeave={() => setEncima(false)}
            onDrop={soltar}
          >
            <span className={styles.zonaIcono}>
              <IconoDocumento tamano={22} />
            </span>
            <strong>Soltá tu Excel aquí</strong>
            <span>o hacé clic para elegirlo · .xlsx o .csv · hasta 5000 productos</span>
            <input
              ref={entrada}
              type="file"
              hidden
              accept=".xlsx,.csv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              onChange={(e) => {
                void elegir(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </button>
          <div className={styles.guia}>
            <div>
              <p className={styles.guiaTitulo}>¿Cómo tiene que venir?</p>
              <ul>
                <li>
                  Primera fila con encabezados: <em>Código, Nombre, Categoría, Marca, Costo, Precio, Existencia…</em>{" "}
                  Reconocemos variantes como «Stock», «SKU» o «Precio de venta».
                </li>
                <li>
                  <strong>Categoría</strong> es obligatoria en productos nuevos: vale el nombre («Pastillas de freno») o
                  como le dicen en mostrador («balatas»).
                </li>
                <li>Las marcas que no existan se crean como marcas propias de tu taller.</li>
                <li>
                  Con <strong>código</strong>, un producto que ya existe se actualiza; sin código, siempre se crea uno nuevo.
                </li>
                <li>Costo y precio van sin ISV.</li>
              </ul>
            </div>
            <button type="button" className={ui.boton} onClick={() => void descargarPlantilla()}>
              Descargar plantilla
            </button>
          </div>
        </>
      ) : (
        <>
          <div className={styles.archivo}>
            <IconoDocumento tamano={18} />
            <div>
              <p className={styles.archivoNombre}>{archivo.nombre}</p>
              <p className={styles.archivoDetalle}>
                {archivo.filas.length} {archivo.filas.length === 1 ? "fila" : "filas"} · {reconocidas} de {archivo.encabezados.length} columnas
                reconocidas
              </p>
            </div>
            <button type="button" className={`${ui.boton} ${ui.fantasma}`} onClick={reiniciar} disabled={etapa === "importando"}>
              Cambiar archivo
            </button>
          </div>

          <ul className={styles.columnas} aria-label="Columnas del archivo">
            {archivo.encabezados.map((e, i) => {
              const campo = archivo.mapa[i];
              const def = COLUMNAS_IMPORTACION.find((c) => c.campo === campo);
              return (
                <li key={i} data-ignorada={!campo || undefined} title={campo ? `Se usa como «${def?.titulo}»` : "No se reconoce: se ignora"}>
                  <span>{e || "(sin nombre)"}</span>
                  {campo && <b>{def?.titulo}</b>}
                </li>
              );
            })}
          </ul>

          <div className={styles.tablaScroll}>
            <table className={styles.vista}>
              <caption>Primeras filas</caption>
              <thead>
                <tr>
                  <th scope="col">Fila</th>
                  {archivo.mapa.map((c, i) => c && <th key={i} scope="col">{COLUMNAS_IMPORTACION.find((x) => x.campo === c)?.titulo}</th>)}
                </tr>
              </thead>
              <tbody>
                {archivo.filas.slice(0, 6).map((f) => (
                  <tr key={f._fila} data-error={resultado?.errores.some((x) => x.fila === f._fila) || undefined}>
                    <td className={styles.numFila}>{f._fila}</td>
                    {archivo.mapa.map((c, i) => c && <td key={i}>{f[c] === undefined || f[c] === null ? "" : String(f[c])}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <label className={styles.opcion}>
            <input
              type="checkbox"
              className={ui.casilla}
              checked={actualizar}
              disabled={etapa === "importando"}
              onChange={(e) => {
                setActualizar(e.target.checked);
                setResultado(null);
                setEtapa("revisar");
              }}
            />
            <span>
              <strong>Actualizar los productos que ya existen</strong> (mismo código). Si lo desmarcás, se saltan.
            </span>
          </label>

          {resultado && (
            <div className={styles.resumen} data-listo={etapa === "listo" || undefined}>
              <p className={styles.resumenTitulo}>
                {etapa === "listo" ? "Importación terminada" : "Revisión: todavía no se guardó nada"}
              </p>
              <dl>
                <div data-tono="ok">
                  <dt>{etapa === "listo" ? "Creados" : "Se crearán"}</dt>
                  <dd>{resultado.creados}</dd>
                </div>
                <div>
                  <dt>{etapa === "listo" ? "Actualizados" : "Se actualizarán"}</dt>
                  <dd>{resultado.actualizados}</dd>
                </div>
                {resultado.saltados > 0 && (
                  <div>
                    <dt>Saltados</dt>
                    <dd>{resultado.saltados}</dd>
                  </div>
                )}
                <div data-tono={resultado.errores.length ? "error" : undefined}>
                  <dt>Con error</dt>
                  <dd>{resultado.errores.length}</dd>
                </div>
              </dl>
              {resultado.marcas_nuevas.length > 0 && (
                <p className={styles.resumenNota}>Marcas nuevas propias: {resultado.marcas_nuevas.join(", ")}.</p>
              )}
              {resultado.errores.length > 0 && (
                <div className={styles.tablaScroll}>
                  <table className={styles.errores}>
                    <caption>{etapa === "listo" ? "Filas que no se importaron" : "Corregí estas filas o se omitirán"}</caption>
                    <tbody>
                      {resultado.errores.slice(0, 200).map((e) => (
                        <tr key={`${e.fila}-${e.mensaje}`}>
                          <th scope="row">Fila {e.fila}</th>
                          <td>{e.mensaje}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {(etapa === "importando" || (etapa === "revisar" && progreso > 0 && progreso < 1)) && (
            <div className={styles.progreso} role="progressbar" aria-valuenow={Math.round(progreso * 100)} aria-valuemin={0} aria-valuemax={100}>
              <span style={{ transform: `scaleX(${progreso})` }} />
            </div>
          )}

          {error && (
            <p className={styles.aviso} data-tono="error" role="alert">
              {error}
            </p>
          )}

          <div className={styles.acciones}>
            {etapa === "listo" ? (
              <button type="button" className={`${ui.boton} ${ui.primario}`} onClick={reiniciar}>
                Importar otro archivo
              </button>
            ) : (
              <>
                <button type="button" className={ui.boton} disabled={etapa === "importando"} onClick={() => void enviar(true)}>
                  {resultado ? "Revisar de nuevo" : "Revisar archivo"}
                </button>
                <button
                  type="button"
                  className={`${ui.boton} ${ui.primario}`}
                  disabled={etapa !== "revisado" || buenas === 0}
                  onClick={() => void enviar(false)}
                  title={etapa !== "revisado" ? "Primero revisá el archivo" : undefined}
                >
                  {etapa === "importando" ? `Importando… ${Math.round(progreso * 100)} %` : `Importar ${buenas || ""} productos`.replace("  ", " ")}
                </button>
              </>
            )}
          </div>
        </>
      )}

      {error && etapa === "elegir" && (
        <p className={styles.aviso} data-tono="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
