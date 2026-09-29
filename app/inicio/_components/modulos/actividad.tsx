"use client";

import { useState } from "react";
import { MantenimientoRecurso } from "@/components/mantenimiento/mantenimiento-recurso";
import { useVentanaActual } from "@/components/ventanas/ventana";
import { VentanaFlotante } from "@/components/ventanas/ventana-flotante";
import { fechaHoraExacta } from "@/lib/formato";
import { TIPOS_REGISTRO } from "@/lib/recursos/registro";
import { ModuloTablas } from "./tablas";
import styles from "./modulos.module.css";
import a from "./actividad.module.css";

type Fila = Record<string, unknown>;

/** Registro de actividad: sesiones, cambios, errores y visitas (0011). */
export function ModuloActividad() {
  return (
    <ModuloTablas
      id="actividad"
      inicial="actividad"
      secciones={[
        {
          titulo: "Tu empresa",
          nota: "Solo lectura. Nadie puede editar ni borrar el registro.",
          items: [
            {
              recurso: "actividad",
              descripcion:
                "Quién entró, desde dónde y qué cambió: productos, precios, clientes, facturas, CAI y usuarios. Abrí una fila para ver el antes y el después.",
              contenido: () => <TablaActividad recurso="actividad" />,
              visible: (s) => s.rol === "dueno" || s.rol === "admin",
            },
          ],
        },
        {
          titulo: "Plataforma",
          nota: "Solo el administrador de Wake Parts.",
          items: [
            {
              recurso: "actividad_plataforma",
              descripcion:
                "Todo: visitas a cada página (también de quien no inició sesión), inicios de sesión, errores del servidor y del navegador, y cambios de todas las empresas.",
              contenido: () => <TablaActividad recurso="actividad_plataforma" />,
              visible: (s) => s.usuario.esAdminPlataforma,
            },
          ],
        },
      ]}
    />
  );
}

function TablaActividad({ recurso }: { recurso: string }) {
  const [abierto, setAbierto] = useState<Fila | null>(null);
  const madre = useVentanaActual() ?? undefined;
  return (
    <>
      <MantenimientoRecurso recurso={recurso} puedeEditar={false} onAbrir={(f) => setAbierto(f)} />
      {abierto && (
        <VentanaFlotante
          id="registro"
          titulo={`Registro N.º ${abierto.id}`}
          padre={madre}
          tamano={{ w: 860, h: 700 }}
          foco={String(abierto.id)}
          onCerrar={() => setAbierto(null)}
        >
          <DetalleRegistro key={String(abierto.id)} fila={abierto} />
        </VentanaFlotante>
      )}
    </>
  );
}

const ACCIONES: Record<string, string> = { crear: "Creó", editar: "Editó", eliminar: "Eliminó" };

const EVENTOS: Record<string, string> = {
  "pagina.vista": "Visitó una página",
  "sesion.inicio": "Inició sesión",
  "sesion.cierre": "Cerró sesión",
  "sesion.fallo": "Falló el inicio de sesión",
  "error.navegador": "Error en el navegador",
};

/** «productos.editar» → «Editó · productos»; «error.servidor.action» → «Error del servidor». */
export function describirEvento(evento: string) {
  if (EVENTOS[evento]) return EVENTOS[evento];
  if (evento.startsWith("error.servidor")) return "Error del servidor";
  const [tabla, accion] = evento.split(".");
  if (accion && ACCIONES[accion]) return `${ACCIONES[accion]} · ${tabla.replace(/_/g, " ")}`;
  return evento;
}

const texto = (v: unknown) =>
  v === null || v === undefined || v === "" ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v);

function DetalleRegistro({ fila }: { fila: Fila }) {
  const datos = (fila.datos ?? null) as Record<string, unknown> | null;
  const cambios = datos?.cambios as Record<string, { antes: unknown; despues: unknown }> | undefined;
  const valores = (datos?.nuevo ?? datos?.anterior) as Record<string, unknown> | undefined;
  const pila = typeof datos?.pila === "string" ? datos.pila : null;
  const resto = datos
    ? Object.fromEntries(Object.entries(datos).filter(([k]) => !["cambios", "nuevo", "anterior", "pila"].includes(k)))
    : {};
  const tipo = TIPOS_REGISTRO.find((t) => t.valor === fila.tipo)?.etiqueta ?? String(fila.tipo);

  const ficha: [string, unknown][] = [
    ["Fecha y hora", fila.creado_en ? fechaHoraExacta(String(fila.creado_en)) : null],
    ["Usuario", fila.usuario ?? "Visitante"],
    ["Correo", fila.correo],
    ["Empresa", fila.empresa],
    ["IP", fila.ip],
    ["Dispositivo", fila.dispositivo],
    ["Ubicación", fila.ubicacion],
    ["Página", fila.ruta],
    ["Vino de", fila.referente],
    ["Entorno", fila.entorno],
  ];

  return (
    <div className={styles.hojaModulo}>
      <section className={styles.ficha} data-nivel={String(fila.nivel)}>
        <p className={styles.fichaEtiqueta}>
          {tipo} · {String(fila.evento)}
        </p>
        <h3 className={styles.fichaTitulo}>{describirEvento(String(fila.evento))}</h3>
        {typeof fila.mensaje === "string" && fila.mensaje && <p className={a.mensaje}>{fila.mensaje}</p>}
        <dl className={styles.fichaDatos}>
          {ficha
            .filter(([, v]) => v !== null && v !== undefined && v !== "")
            .map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{texto(v)}</dd>
              </div>
            ))}
        </dl>
      </section>

      <div className={styles.fichaCuerpo}>
        {cambios && (
          <Bloque titulo="Qué cambió">
            <table className={a.tabla}>
              <thead>
                <tr>
                  <th scope="col">Campo</th>
                  <th scope="col">Antes</th>
                  <th scope="col">Después</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(cambios).map(([campo, c]) => (
                  <tr key={campo}>
                    <th scope="row">{campo}</th>
                    <td data-lado="antes">{texto(c.antes)}</td>
                    <td data-lado="despues">{texto(c.despues)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Bloque>
        )}

        {valores && (
          <Bloque titulo={datos?.nuevo ? "Datos creados" : "Datos eliminados"}>
            <table className={a.tabla}>
              <tbody>
                {Object.entries(valores).map(([campo, v]) => (
                  <tr key={campo}>
                    <th scope="row">{campo}</th>
                    <td>{texto(v)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Bloque>
        )}

        {Object.keys(resto).length > 0 && (
          <Bloque titulo="Más datos">
            <pre className={a.codigo}>{JSON.stringify(resto, null, 2)}</pre>
          </Bloque>
        )}

        {pila && (
          <Bloque titulo="Pila del error">
            <pre className={a.codigo}>{pila}</pre>
          </Bloque>
        )}

        {typeof fila.agente === "string" && fila.agente && (
          <Bloque titulo="Navegador (user agent)">
            <pre className={a.codigo}>{fila.agente}</pre>
          </Bloque>
        )}
      </div>
    </div>
  );
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className={a.bloque}>
      <h4 className={styles.fichaEtiqueta}>{titulo}</h4>
      {children}
    </section>
  );
}
