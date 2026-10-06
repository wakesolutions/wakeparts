/** Íconos de los módulos (dock, manual). SVG propios, sin librerías. */

export function IconoInicio() {
  // Casa con puerta de garaje
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M8 22.5 24 9l16 13.5V39a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2z" fill="currentColor" />
      <path
        d="M15 41V28.5a1.5 1.5 0 0 1 1.5-1.5h15a1.5 1.5 0 0 1 1.5 1.5V41"
        fill="none"
        stroke="var(--wp-accent-lo)"
        strokeWidth="2.2"
      />
      <path d="M17 31.5h14M17 35.5h14" stroke="var(--wp-accent-lo)" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function IconoMostrador() {
  // Ticket de caja con borde rasgado y total resaltado
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path
        d="M12 6h24a2 2 0 0 1 2 2v34l-3.3-2.4-3.4 2.4-3.3-2.4-3.4 2.4-3.3-2.4-3.4 2.4-3.3-2.4L10 42V8a2 2 0 0 1 2-2z"
        fill="currentColor"
      />
      <path d="M16 14h16M16 19.5h11M16 25h13" stroke="var(--wp-accent-lo)" strokeWidth="2" strokeLinecap="round" />
      <rect x="15" y="29.5" width="18" height="6" rx="1.5" fill="var(--wp-accent)" />
    </svg>
  );
}

export function IconoInventario() {
  // Estante con cajas y un pistón
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M8 8v34M40 8v34" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M8 23h32M8 39h32" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      <rect x="12" y="12" width="11" height="9" rx="1.2" fill="currentColor" />
      <rect x="25" y="14" width="11" height="7" rx="1.2" fill="currentColor" opacity="0.55" />
      <rect x="12" y="29" width="9" height="8" rx="1.2" fill="currentColor" opacity="0.55" />
      <path d="M27 27.5h8v5a4 4 0 0 1-8 0z" fill="var(--wp-accent)" />
      <path d="M31 36.5V39" stroke="var(--wp-accent)" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function IconoToma() {
  // Teléfono con lente y un marbete colgando
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <rect x="9" y="5" width="22" height="38" rx="4" fill="currentColor" />
      <rect x="12" y="10" width="16" height="22" rx="1.5" fill="var(--wp-accent-lo)" opacity="0.55" />
      <circle cx="20" cy="21" r="5" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="20" cy="21" r="2" fill="var(--wp-accent)" />
      <path d="M31 17c4 0 6 2 6.5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M33 24h8.5a1.5 1.5 0 0 1 1.5 1.5V37a1.5 1.5 0 0 1-1.5 1.5H33l-3-3.5v-7.5z" fill="var(--wp-accent)" />
      <circle cx="33.4" cy="31.2" r="1.3" fill="var(--wp-accent-lo)" />
      <path d="M36.5 29.5h4M36.5 33h3" stroke="var(--wp-on-accent)" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function IconoVentas() {
  // Carpeta de facturas con sello
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M13 9h17l7 7v23a2 2 0 0 1-2 2H13a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2z" fill="currentColor" opacity="0.5" transform="translate(3 -3)" />
      <path d="M10 11h17l7 7v23a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V13a2 2 0 0 1 2-2z" fill="currentColor" />
      <path d="M14 22h13M14 27h9" stroke="var(--wp-accent-lo)" strokeWidth="2" strokeLinecap="round" />
      <circle cx="25" cy="34.5" r="4.5" fill="none" stroke="var(--wp-accent)" strokeWidth="2.2" />
      <path d="m23 34.6 1.5 1.5 2.7-2.9" fill="none" stroke="var(--wp-accent)" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function IconoLlave() {
  // Llave combinada sobre una tuerca
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path
        d="M24 10.5 35.7 17.2v13.6L24 37.5l-11.7-6.7V17.2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinejoin="round"
        opacity="0.35"
      />
      <path
        d="M33.6 8.4a7.5 7.5 0 0 0-9 9.8L10.2 32.6a3.2 3.2 0 1 0 4.5 4.5l14.4-14.4a7.5 7.5 0 0 0 9.8-9l-4.6 4.6-4.1-.9-.9-4.1z"
        fill="currentColor"
      />
      <circle cx="12.5" cy="34.9" r="1.3" fill="var(--wp-accent)" />
    </svg>
  );
}

export function IconoEquipo() {
  // Dos cascos de mecánico
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="31" cy="17" r="5.5" fill="currentColor" opacity="0.45" />
      <path d="M21.5 38c0-6.2 4.3-10.5 9.5-10.5S40.5 31.8 40.5 38z" fill="currentColor" opacity="0.45" />
      <circle cx="19" cy="18.5" r="6.5" fill="currentColor" />
      <path d="M7 40c0-7.2 5.2-12 12-12s12 4.8 12 12z" fill="currentColor" />
      <path d="M12.5 17.5a6.5 6.5 0 0 1 13 0z" fill="var(--wp-accent)" opacity="0.9" />
    </svg>
  );
}

export function IconoTaller() {
  // Nave de taller con portón y engranaje
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M6 20 24 9l18 11v19H6z" fill="currentColor" />
      <path d="M13 39V26h22v13" fill="none" stroke="var(--wp-accent-lo)" strokeWidth="2.2" />
      <path d="M13 30h22M13 34.5h22" stroke="var(--wp-accent-lo)" strokeWidth="1.6" />
      <circle cx="24" cy="19" r="3.2" fill="none" stroke="var(--wp-accent-lo)" strokeWidth="2" />
    </svg>
  );
}

