"use client";

import type { DefModulo } from "@/components/ventanas/contexto";
import type { Sesion } from "@/lib/sesion";
import {
  IconoActividad,
  IconoEquipo,
  IconoInicio,
  IconoInventario,
  IconoLlave,
  IconoMostrador,
  IconoPerfil,
  IconoSeguimiento,
  IconoSitio,
  IconoTaller,
  IconoVentas,
} from "./iconos-modulos";
import { ModuloActividad } from "./actividad";
import { ModuloCotizar } from "./cotizar";
import { ModuloInventario } from "./inventario";
import { ModuloMiUsuario } from "./mi-usuario";
import { ModuloSeguimiento } from "./seguimiento";
import { ModuloSitioWeb } from "./sitio-web";
import { ModuloMantenimiento, ModuloUsuarios } from "./tablas";
import { ModuloTaller } from "./taller";
import { ModuloVentas } from "./ventas";

export type ModuloEscritorio = DefModulo & {
  /** Si existe y devuelve false, el módulo no aparece para esa sesión. */
  visible?: (sesion: Sesion) => boolean;
};

const administra = (s: Sesion) => s.rol === "dueno" || s.rol === "admin";

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
  },
  {
    id: "inventario",
    nombre: "Inventario",
    icono: <IconoInventario />,
    componente: ModuloInventario,
    tamano: { w: 1240, h: 760 },
  },
  {
    id: "ventas",
    nombre: "Ventas",
    icono: <IconoVentas />,
    componente: ModuloVentas,
    tamano: { w: 1180, h: 720 },
  },
  {
    id: "sitio",
    nombre: "Sitio web",
    icono: <IconoSitio />,
    componente: ModuloSitioWeb,
    tamano: { w: 1100, h: 780 },
    visible: administra,
  },
  {
    id: "mantenimiento",
    nombre: "Mantenimiento",
    icono: <IconoLlave />,
    componente: ModuloMantenimiento,
    tamano: { w: 1180, h: 720 },
  },
  {
    id: "usuarios",
    nombre: "Usuarios",
    icono: <IconoEquipo />,
    componente: ModuloUsuarios,
    tamano: { w: 1040, h: 640 },
    visible: administra,
  },
  {
    id: "actividad",
    nombre: "Actividad",
    icono: <IconoActividad />,
    componente: ModuloActividad,
    tamano: { w: 1240, h: 740 },
    visible: (s) => administra(s) || s.usuario.esAdminPlataforma,
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
    id: "taller",
    nombre: "Taller",
    icono: <IconoTaller />,
    componente: ModuloTaller,
    tamano: { w: 1100, h: 780 },
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
