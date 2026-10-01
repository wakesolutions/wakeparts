/** Íconos propios de Wake Parts: trazo 1.6, 16×16, heredan currentColor. */

type Props = { className?: string; tamano?: number };

function Svg({ tamano = 16, className, children }: Props & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={tamano}
      height={tamano}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const IconoBuscar = (p: Props) => (
  <Svg {...p}>
    <circle cx="7" cy="7" r="4.5" />
    <path d="m10.5 10.5 3.5 3.5" />
  </Svg>
);

export const IconoFiltro = (p: Props) => (
  <Svg {...p}>
    <path d="M2 3.5h12M4.5 8h7M7 12.5h2" />
  </Svg>
);

export const IconoColumnas = (p: Props) => (
  <Svg {...p}>
    <rect x="2" y="2.5" width="12" height="11" rx="1.5" />
    <path d="M6 2.5v11M10 2.5v11" />
  </Svg>
);

export const IconoMas = (p: Props) => (
  <Svg {...p}>
    <path d="M8 3v10M3 8h10" />
  </Svg>
);

export const IconoRecargar = (p: Props) => (
  <Svg {...p}>
    <path d="M13 8a5 5 0 1 1-1.5-3.6" />
    <path d="M13 2.5V5h-2.5" />
  </Svg>
);

export const IconoEditar = (p: Props) => (
  <Svg {...p}>
    <path d="M10.5 2.5 13.5 5.5 6 13H3v-3z" />
  </Svg>
);

export const IconoCerrar = (p: Props) => (
  <Svg {...p}>
    <path d="m4 4 8 8M12 4l-8 8" />
  </Svg>
);

export const IconoFlechaArriba = (p: Props) => (
  <Svg {...p}>
    <path d="M8 13V3M4 7l4-4 4 4" />
  </Svg>
);

export const IconoFlechaAbajo = (p: Props) => (
  <Svg {...p}>
    <path d="M8 3v10M4 9l4 4 4-4" />
  </Svg>
);

export const IconoChevron = (p: Props) => (
  <Svg {...p}>
    <path d="m4.5 6 3.5 3.5L11.5 6" />
  </Svg>
);

export const IconoAnterior = (p: Props) => (
  <Svg {...p}>
    <path d="m10 3.5-4.5 4.5 4.5 4.5" />
  </Svg>
);

export const IconoSiguiente = (p: Props) => (
  <Svg {...p}>
    <path d="m6 3.5 4.5 4.5L6 12.5" />
  </Svg>
);

export const IconoPapelera = (p: Props) => (
  <Svg {...p}>
    <path d="M2.5 4h11M6 4V2.5h4V4M4 4l.7 9.5h6.6L12 4" />
  </Svg>
);

export const IconoCheck = (p: Props) => (
  <Svg {...p}>
    <path d="m3 8.5 3 3 7-7" />
  </Svg>
);

export const IconoDensidad = (p: Props) => (
  <Svg {...p}>
    <path d="M2 3h12M2 6.5h12M2 10h12M2 13.5h12" />
  </Svg>
);

export const IconoAgarre = (p: Props) => (
  <Svg {...p}>
    <path d="M6 3.5h.01M10 3.5h.01M6 8h.01M10 8h.01M6 12.5h.01M10 12.5h.01" strokeWidth="2.4" />
  </Svg>
);

export const IconoOjo = (p: Props) => (
  <Svg {...p}>
    <path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" />
    <circle cx="8" cy="8" r="2" />
  </Svg>
);

export const IconoMenos = (p: Props) => (
  <Svg {...p}>
    <path d="M3 8h10" />
  </Svg>
);

export const IconoAuto = (p: Props) => (
  <Svg {...p}>
    <path d="M2 10.5V8.3l1.4-3.4A1.5 1.5 0 0 1 4.8 4h6.4a1.5 1.5 0 0 1 1.4.9L14 8.3v2.2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z" />
    <path d="M2.3 8h11.4M4.5 11.5V13M11.5 11.5V13" />
    <circle cx="5" cy="9.7" r=".5" fill="currentColor" />
    <circle cx="11" cy="9.7" r=".5" fill="currentColor" />
  </Svg>
);

export const IconoCamara = (p: Props) => (
  <Svg {...p}>
    <path d="M2 5.5a1 1 0 0 1 1-1h2l1-1.5h4l1 1.5h2a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z" />
    <circle cx="8" cy="8.5" r="2.4" />
  </Svg>
);

export const IconoCopiar = (p: Props) => (
  <Svg {...p}>
    <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
    <path d="M10.5 3.5v-.5a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h.5" />
  </Svg>
);

export const IconoImprimir = (p: Props) => (
  <Svg {...p}>
    <path d="M4.5 6V2.5h7V6M4.5 11.5H3a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v3.5a1 1 0 0 1-1 1h-1.5" />
    <path d="M4.5 9.5h7v4h-7z" />
  </Svg>
);

export const IconoCarrito = (p: Props) => (
  <Svg {...p}>
    <path d="M1.5 2.5h2l1.6 7.6a1 1 0 0 0 1 .8h5.6a1 1 0 0 0 1-.8l1-4.6H4.2" />
    <circle cx="6.5" cy="13.2" r=".9" />
    <circle cx="11.5" cy="13.2" r=".9" />
  </Svg>
);

export const IconoEstrella = (p: Props) => (
  <Svg {...p}>
    <path d="m8 2.2 1.8 3.7 4 .6-2.9 2.8.7 4L8 11.4l-3.6 1.9.7-4L2.2 6.5l4-.6z" />
  </Svg>
);

export const IconoDocumento = (p: Props) => (
  <Svg {...p}>
    <path d="M4 1.8h5.5L12.5 5v9a.8.8 0 0 1-.8.8H4a.8.8 0 0 1-.8-.8V2.6a.8.8 0 0 1 .8-.8z" />
    <path d="M9.3 2v3.2h3M5.5 8.5h5M5.5 11h3.5" />
  </Svg>
);

export const IconoCandado = (p: Props) => (
  <Svg {...p}>
    <rect x="3.5" y="7" width="9" height="7" rx="1.4" />
    <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
  </Svg>
);

export const IconoImagen = (p: Props) => (
  <Svg {...p}>
    <rect x="2" y="3" width="12" height="10" rx="1.5" />
    <circle cx="5.8" cy="6.5" r="1.1" />
    <path d="m2.5 12 3.8-3.6 2.6 2.4 2-1.8 2.6 2.6" />
  </Svg>
);
