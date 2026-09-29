import type { ReactNode } from "react";
import esc from "@/app/inicio/_components/escritorio.module.css";
import v from "@/components/ventanas/ventanas.module.css";
import styles from "../ayuda.module.css";

/** Marco de ventana del escritorio (misma piel que las ventanas reales), sin comportamiento. */
export function Marco({ titulo, children, ancho }: { titulo: string; children: ReactNode; ancho?: string }) {
  return (
    <figure className={`${v.ventana} ${styles.marco}`} data-activa="" style={{ maxWidth: ancho }}>
      <div className={v.marco}>
        <div className={v.titulo}>
          <span className={v.semaforo} aria-hidden="true">
            <span className={v.luz} data-luz="cerrar" />
            <span className={v.luz} data-luz="minimizar" />
            <span className={v.luz} data-luz="maximizar" />
          </span>
          <span className={v.tituloTexto}>{titulo}</span>
        </div>
        <div className={styles.marcoCuerpo}>{children}</div>
      </div>
    </figure>
  );
}

/** Ícono de módulo tal como se ve en el dock. */
export function IconoDock({ icono, nombre }: { icono: ReactNode; nombre: string }) {
  return (
    <li className={styles.dockItem}>
      <span className={`${esc.app} ${styles.dockApp}`} data-tono="metal" aria-hidden="true">
        <span className={esc.icono}>{icono}</span>
      </span>
      <span className={styles.dockNombre}>{nombre}</span>
    </li>
  );
}

/** Aviso al estilo de los testigos del tablero. */
export function Nota({ tono = "info", titulo, children }: { tono?: "info" | "aviso"; titulo: string; children: ReactNode }) {
  return (
    <aside className={styles.nota} data-tono={tono}>
      <span className={styles.notaLed} aria-hidden="true" />
      <div>
        <p className={styles.notaTitulo}>{titulo}</p>
        <div className={styles.notaTexto}>{children}</div>
      </div>
    </aside>
  );
}

export function Tecla({ children }: { children: ReactNode }) {
  return <kbd className={styles.tecla}>{children}</kbd>;
}

/** LED de estado: encendido, a medias o apagado. */
export function Led({ estado = "si", tono = "ok" }: { estado?: "si" | "medio" | "no"; tono?: "ok" | "aviso" | "acento" }) {
  return <span className={styles.led} data-estado={estado} data-tono={tono} aria-hidden="true" />;
}

export function Capitulo({
  id,
  numero,
  titulo,
  bajada,
  children,
}: {
  id: string;
  numero: string;
  titulo: string;
  bajada: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={styles.capitulo} aria-labelledby={`${id}-titulo`}>
      <header className={styles.capituloCabecera}>
        <span className={styles.capituloNumero} aria-hidden="true">
          {numero}
        </span>
        <div>
          <h2 id={`${id}-titulo`} className={`wp-grabado ${styles.capituloTitulo}`}>
            {titulo}
          </h2>
          <p className={styles.capituloBajada}>{bajada}</p>
        </div>
      </header>
      <div className={styles.capituloCuerpo}>{children}</div>
    </section>
  );
}
