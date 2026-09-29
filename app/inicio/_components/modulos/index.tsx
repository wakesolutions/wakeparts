"use client";

import type { DefModulo } from "@/components/ventanas/contexto";
import type { Sesion } from "@/lib/sesion";
import { IconoEquipo, IconoInicio, IconoInventario, IconoLlave, IconoMostrador, IconoPerfil, IconoTaller, IconoVentas } from "./iconos-modulos";
import { ModuloCotizar } from "./cotizar";
import { ModuloInventario } from "./inventario";
import { ModuloMiUsuario } from "./mi-usuario";
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
    id: "taller",
    nombre: "Taller",
    icono: <IconoTaller />,
    componente: ModuloTaller,
    tamano: { w: 820, h: 720 },
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
