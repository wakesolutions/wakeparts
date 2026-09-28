import type { Sesion } from "@/lib/sesion";

/** Sesión ficticia para el sandbox de desarrollo (/dev/*). No toca Auth. */
export const SESION_DEMO: Sesion = {
  usuario: {
    id: "00000000-0000-0000-0000-000000000000",
    correo: "demo@wakeparts.test",
    nombre: "Demo Sandbox",
    esAdminPlataforma: true,
  },
  empresa: { id: "demo", nombre: "Yonker Demo", paleta: "rojo-negro" },
  rol: "dueno",
  empresas: [{ id: "demo", nombre: "Yonker Demo", rol: "dueno" }],
};
