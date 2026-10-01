"use client";

import { useEffect, useState } from "react";
import { useApi } from "@/components/datos/apis";
import { MantenimientoRecurso } from "@/components/mantenimiento/mantenimiento-recurso";
import ui from "@/components/ui/controles.module.css";
import { IconoCarrito } from "@/components/ui/iconos";
import { useVentanaActual } from "@/components/ventanas/ventana";
import { useVentanas } from "@/components/ventanas/contexto";
import { VentanaFlotante } from "@/components/ventanas/ventana-flotante";
import { abrirCarritoEnMostrador } from "@/components/ventas/mostrador";
import { cant, fechaYHora, moneda, monto } from "@/lib/formato";
import { enlaceWhatsapp, precioConIsv } from "@/lib/sitio-web";
import type { PedidoWeb } from "./api";
import styles from "./sitio-web.module.css";

/** Ventas › Pedidos web: lo que mandan los clientes desde el sitio público. */
export function PedidosWeb() {
  const [abierto, setAbierto] = useState<{ id: string; numero: string } | null>(null);
  const [version, setVersion] = useState(0);
  const madre = useVentanaActual() ?? undefined;
  return (
    <>
      <MantenimientoRecurso
        recurso="pedidos_web"
        puedeEditar={false}
        version={version}
        onAbrir={(f) => setAbierto({ id: String(f.id), numero: String(f.numero) })}
      />
      {abierto && (
        <VentanaFlotante
          id="pedido-web"
          titulo={`Pedido web #${abierto.numero}`}
          padre={madre}
          tamano={{ w: 760, h: 640 }}
          foco={abierto.id}
          onCerrar={() => setAbierto(null)}
        >
          <DetallePedido key={abierto.id} id={abierto.id} onCambio={() => setVersion((v) => v + 1)} />
        </VentanaFlotante>
      )}
    </>
  );
}

const ESTADO: Record<PedidoWeb["estado"], string> = { nuevo: "Nuevo", atendido: "Atendido", descartado: "Descartado" };

function DetallePedido({ id, onCambio }: { id: string; onCambio: () => void }) {
  const api = useApi("sitioWeb");
  const { abrir } = useVentanas();
  const [pedido, setPedido] = useState<PedidoWeb | null | undefined>(undefined);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    api
      .pedido(id)
      .then((p) => vivo && setPedido(p))
      .catch(() => vivo && setPedido(null));
    return () => {
      vivo = false;
    };
  }, [api, id]);

  if (pedido === undefined) return <div className={styles.pedido} aria-label="Cargando" />;
  if (!pedido) return <p className={`${styles.pedido} ${styles.aviso}`}>No se encontró el pedido.</p>;

  async function atender() {
    setOcupado(true);
    const r = await api.atender(id).catch(() => ({ ok: false as const, error: "Sin conexión." }));
    setOcupado(false);
    if (!r.ok) return setAviso(r.error);
    onCambio();
    abrirCarritoEnMostrador(r.carrito);
    abrir("cotizar");
  }

  async function estado(e: "nuevo" | "descartado") {
    setOcupado(true);
    const r = await api.cambiarEstado(id, e).catch(() => ({ ok: false as const, error: "Sin conexión." }));
    setOcupado(false);
    if (!r.ok) return setAviso(r.error);
    setPedido({ ...pedido!, estado: e });
    onCambio();
  }

  const wa = enlaceWhatsapp(
    pedido.cliente_telefono,
    `Hola ${pedido.cliente_nombre.split(" ")[0]}, le escribimos por su pedido web #${pedido.numero}.`,
  );

  return (
    <div className={styles.pedido}>
      <div className={styles.pedidoCabecera}>
        <div>
          <p className={styles.pedidoNumero}>
            Pedido web #{pedido.numero} · {fechaYHora(pedido.creado_en)}
          </p>
          <p className={styles.pedidoCliente}>{pedido.cliente_nombre}</p>
          <p className={styles.pedidoDatos}>
            <a href={`tel:${pedido.cliente_telefono}`}>Tel. {pedido.cliente_telefono}</a>
            {wa && (
              <a href={wa} target="_blank" rel="noopener noreferrer">
                WhatsApp ↗
              </a>
            )}
            {pedido.cliente_correo && <a href={`mailto:${pedido.cliente_correo}`}>{pedido.cliente_correo}</a>}
            {pedido.vehiculo && <span>Vehículo: {pedido.vehiculo}</span>}
          </p>
        </div>
        <span className={styles.estadoPedido} data-estado={pedido.estado}>
          {ESTADO[pedido.estado]}
          {pedido.atendido_por && ` · ${pedido.atendido_por}`}
        </span>
      </div>

      {pedido.mensaje && <p className={styles.mensaje}>{pedido.mensaje}</p>}

      <table className={styles.tabla}>
        <thead>
          <tr>
            <th scope="col" data-num="">
              Cant.
            </th>
            <th scope="col">Pieza</th>
            <th scope="col" data-num="">
              Precio c/ISV
            </th>
          </tr>
        </thead>
        <tbody>
          {pedido.lineas.map((l) => (
            <tr key={l.id}>
              <td data-num="">{cant(l.cantidad)}</td>
              <td>
                {l.descripcion}
                {l.codigo && <small>{l.codigo}</small>}
              </td>
              <td data-num="">{monto(precioConIsv(l.precio, l.exento) * l.cantidad)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className={styles.pie}>
        <span className={styles.nota}>
          Estimado: <strong>{moneda(pedido.total_estimado)}</strong>. Al atenderlo se usa el precio de hoy y podés ajustar todo
          en el mostrador antes de cotizar o facturar.
        </span>
        <div className="flex flex-wrap gap-2">
          {pedido.estado === "nuevo" && (
            <button type="button" className={`${ui.boton} ${ui.fantasma}`} disabled={ocupado} onClick={() => estado("descartado")}>
              Descartar
            </button>
          )}
          {pedido.estado === "descartado" && (
            <button type="button" className={`${ui.boton} ${ui.fantasma}`} disabled={ocupado} onClick={() => estado("nuevo")}>
              Recuperar
            </button>
          )}
          {pedido.estado !== "descartado" && (
            <button type="button" className={`${ui.boton} ${ui.primario}`} disabled={ocupado} onClick={atender}>
              <IconoCarrito tamano={14} /> {pedido.estado === "atendido" ? "Abrir en el mostrador" : "Atender en el mostrador"}
            </button>
          )}
        </div>
      </div>
      {aviso && (
        <p className={styles.aviso} role="alert">
          {aviso}
        </p>
      )}
    </div>
  );
}
