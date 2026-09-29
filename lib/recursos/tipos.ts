/**
 * Un "recurso" describe una tabla del ERP para los componentes genéricos:
 * TablaMaestra (listar/filtrar/ordenar) y Formulario (crear/editar).
 *
 * Las definiciones son objetos planos (sin funciones) para que se puedan
 * importar tanto en el servidor como en el cliente.
 */

export type TipoDato = "texto" | "entero" | "decimal" | "booleano" | "fecha";

export type Opcion = {
  valor: string | number;
  etiqueta: string;
  /** Colores para mostrar una muestra (p. ej. paletas). */
  muestra?: readonly string[];
};

/** De dónde sacar opciones dinámicas: otra vista de recurso. */
export type FuenteOpciones = {
  recurso: string;
  /** Columna que se guarda / se filtra. */
  valor: string;
  /** Columna(s) que se muestran; varias se unen con « · ». */
  etiqueta: string | readonly string[];
  /** Filtra las opciones por el valor de otro campo del formulario. */
  dependeDe?: { campo: string; columna: string };
  /** Filtro fijo por igualdad (p. ej. solo categorías activas). */
  fijo?: { columna: string; valor: string | number | boolean };
};

export type TipoFiltro =
  | { tipo: "texto" }
  | { tipo: "numero" }
  | { tipo: "booleano" }
  | { tipo: "opciones"; opciones?: readonly Opcion[]; fuente?: FuenteOpciones };

export type FormatoCelda =
  | "miles"
  | "litros"
  | "cc"
  | "anio"
  | "codigo"
  /** Lempiras: L 1,234.50 */
  | "moneda"
  | "porcentaje"
  /** Ruta de una imagen en Storage: se muestra la miniatura. */
  | "imagen"
  /** Timestamp con hora y segundos, hora de Honduras (columnas tipo "fecha"). */
  | "fechaHora";

export type DefColumna = {
  /** Columna de la vista. */
  clave: string;
  etiqueta: string;
  tipo: TipoDato;
  /** Ancho inicial en px. */
  ancho?: number;
  /** Oculta por defecto (el usuario puede mostrarla). */
  oculta?: boolean;
  /** Participa en la búsqueda rápida. */
  buscable?: boolean;
  /** Por defecto true. */
  ordenable?: boolean;
  /** Por defecto se deduce del tipo; false lo desactiva. */
  filtro?: TipoFiltro | false;
  formato?: FormatoCelda;
  /** Etiquetas para valores codificados (p. ej. L → En línea). */
  opciones?: readonly Opcion[];
  /** Columna booleana de la fila que, si es true, marca la celda en alerta (p. ej. bajo mínimo). */
  alerta?: string;
  /** Texto a mostrar cuando el valor es nulo o cero (p. ej. «General»). */
  vacio?: string;
};

export type TipoCampo =
  | "texto"
  | "textoLargo"
  | "entero"
  | "decimal"
  | "booleano"
  | "opciones"
  | "relacion"
  /** AAAA-MM-DD */
  | "fecha"
  /** Solo lectura, se calcula en vivo con otros campos (no se guarda). */
  | "calculado";

/** Cálculos declarativos para campos «calculado». */
export type Calculo =
  /** a − b (p. ej. utilidad = precio − costo) */
  | { tipo: "resta"; a: string; b: string }
  /** (precio − costo) / precio · 100 */
  | { tipo: "margen"; precio: string; costo: string }
  /** base · (1 + tasa), salvo que el campo `exento` sea true */
  | { tipo: "conImpuesto"; base: string; tasa: number; exento?: string };