export function IconoPerfil() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="17" r="8" fill="currentColor" />
      <path d="M9 41c0-8.6 6.7-14 15-14s15 5.4 15 14z" fill="currentColor" />
    </svg>
  );
}

export function IconoActividad() {
  // Tacógrafo: disco de registro con la traza de la jornada y la aguja
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="17" fill="currentColor" />
      <path
        d="M11 26.5h5l2.5-7 4 13 3.5-10 2.5 4h8.5"
        fill="none"
        stroke="var(--wp-accent-lo)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M24 24 33 13" stroke="var(--wp-accent)" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="24" cy="24" r="2.6" fill="var(--wp-accent)" />
    </svg>
  );
}

export function IconoSitio() {
  // Vitrina: toldo de tienda sobre una ventana de navegador
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <rect x="7" y="10" width="34" height="30" rx="3" fill="currentColor" />
      <path
        d="M7 13a3 3 0 0 1 3-3h28a3 3 0 0 1 3 3v5H7z"
        fill="var(--wp-accent-lo)"
        opacity="0.55"
      />
      <path
        d="M9 18h30l-2.5 5.5a3 3 0 0 1-5.4 0 3 3 0 0 1-5.4 0 3 3 0 0 1-5.4 0 3 3 0 0 1-5.4 0z"
        fill="var(--wp-accent)"
      />
      <rect x="15" y="28" width="9" height="12" rx="1" fill="var(--wp-accent-lo)" />
      <rect x="27" y="28" width="8" height="6" rx="1" fill="var(--wp-accent-lo)" opacity="0.7" />
    </svg>
  );
}

export function IconoSeguimiento() {
  // Lista de talleres con un globo de mensaje
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <rect x="7" y="8" width="26" height="32" rx="3" fill="currentColor" />
      <path d="M12 16h16M12 22h12M12 28h14" stroke="var(--wp-accent-lo)" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M27 27h13a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-6l-4 3.5V39h-3a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z" fill="var(--wp-accent)" />
    </svg>
  );
}

export function IconoCaja() {
  // Caja registradora: gaveta con billete y visor
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <rect x="13" y="7" width="22" height="9" rx="2" fill="currentColor" opacity="0.55" />
      <rect x="17" y="10" width="14" height="3.4" rx="1" fill="var(--wp-accent)" />
      <path d="M9 18h30a2 2 0 0 1 2 2v9H7v-9a2 2 0 0 1 2-2z" fill="currentColor" />
      <path d="M14 22.5h3M21 22.5h3M28 22.5h3" stroke="var(--wp-accent-lo)" strokeWidth="2" strokeLinecap="round" />
      <path d="M6 31h36v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z" fill="currentColor" />
      <path d="M19 35.5h10" stroke="var(--wp-accent-lo)" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function IconoNotas() {
  // Dos hojas con signo: la nota de crédito (−) delante de la de débito (+)
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M17 6h16l6 6v23a2 2 0 0 1-2 2H17a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" fill="currentColor" opacity="0.5" />
      <path d="M29.5 21.5v6M26.5 24.5h6" stroke="var(--wp-accent-lo)" strokeWidth="2" strokeLinecap="round" />
      <path d="M11 12h16l6 6v22a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V14a2 2 0 0 1 2-2z" fill="currentColor" />
      <path d="M13.5 20h9M13.5 24.5h6" stroke="var(--wp-accent-lo)" strokeWidth="2" strokeLinecap="round" />
      <rect x="13.5" y="31" width="14" height="5" rx="1.5" fill="var(--wp-accent)" />
      <path d="M17.5 33.5h6" stroke="var(--wp-bg-deep)" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
