"use client";

import type { DefModulo } from "@/components/ventanas/contexto";
import { veModulo } from "@/lib/permisos";
import type { Sesion } from "@/lib/sesion";
import {
  IconoActividad,
  IconoCaja,
  IconoCompras,
  IconoContabilidad,
  IconoEquipo,
  IconoInicio,
  IconoInventario,
  IconoLlave,
  IconoMostrador,
  IconoNotas,
  IconoPerfil,
  IconoPlanes,
  IconoSeguimiento,
  IconoSitio,
  IconoTaller,
  IconoToma,
  IconoVentas,
} from "./iconos-modulos";
import { ModuloActividad } from "./actividad";
import { ModuloCaja } from "./caja";
import { ModuloCompras } from "./compras";
import { ModuloContabilidad } from "./contabilidad";
import { ModuloCotizar } from "./cotizar";
import { ModuloInventario } from "./inventario";
import { ModuloMiUsuario } from "./mi-usuario";
import { ModuloNotas } from "./notas";
import { ModuloPlanes } from "./planes";
import { ModuloSeguimiento } from "./seguimiento";
import { ModuloSitioWeb } from "./sitio-web";
import { ModuloMantenimiento, ModuloUsuarios } from "./tablas";
import { ModuloTaller } from "./taller";
import { TomaRapida } from "@/components/inventario/toma-rapida";
import { ModuloVentas } from "./ventas";

export type ModuloEscritorio = DefModulo & {
  /** Si existe y devuelve false, el módulo no aparece para esa sesión. */
  visible?: (sesion: Sesion) => boolean;
};

/** Plan de la empresa + permisos del rol (0023; sin la migración, lo de siempre por rol). */
const ve = (id: string) => (s: Sesion) => veModulo(s, id);

/**
 * Módulos del escritorio, en el orden del dock.
 * Un módulo nuevo = un componente + una entrada aquí.
 */
export const MODULOS: ModuloEscritorio[] = [
  { id: "inicio", nombre: "Inicio", icono: <IconoInicio /> },
  {
    id: "cotizar",
    nombre: "Cotizar y facturar",
    icono: <IconoMostrador />,
    componente: ModuloCotizar,
    tamano: { w: 1320, h: 800 },
    visible: ve("cotizar"),
  },
  {
    id: "caja",
    nombre: "Caja",
    icono: <IconoCaja />,
    componente: ModuloCaja,
    tamano: { w: 1180, h: 780 },
    visible: ve("caja"),
  },
  {
    id: "inventario",
    nombre: "Inventario",
    icono: <IconoInventario />,
    componente: ModuloInventario,
    tamano: { w: 1240, h: 760 },
    visible: ve("inventario"),
  },
  {
    // Facturas de proveedores, gastos y cuentas por pagar (0021). Solo dueño/admin.
    id: "compras",
    nombre: "Compras",
    icono: <IconoCompras />,
    componente: ModuloCompras,
    tamano: { w: 1240, h: 800 },
    visible: ve("compras"),
  },
  {
    // Alta de productos desde el teléfono (foto + lo mínimo), para cargar el inventario inicial.
    id: "toma",
    nombre: "Toma rápida",
    icono: <IconoToma />,
    componente: TomaRapida,
    tamano: { w: 980, h: 760 },
    visible: ve("toma"),
  },
  {
    id: "ventas",
    nombre: "Ventas",
    icono: <IconoVentas />,
    componente: ModuloVentas,
    tamano: { w: 1180, h: 720 },
    visible: ve("ventas"),
  },
  {
    // Notas de crédito y débito, con o sin factura (0019). Solo las emiten dueño/admin.
    id: "notas",
    nombre: "Notas",
    icono: <IconoNotas />,
    componente: ModuloNotas,
    tamano: { w: 1120, h: 800 },
    visible: ve("notas"),
  },
  {
    // Libro diario, asientos, balanza, mayor, catálogo y cierre de mes (0022). Solo dueño/admin.
    id: "contabilidad",
    nombre: "Contabilidad",
    icono: <IconoContabilidad />,
    componente: ModuloContabilidad,
    tamano: { w: 1240, h: 820 },
    visible: ve("contabilidad"),
  },
  {
    id: "sitio",
    nombre: "Sitio web",
    icono: <IconoSitio />,
    componente: ModuloSitioWeb,
    tamano: { w: 1100, h: 780 },
    visible: ve("sitio"),
  },
  {
    id: "mantenimiento",
    nombre: "Mantenimiento",
    icono: <IconoLlave />,
    componente: ModuloMantenimiento,
    tamano: { w: 1180, h: 720 },
    visible: ve("mantenimiento"),
  },
  {
    id: "usuarios",
    nombre: "Usuarios",
    icono: <IconoEquipo />,
    componente: ModuloUsuarios,
    tamano: { w: 1040, h: 640 },
    visible: ve("usuarios"),
  },
  {
    id: "actividad",
    nombre: "Actividad",
    icono: <IconoActividad />,
    componente: ModuloActividad,
    tamano: { w: 1240, h: 740 },
    visible: (s) => veModulo(s, "actividad") || s.usuario.esAdminPlataforma,
  },
  {
    id: "seguimiento",
    nombre: "Seguimiento",
    icono: <IconoSeguimiento />,
    componente: ModuloSeguimiento,
    tamano: { w: 1240, h: 740 },
    visible: (s) => s.usuario.esAdminPlataforma,
  },
  {
    // Planes, límites y permisos por rol (0023). Solo admin de plataforma.
    id: "planes",
    nombre: "Planes",
    icono: <IconoPlanes />,
    componente: ModuloPlanes,
    tamano: { w: 1180, h: 780 },
    visible: (s) => s.usuario.esAdminPlataforma,
  },
  {
    id: "taller",
    nombre: "Taller",
    icono: <IconoTaller />,
    componente: ModuloTaller,
    tamano: { w: 1100, h: 780 },
    visible: ve("taller"),
  },
  {
    // Se abre desde el nombre en la barra de menú.
    id: "mi-usuario",
    nombre: "Mi usuario",
    icono: <IconoPerfil />,
    componente: ModuloMiUsuario,
    tamano: { w: 720, h: 680 },
    enDock: false,
  },
];
