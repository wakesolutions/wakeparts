import { IDENTIDAD_VACIA } from "@/lib/identidad";
import type { Sesion } from "@/lib/sesion";

/** Sesión ficticia para el sandbox de desarrollo (/dev/*). No toca Auth. */
export const SESION_DEMO: Sesion = {
  usuario: {
    id: "00000000-0000-0000-0000-000000000000",
    correo: "demo@wakeparts.test",
    nombre: "Demo Sandbox",
    esAdminPlataforma: true,
  },
  empresa: { id: "demo", nombre: "Yonker Demo", paleta: "rojo-negro", identidad: IDENTIDAD_VACIA },
  rol: "dueno",
  empresas: [{ id: "demo", nombre: "Yonker Demo", rol: "dueno" }],
};

/** Sesión de la demo pública (/demo): una dueña ficticia de un yonker. */
export const SESION_DEMO_PUBLICA: Sesion = {
  usuario: {
    id: "00000000-0000-0000-0000-000000000000",
    correo: "ana@yonkerdemo.hn",
    nombre: "Ana Demo",
    esAdminPlataforma: false,
  },
  empresa: { id: "demo", nombre: "Yonker Demo", paleta: "rojo-negro", identidad: IDENTIDAD_VACIA },
  rol: "dueno",
  empresas: [{ id: "demo", nombre: "Yonker Demo", rol: "dueno" }],
  demo: true,
};
