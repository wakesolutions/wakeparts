import type { DefRecurso, Opcion } from "./tipos";

/**
 * Seguimiento de talleres (0015): solo admin de plataforma. Una fila por
 * empresa con qué tanto usa el sistema, para escribirles a mano.
 */

export const ETAPAS: readonly Opcion[] = [
  { valor: "sin_productos", etiqueta: "Sin productos" },
  { valor: "sin_cotizar", etiqueta: "Sin cotizar" },
  { valor: "cotizando", etiqueta: "Cotizando" },
  { valor: "facturando", etiqueta: "Facturando" },
];

const SI_NO: readonly Opcion[] = [
  { valor: "true", etiqueta: "Sí" },
  { valor: "false", etiqueta: "No" },
];

export const seguimiento: DefRecurso = {
  id: "seguimiento",
  nombre: "taller",
  nombrePlural: "Talleres registrados",
  vista: "v_seguimiento_empresas",
  tabla: "seguimiento_contactos",
  clave: "id_empresa",
  ambito: "global",
  escritura: "ninguna",
  acciones: { crear: false, editar: false, eliminar: false },
  titulo: "empresa",
  orden: [{ columna: "registrada_en", dir: "desc" }],
  columnas: [
    { clave: "empresa", etiqueta: "Taller", tipo: "texto", ancho: 220, buscable: true },
    { clave: "registrada_en", etiqueta: "Registro", tipo: "fecha", ancho: 130 },
    {
      clave: "etapa",
      etiqueta: "Etapa",
      tipo: "texto",
      ancho: 140,
      opciones: ETAPAS,
      filtro: { tipo: "opciones", opciones: ETAPAS },
    },
    { clave: "dueno", etiqueta: "Dueño", tipo: "texto", ancho: 180, buscable: true },
    { clave: "telefono", etiqueta: "Teléfono", tipo: "texto", ancho: 130, buscable: true, formato: "codigo" },
    { clave: "correo", etiqueta: "Correo", tipo: "texto", ancho: 220, buscable: true, formato: "codigo" },
    { clave: "productos", etiqueta: "Productos", tipo: "entero", ancho: 110, formato: "miles" },
    { clave: "cotizaciones", etiqueta: "Cotiz.", tipo: "entero", ancho: 90 },
    { clave: "facturas", etiqueta: "Fact.", tipo: "entero", ancho: 90 },
    { clave: "dias_sin_entrar", etiqueta: "Sin entrar", tipo: "entero", ancho: 110, vacio: "Nunca" },
    { clave: "contactado_en", etiqueta: "Contactado", tipo: "fecha", ancho: 130, vacio: "—" },
    { clave: "nota", etiqueta: "Nota", tipo: "texto", ancho: 240, buscable: true, oculta: true },
    { clave: "miembros", etiqueta: "Usuarios", tipo: "entero", ancho: 100, oculta: true },
    { clave: "sitio_publicado", etiqueta: "Sitio web", tipo: "booleano", ancho: 110, opciones: SI_NO, oculta: true },
    { clave: "pedidos_web", etiqueta: "Pedidos web", tipo: "entero", ancho: 120, oculta: true },
    { clave: "ultimo_documento", etiqueta: "Último documento", tipo: "fecha", ancho: 150, oculta: true },
    { clave: "dias_registrada", etiqueta: "Días registrada", tipo: "entero", ancho: 130, oculta: true },
    { clave: "telefono_empresa", etiqueta: "Tel. del taller", tipo: "texto", ancho: 130, oculta: true, formato: "codigo" },
  ],
  campos: [],
};
