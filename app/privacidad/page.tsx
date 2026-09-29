import type { Metadata } from "next";
import Link from "next/link";
import { PaginaLegal } from "../_publico/legal";
import styles from "../_publico/publico.module.css";
import { CONTACTO, RESPONSABLE } from "@/lib/sitio";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description:
    "Qué datos guarda Wake Parts, para qué los usa y quién los ve. Tus datos son tuyos: no los vendemos ni los usamos para publicidad.",
  alternates: { canonical: "/privacidad" },
  openGraph: { url: "/privacidad" },
};

const DATOS = [
  {
    que: "Tu cuenta",
    detalle: "Nombre, correo y foto de tu cuenta de Google; el teléfono si lo agregás en Mi usuario.",
    para: "Identificarte, mostrar quién hizo cada venta o movimiento y avisarte de algo importante.",
  },
  {
    que: "Tu empresa",
    detalle: "Nombre comercial, razón social, RTN, teléfono, correo, dirección y colores.",
    para: "Encabezar cotizaciones y facturas y separar tus datos de los de otras empresas.",
  },
  {
    que: "Tu operación",
    detalle: "Productos, fotos, precios, existencias, kardex, CAI, cotizaciones, facturas y reportes.",
    para: "Que el sistema funcione: vender, facturar y llevar el inventario.",
  },
  {
    que: "Tus clientes",
    detalle: "Nombre, RTN, teléfono, correo y dirección que registrés en Ventas › Clientes.",
    para: "Emitir documentos a su nombre. Los decide y administra tu empresa.",
  },
  {
    que: "Registro de actividad",
    detalle:
      "De cada página que se abre (también sin iniciar sesión), cada inicio o cierre de sesión y cada error: fecha y hora, dirección IP, tipo de dispositivo, sistema y navegador, ciudad y país aproximados, la página y de dónde venías. De cada cambio de datos: quién lo hizo y el valor anterior y el nuevo.",
    para: "Seguridad, detectar accesos indebidos, resolver fallas y saber qué pasó en cada momento.",
  },
];

