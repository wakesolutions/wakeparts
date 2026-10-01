/** Íconos propios del sitio público (mismo trazo que components/ui/iconos). */

type Props = { tamano?: number; className?: string };

/** Pieza genérica (engranaje + llave): lugar de la foto cuando un producto no tiene. */
export function IconoPieza({ tamano = 40, className }: Props) {
  return (
    <svg
      viewBox="0 0 48 48"
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
      <circle cx="24" cy="24" r="7" />
      <path d="M24 9v5M24 34v5M9 24h5M34 24h5M13.4 13.4l3.5 3.5M31.1 31.1l3.5 3.5M13.4 34.6l3.5-3.5M31.1 16.9l3.5-3.5" />
      <circle cx="24" cy="24" r="13" opacity=".35" />
    </svg>
  );
}

export function IconoWhatsapp({ tamano = 16 }: Props) {
  return (
    <svg viewBox="0 0 16 16" width={tamano} height={tamano} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 13.5l.9-2.6A5.6 5.6 0 1 1 5.6 13l-3.1.5z" />
      <path d="M6.2 5.6c.2 1.9 1.6 3.6 3.9 4.3l.8-.9-1-.6-.6.5c-.8-.3-1.5-1-1.8-1.8l.5-.6-.6-1-.9.8" />
    </svg>
  );
}
