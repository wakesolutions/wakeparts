import type { Documento, TipoDocumento } from "@/lib/ventas";

type Emisor = Documento["emisor"];

/**
 * Documento de ejemplo para la vista previa del editor de formato. Usa los datos
 * reales del taller como emisor; todo lo demás es ficticio (CAI incluido).
 */
export function documentoEjemplo(tipo: TipoDocumento, emisor: Emisor, vendedor: string): Documento {
  const factura = tipo === "factura";
  return {
    id: "ejemplo",
    tipo,
    numero: factura ? "000-001-01-00001234" : "COT-000318",
    fecha: new Date().toISOString(),
    vence: factura ? null : new Date(Date.now() + 15 * 86_400_000).toISOString().slice(0, 10),
    cai: factura ? "35A2B1-8C9D4E-F0A1B2-C3D4E5-F6A7B8-9C" : null,
    cai_rango: factura ? "000-001-01-00000001 al 000-001-01-00005000" : null,
    cai_fecha_limite: factura ? `${new Date().getFullYear()}-12-31` : null,
    emisor: {
      nombre: emisor.nombre || "Tu taller",
      razon_social: emisor.razon_social ?? null,
      rtn: emisor.rtn ?? null,
      telefono: emisor.telefono ?? null,
      correo: emisor.correo ?? null,
      direccion: emisor.direccion ?? null,
    },
    cliente_nombre: "TRANSPORTES DEL VALLE S. DE R.L.",
    cliente_rtn: "08019015234567",
    cliente_telefono: "9876-5432",
    vehiculo: "TOYOTA HILUX 2018 · 2.4 L DIÉSEL",
    subtotal: 5905,
    descuento: 98,
    importe_exento: 0,
    importe_gravado: 5807,
    importe_exonerado: 0,
    isv: 871.05,
    total: 6678.05,
    notas: null,
    estado: "emitido",
    motivo_anulacion: null,
    exoneracion: null,
    id_factura: null,
    factura_numero: null,
    factura_fecha: null,
    factura_cai: null,
    motivo_tipo: null,
    motivo: null,
    reintegra_inventario: false,
    condicion: "contado",
    dias_credito: null,
    vendedor,
    lineas: [
      { id: 1, codigo: "KYB-334082", descripcion: "AMORTIGUADOR DELANTERO KYB", cantidad: 2, precio: 1850, descuento_pct: 0, descuento: 0, exento: false, total: 3700 },
      { id: 2, codigo: "ACT1089", descripcion: "PASTILLAS DE FRENO DELANTERAS AKEBONO", cantidad: 1, precio: 980, descuento_pct: 10, descuento: 98, exento: false, total: 882 },
      { id: 3, codigo: "MOB-5W30", descripcion: "ACEITE SINTÉTICO 5W-30 (LITRO)", cantidad: 4, precio: 260, descuento_pct: 0, descuento: 0, exento: false, total: 1040 },
      { id: 4, codigo: "PH4967", descripcion: "FILTRO DE ACEITE FRAM", cantidad: 1, precio: 185, descuento_pct: 0, descuento: 0, exento: false, total: 185 },
    ],
  };
}