export type DefCampo = {
  nombre: string;
  etiqueta: string;
  tipo: TipoCampo;
  requerido?: boolean;
  /** false = solo ayuda a elegir otro campo (p. ej. marca → modelo) y no se guarda. */
  guardar?: boolean;
  ayuda?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  maxLargo?: number;
  /** Regex (string) que debe cumplir el texto. */
  patron?: string;
  mensajePatron?: string;
  sufijo?: string;
  /** Texto fijo antes del valor (p. ej. «L» de lempiras). */
  prefijo?: string;
  mayusculas?: boolean;
  minusculas?: boolean;
  /** Se define al crear; al editar se muestra bloqueado y no se envía. */
  soloAlCrear?: boolean;
  /** Ocupa las dos columnas del formulario. */
  ancho?: "completo";
  opciones?: readonly Opcion[];
  /** Presentación de "opciones": lista desplegable o tarjetas. */
  presentacion?: "lista" | "tarjetas";
  relacion?: FuenteOpciones;
  /** Valor inicial al crear. */
  porDefecto?: string | number | boolean | null;
  /** Título de sección que se muestra antes de este campo (agrupa formularios largos). */
  seccion?: string;
  /** Para tipo "calculado". */
  calculo?: Calculo;
  formato?: "moneda" | "porcentaje";
};

/**
 * admin_plataforma: datos globales · empresa: dueño/admin de la empresa activa ·
 * miembros: cualquier miembro (p. ej. clientes, que registra el vendedor).
 */
export type Escritura = "admin_plataforma" | "empresa" | "miembros" | "ninguna";

export type DefRecurso = {
  id: string;
  /** Singular y plural para textos de UI. */
  nombre: string;
  nombrePlural: string;
  /** Género gramatical para «Nuevo/Nueva». */
  genero?: "m" | "f";
  /** Vista (o tabla) de lectura. */
  vista: string;
  /** Tabla de escritura. */
  tabla: string;
  /** Clave primaria (misma en vista y tabla). */
  clave: string;
  columnas: readonly DefColumna[];
  /** Columnas de la vista que se pueden usar para filtrar opciones pero no se muestran. */
  columnasInternas?: readonly string[];
  /** Orden inicial. */
  orden?: readonly Orden[];
  campos: readonly DefCampo[];
  /** Quién puede crear/editar/eliminar. */
  escritura: Escritura;
  /**
   * "empresa": la vista y la tabla tienen `id_empresa`; el servidor filtra por la
   * empresa activa y la asigna al crear. "compartido": filas globales
   * (`id_empresa` null) + las de la empresa activa; al crear se asigna la empresa.
   * "global" (defecto): sin filtro.
   */
  ambito?: "global" | "empresa" | "compartido";
  /** Tamaño de la ventana del formulario (por defecto se calcula por campos). */
  ventana?: { w: number; h: number };
  /** Acciones disponibles (todas por defecto). */
  acciones?: { crear?: boolean; editar?: boolean; eliminar?: boolean };
  /** Columna que resume un registro en títulos («Editar TOYOTA»). */
  titulo?: string | readonly string[];
  mensajes?: {
    duplicado?: string;
    enUso?: string;
  };
};

// ---------------------------------------------------------------- consultas --

export type Operador =
  | "contiene"
  | "igual"
  | "distinto"
  | "empieza"
  | "vacio"
  | "no_vacio"
  | "mayor"
  | "mayor_igual"
  | "menor"
  | "menor_igual"
  | "entre"
  | "en"
  | "verdadero"
  | "falso";

export type Filtro = {
  id: string;
  columna: string;
  operador: Operador;
  valor?: string | number;
  valor2?: string | number;
  valores?: (string | number)[];
};

export type Orden = { columna: string; dir: "asc" | "desc" };

export type Consulta = {
  busqueda?: string;
  filtros?: Filtro[];
  orden?: Orden[];
  pagina: number;
  tamano: number;
};

export type Fila = Record<string, unknown>;

export type ResultadoConsulta =
  | { ok: true; filas: Fila[]; total: number }
  | { ok: false; error: string };

export type ResultadoGuardar =
  | { ok: true; id: string | number }
  | { ok: false; error: string; errores?: Record<string, string> };

export type Valores = Record<string, unknown>;

/** Configuración de la tabla que se guarda por usuario. */
export type PreferenciasTabla = {
  columnas?: { clave: string; visible: boolean; ancho?: number }[];
  orden?: Orden[];
  tamano?: number;
  densidad?: "compacta" | "normal";
};