export default function Privacidad() {
  return (
    <PaginaLegal
      ruta="/privacidad"
      titulo={
        <>
          Política de
          <br />
          privacidad<span className="text-wp-accent">.</span>
        </>
      }
      resumen={
        <>
          Guardamos solo lo necesario para que Wake Parts funcione. Tus datos y los de tus clientes son de tu empresa:
          no los vendemos, no los usamos para publicidad y ninguna otra empresa puede verlos.
        </>
      }
    >
      <h2 className={styles.legalTitulo}>Quién es responsable</h2>
      <p>
        Wake Parts lo ofrece <strong>{RESPONSABLE}</strong>. Sobre los datos de tu cuenta y de tu empresa, somos
        responsables de cuidarlos. Sobre los datos de <strong>tus clientes</strong>, el responsable es tu empresa:
        nosotros solo los guardamos y procesamos para prestarte el servicio, siguiendo tus instrucciones.
      </p>

      <h2 className={styles.legalTitulo}>Qué datos guardamos y para qué</h2>
      <div className={styles.legalTabla}>
        <table>
          <thead>
            <tr>
              <th scope="col">Dato</th>
              <th scope="col">Qué incluye</th>
              <th scope="col">Para qué</th>
            </tr>
          </thead>
          <tbody>
            {DATOS.map((d) => (
              <tr key={d.que}>
                <th scope="row">{d.que}</th>
                <td>{d.detalle}</td>
                <td>{d.para}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        No pedimos ni guardamos tu contraseña de Google: el inicio de sesión lo hace Google y a nosotros solo nos
        confirma quién sos. Tampoco guardamos datos de tarjetas.
      </p>

      <h2 className={styles.legalTitulo}>Quién puede verlos</h2>
      <ul className={styles.legalLista}>
        <li>
          <strong>Las personas de tu empresa</strong>, según su rol (dueño, administrador o vendedor). La base de datos
          impide que alguien de otra empresa vea tus productos, precios, clientes o facturas.
        </li>
        <li>
          <strong>Nuestro equipo</strong>, solo cuando hace falta para darte soporte, resolver una falla o cumplir una
          obligación legal.
        </li>
        <li>
          <strong>Proveedores de infraestructura</strong> que alojan el sistema por nosotros: Supabase (base de datos,
          inicio de sesión y fotos) y el servicio donde se aloja el sitio web. Procesan los datos solo para hacer
          funcionar Wake Parts.
        </li>
        <li>
          <strong>Autoridades</strong>, únicamente si una ley u orden judicial nos obliga.
        </li>
      </ul>
      <p>
        El catálogo público de productos, cuando lo actives, muestra solo lo que tu empresa decida publicar (nombre,
        foto, precio, compatibilidad). Nunca muestra clientes, costos ni facturas.
      </p>

      <h2 className={styles.legalTitulo}>Seguridad</h2>
      <p>
        Toda la comunicación viaja cifrada (HTTPS). El acceso a los datos de cada empresa se controla en la propia base
        de datos, no solo en la pantalla, y cada factura y movimiento de inventario queda registrado con el usuario que
        lo hizo.
      </p>

      <h2 className={styles.legalTitulo}>Registro de actividad</h2>
      <p>
        Para proteger tu cuenta y poder investigar fallas, Wake Parts guarda un registro de lo que pasa en el sistema:
        visitas a las páginas, inicios y cierres de sesión, errores y cambios de datos, con la dirección IP y el tipo
        de dispositivo. Esto se hace en nuestros servidores, <strong>sin cookies ni rastreadores</strong> de terceros, y
        no se usa para publicidad.
      </p>
      <ul className={styles.legalLista}>
        <li>
          <strong>El dueño y los administradores</strong> de tu empresa ven los inicios de sesión y los cambios de su
          empresa (quién, cuándo, desde qué IP y dispositivo).
        </li>
        <li>
          <strong>Nuestro equipo</strong> ve todo el registro, incluidas las visitas de personas sin sesión, solo para
          seguridad, soporte y mejorar el servicio.
        </li>
        <li>Nadie puede editar el registro; solo se borra al vencer su plazo.</li>
      </ul>

      <h2 className={styles.legalTitulo}>Cuánto tiempo los guardamos</h2>
      <p>
        Mientras tu empresa use Wake Parts. Las facturas y su numeración CAI se conservan aunque se anulen, porque son
        documentos fiscales. Si dejás de usar el servicio, podés pedirnos una copia de tus datos y que los borremos,
        salvo lo que una ley nos obligue a conservar. En el registro de actividad, las visitas se guardan hasta 6 meses y
        el resto (sesiones, errores y cambios) hasta 2 años.
      </p>

      <h2 className={styles.legalTitulo}>Tus derechos</h2>
      <p>
        Podés ver y corregir los datos de tu cuenta en <strong>Mi usuario</strong> y los de tu empresa en{" "}
        <strong>Taller</strong>. Para pedir una copia, la eliminación de tu cuenta o de tu empresa, o para oponerte a
        algún uso, escribinos a <a href={`mailto:${CONTACTO.email}`}>{CONTACTO.email}</a>. Si un cliente tuyo te pide lo
        mismo sobre sus datos, podés corregirlos desde Ventas › Clientes o pedirnos ayuda.
      </p>

      <h2 className={styles.legalTitulo}>Cookies</h2>
      <p>
        Usamos solo las cookies necesarias para la sesión y una de preferencia para tus colores. El detalle está en la{" "}
        <Link href="/cookies">política de cookies</Link>.
      </p>

      <h2 className={styles.legalTitulo}>Menores de edad</h2>
      <p>Wake Parts es una herramienta para negocios y no está dirigida a menores de 18 años.</p>

      <h2 className={styles.legalTitulo}>Cambios</h2>
      <p>
        Si cambiamos esta política de forma importante, lo vamos a avisar en el sistema o por correo antes de que
        aplique. La fecha de arriba indica la última actualización.
      </p>
    </PaginaLegal>
  );
}
