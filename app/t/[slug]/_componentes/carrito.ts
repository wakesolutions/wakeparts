"use client";

import { useSyncExternalStore } from "react";
import type { ProductoWeb } from "@/lib/sitio-web";

/**
 * Lista de piezas del visitante, por taller, en localStorage
 * (`wp:carrito-web:<slug>`). No es una cookie y no viaja al servidor hasta
 * que el visitante manda el pedido. Declarado en /cookies.
 */

export type LineaCarrito = Pick<ProductoWeb, "id" | "codigo" | "nombre" | "marca" | "precio" | "exento" | "imagen"> & {
  cantidad: number;
};

export type VehiculoCarrito = {
  texto: string;
  id_marca?: number;
  id_modelo?: number;
  id_modelo_anio?: number;
  id_especificacion?: number;
};

type Estado = { lineas: LineaCarrito[]; vehiculo: VehiculoCarrito | null };

const VACIO: Estado = { lineas: [], vehiculo: null };
const MAX_LINEAS = 40;
const cache = new Map<string, { crudo: string | null; estado: Estado }>();
const oyentes = new Set<() => void>();

const clave = (slug: string) => `wp:carrito-web:${slug}`;

function leer(slug: string): Estado {
  let crudo: string | null = null;
  try {
    crudo = localStorage.getItem(clave(slug));
  } catch {
    // Navegación privada o almacenamiento bloqueado: la lista vive solo en esta pestaña.
  }
  const previo = cache.get(slug);
  if (previo && previo.crudo === crudo) return previo.estado;
  let estado = VACIO;
  try {
    const d = crudo ? (JSON.parse(crudo) as Partial<Estado>) : null;
    if (d) estado = { lineas: Array.isArray(d.lineas) ? d.lineas.slice(0, MAX_LINEAS) : [], vehiculo: d.vehiculo ?? null };
  } catch {
    estado = VACIO;
  }
  cache.set(slug, { crudo, estado });
  return estado;
}

function escribir(slug: string, estado: Estado) {
  const crudo = JSON.stringify(estado);
  try {
    localStorage.setItem(clave(slug), crudo);
  } catch {
    // Sin almacenamiento: queda en memoria.
  }
  cache.set(slug, { crudo, estado });
  oyentes.forEach((o) => o());
}

function suscribir(avisar: () => void) {
  oyentes.add(avisar);
  const otraPestana = (e: StorageEvent) => e.key?.startsWith("wp:carrito-web:") && avisar();
  window.addEventListener("storage", otraPestana);
  return () => {
    oyentes.delete(avisar);
    window.removeEventListener("storage", otraPestana);
  };
}

export function useCarrito(slug: string) {
  const estado = useSyncExternalStore(
    suscribir,
    () => leer(slug),
    () => VACIO,
  );
  const unidades = estado.lineas.reduce((s, l) => s + l.cantidad, 0);

  return {
    ...estado,
    unidades,
    agregar(p: Omit<LineaCarrito, "cantidad">, cantidad = 1) {
      const actual = leer(slug);
      const existe = actual.lineas.find((l) => l.id === p.id);
      const lineas = existe
        ? actual.lineas.map((l) => (l.id === p.id ? { ...l, cantidad: Math.min(999, l.cantidad + cantidad) } : l))
        : [...actual.lineas, { ...p, cantidad }].slice(0, MAX_LINEAS);
      escribir(slug, { ...actual, lineas });
    },
    cambiar(id: number, cantidad: number) {
      const actual = leer(slug);
      const lineas =
        cantidad <= 0
          ? actual.lineas.filter((l) => l.id !== id)
          : actual.lineas.map((l) => (l.id === id ? { ...l, cantidad: Math.min(999, Math.round(cantidad)) } : l));
      escribir(slug, { ...actual, lineas });
    },
    recordarVehiculo(vehiculo: VehiculoCarrito | null) {
      escribir(slug, { ...leer(slug), vehiculo });
    },
    vaciar() {
      escribir(slug, { lineas: [], vehiculo: leer(slug).vehiculo });
    },
  };
}
