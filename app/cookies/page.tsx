import type { Metadata } from "next";
import { PaginaLegal } from "../_publico/legal";
import styles from "../_publico/publico.module.css";

export const metadata: Metadata = {
  title: "Política de cookies",
  description:
    "Qué cookies y datos locales usa Wake Parts: solo los necesarios para iniciar sesión y recordar la paleta de tu taller. Sin publicidad ni rastreo.",
  alternates: { canonical: "/cookies" },
  openGraph: { url: "/cookies" },
};

const COOKIES = [
  {
    nombre: "sb-…-auth-token",
    para: "Mantener tu sesión iniciada con Google. Sin ella no podés entrar a tu tablero.",
    tipo: "Necesaria",
    duracion: "Hasta que cerrás sesión (máximo 400 días)",
    quien: "Wake Parts (Supabase Auth)",
  },
  {
    nombre: "sb-…-auth-token-code-verifier",
    para: "Completar de forma segura el inicio de sesión con Google (PKCE).",
    tipo: "Necesaria",
    duracion: "Unos minutos, mientras entrás",
    quien: "Wake Parts (Supabase Auth)",
  },
  {
    nombre: "wp_paleta",
    para: "Recordar los colores de tu taller para que la página no parpadee al cargar.",
    tipo: "Preferencia",
    duracion: "1 año",
    quien: "Wake Parts",
  },
];

const LOCALES = [
  {
    nombre: "wp:ventanas",
    para: "Posición y tamaño de las ventanas flotantes.",
  },
  {
    nombre: "wp:<módulo>:seccion",
    para: "La última tabla que abriste en cada módulo.",
  },
  {
    nombre: "wp:recorrido:<usuario>",
    para: "Que ya viste el recorrido guiado, para no repetirlo.",
  },
  { nombre: "wp:aviso-cookies", para: "Que ya leíste este aviso." },
];

export default function Cookies() {
  return (
    <PaginaLegal
      ruta="/cookies"
      titulo={
        <>
          Política de
          <br />
          cookies<span className="text-wp-accent">.</span>
        </>
      }
      resumen={
        <>
          Wake Parts usa solo las cookies necesarias para que puedas iniciar sesión y para recordar la paleta de tu
          taller. No usamos cookies de publicidad, de analítica ni de redes sociales, y no vendemos ni compartimos datos
          de navegación.
        </>
      }
    >
      <h2 className={styles.legalTitulo}>Cookies que usamos</h2>
      <div className={styles.legalTabla}>
        <table>
          <thead>
            <tr>
              <th scope="col">Cookie</th>
              <th scope="col">Para qué</th>
              <th scope="col">Tipo</th>
              <th scope="col">Duración</th>
            </tr>
          </thead>
          <tbody>
            {COOKIES.map((c) => (
              <tr key={c.nombre}>
                <th scope="row">
                  <code>{c.nombre}</code>
                  <small>{c.quien}</small>
                </th>
                <td>{c.para}</td>
                <td>{c.tipo}</td>
                <td>{c.duracion}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className={styles.legalTitulo}>Datos guardados en tu navegador</h2>
      <p>
        Además, dentro del tablero guardamos algunas preferencias en el almacenamiento local de tu navegador. No son
        cookies: no viajan a nuestros servidores y solo sirven para que la app se acuerde de cómo la dejaste.
      </p>
      <ul className={styles.legalLista}>
        {LOCALES.map((l) => (
          <li key={l.nombre}>
            <code>{l.nombre}</code> — {l.para}
          </li>
        ))}
      </ul>

      <h2 className={styles.legalTitulo}>Terceros</h2>
      <p>
        Las fuentes tipográficas se sirven desde nuestro propio sitio. Las fotos de productos se guardan en Supabase
        Storage y se cargan sin cookies. El inicio de sesión lo hace Google: al tocar «Encender» pasás por su página y
        aplican sus propias políticas.
      </p>

      <h2 className={styles.legalTitulo}>Cómo borrarlas</h2>
      <p>
        Cerrar sesión (botón <strong>Apagar</strong>) borra las cookies de sesión. Para borrar todo, usá la opción de
        borrar datos de sitios de tu navegador. Si bloqueás las cookies necesarias no vas a poder iniciar sesión.
      </p>

      <h2 className={styles.legalTitulo}>Cambios</h2>
      <p>
        Si algún día agregamos cookies opcionales (por ejemplo, de analítica), te vamos a pedir permiso antes de usarlas
        y vamos a actualizar esta página.
      </p>
    </PaginaLegal>
  );
}
