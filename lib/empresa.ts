import { PALETAS } from "./paletas";
import type { DefCampo } from "./recursos/tipos";

/** Campos del onboarding de empresa (usa el Formulario genérico). */
export const CAMPOS_EMPRESA: readonly DefCampo[] = [
  {
    nombre: "nombre",
    etiqueta: "Nombre comercial",
    tipo: "texto",
    requerido: true,
    maxLargo: 120,
    placeholder: "Yonker El Pistón",
    ancho: "completo",
  },
  {
    nombre: "razon_social",
    etiqueta: "Razón social",
    tipo: "texto",
    maxLargo: 160,
    placeholder: "El Pistón S. de R.L.",
    ayuda: "Como aparece en el SAR. Opcional por ahora.",
  },
  {
    nombre: "rtn",
    etiqueta: "RTN",
    tipo: "texto",
    patron: "^\\d{4}-?\\d{4}-?\\d{6}$",
    mensajePatron: "Son 14 dígitos: 0801-1990-123456.",
    placeholder: "0801-1990-123456",
    ayuda: "Lo vas a necesitar para facturar.",
  },
  { nombre: "telefono", etiqueta: "Teléfono", tipo: "texto", maxLargo: 30, placeholder: "9999-0000" },
  {
    nombre: "correo",
    etiqueta: "Correo",
    tipo: "texto",
    maxLargo: 120,
    patron: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$",
    mensajePatron: "Correo no válido.",
    placeholder: "ventas@tuempresa.hn",
  },
  {
    nombre: "direccion",
    etiqueta: "Dirección",
    tipo: "textoLargo",
    maxLargo: 300,
    placeholder: "Barrio, calle, ciudad",
    ancho: "completo",
  },
  {
    nombre: "paleta",
    etiqueta: "Paleta de la empresa",
    tipo: "opciones",
    requerido: true,
    presentacion: "tarjetas",
    opciones: PALETAS.map((p) => ({ valor: p.id, etiqueta: p.nombre, muestra: p.muestra })),
    porDefecto: "rojo-negro",
    ancho: "completo",
  },
];

/** Campos del módulo Taller: los del onboarding + reglas de venta. */
export const CAMPOS_TALLER: readonly DefCampo[] = [
  ...CAMPOS_EMPRESA,
  {
    nombre: "descuento_maximo_vendedor",
    etiqueta: "Descuento máximo de un vendedor",
    tipo: "decimal",
    requerido: true,
    min: 0,
    max: 100,
    sufijo: "%",
    porDefecto: 10,
    ayuda: "Dueño y administradores no tienen tope. La base lo hace cumplir.",
    seccion: "Reglas de venta",
  },
];
