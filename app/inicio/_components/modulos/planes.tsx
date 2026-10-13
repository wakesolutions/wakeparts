"use client";

import { AdministradoresPlataforma, EmpresasPlanes, PermisosRoles, PlanesLimites } from "@/components/planes/planes";
import { ModuloTablas } from "./tablas";

/** Planes, límites y permisos por rol (0023). Solo admin de plataforma; los talleres no lo ven. */
export function ModuloPlanes() {
  return (
    <ModuloTablas
      id="planes"
      inicial="planes"
      secciones={[
        {
          titulo: "Planes",
          nota: "Solo administradores de Wake Parts",
          items: [
            {
              id: "planes",
              titulo: "Planes y límites",
              descripcion: "Qué módulos incluye cada plan y cuánto se puede crear. Vacío = sin límite.",
              contenido: () => <PlanesLimites />,
            },
            {
              id: "empresas",
              titulo: "Empresas",
              descripcion: "Plan de cada empresa y su consumo de este mes. El taller no ve el nombre de su plan.",
              contenido: () => <EmpresasPlanes />,
            },
          ],
        },
        {
          titulo: "Permisos",
          items: [
            {
              id: "roles",
              titulo: "Roles",
              descripcion: "Qué ve cada rol dentro de su plan. El dueño siempre tiene todo.",
              contenido: () => <PermisosRoles />,
            },
            {
              id: "admins",
              titulo: "Administradores",
              descripcion: "Quiénes pueden configurar planes, permisos y el catálogo global.",
              contenido: () => <AdministradoresPlataforma />,
            },
          ],
        },
      ]}
    />
  );
}
