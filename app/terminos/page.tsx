import type { Metadata } from "next";
import Link from "next/link";
import { PaginaLegal } from "../_publico/legal";
import styles from "../_publico/publico.module.css";
import { CONTACTO, RESPONSABLE } from "@/lib/sitio";

export const metadata: Metadata = {
  title: "Términos de uso",
  description:
    "Condiciones para usar Wake Parts: planes y precios, cuenta y equipo, obligaciones fiscales, uso aceptable, tus datos y responsabilidad.",
  alternates: { canonical: "/terminos" },
  openGraph: { url: "/terminos" },
};

export default function Terminos() {
  return (
    <PaginaLegal
      ruta="/terminos"
      titulo={
        <>
          Términos
          <br />
          de uso<span className="text-wp-accent">.</span>
        </>
      }
      resumen={
        <>
          Estas condiciones regulan el uso de Wake Parts. Podés empezar con 7 días de prueba y después elegir el plan
          Gratis o uno de pago; los precios vigentes están en la <Link href="/#precios">sección de precios</Link>.
        </>
      }
    >
      <h2 className={styles.legalTitulo}>Quiénes somos</h2>
      <p>
        Wake Parts es un sistema de inventario, cotizaciones y facturación para repuestos, yonkers y talleres de
        Honduras, ofrecido por <strong>{RESPONSABLE}</strong>. Al entrar con tu cuenta de Google y registrar tu empresa
        aceptás estos términos, la <Link href="/privacidad">política de privacidad</Link> y la{" "}
        <Link href="/cookies">política de cookies</Link>.
      </p>

      <h2 className={styles.legalTitulo}>Planes y precios</h2>
      <ul className={styles.legalLista}>
        <li>
          Los planes, sus precios, límites, módulos y soporte están publicados en la{" "}
          <Link href="/#precios">sección de precios</Link> y en el módulo Suscripción del sistema.
        </li>
        <li>
          Cada empresa nueva empieza con <strong>7 días de prueba</strong> con todo incluido. Al terminar puede seguir en
          el plan Gratis, con sus límites, o contratar un plan de pago.
        </li>
        <li>
          Los planes de pago se cobran por adelantado con tarjeta, al mes o al año, y se renuevan solos al final de cada
          periodo hasta que se cancelen. El cobro lo procesa n1co; Wake Parts no guarda los datos de tu tarjeta.
        </li>
        <li>
          Solo el dueño de la empresa contrata, cambia o cancela el plan. Al cancelar, la empresa conserva su plan hasta
          el fin del periodo pagado y después pasa a Gratis, sin perder sus datos.
        </li>
        <li>
          Si cambiamos un precio, te lo avisamos antes de que se aplique a tu siguiente renovación.
        </li>
      </ul>
      <p>
        Las empresas que necesiten condiciones especiales (varias sucursales, ajustes a la medida o acompañamiento) pueden
        acordarlas con nosotros en un contrato por escrito; en lo que ese contrato contradiga estos términos, manda el
        contrato. Escribinos al WhatsApp{" "}
        <a href={CONTACTO.whatsappUrl} target="_blank" rel="noopener noreferrer">
          {CONTACTO.whatsapp}
        </a>{" "}
        o a <a href={CONTACTO.emailUrl}>{CONTACTO.email}</a>.
      </p>

      <h2 className={styles.legalTitulo}>Tu cuenta y tu equipo</h2>
      <ul className={styles.legalLista}>
        <li>
          El acceso a Wake Parts se hace con una cuenta de Google. Sos responsable de mantenerla segura: las acciones
          realizadas con ella se consideran hechas por vos.
        </li>
        <li>
          Quien registra la empresa queda como su <strong>dueño</strong>. El dueño autoriza a los usuarios, les asigna
          un rol y responde por el uso que hagan del sistema en nombre de la empresa.
        </li>
        <li>
          La información que se registre debe ser veraz, y la empresa debe contar con el derecho o la autorización para
          tratarla, incluidos los datos de sus clientes.
        </li>
        <li>
          Si sospechás que alguien entró sin permiso a tu cuenta o a la de tu empresa, avisanos de inmediato para
          ayudarte a protegerla.
        </li>
      </ul>

      <h2 className={styles.legalTitulo}>Facturación y obligaciones fiscales</h2>
      <p>
        Wake Parts te ayuda a llevar la numeración de tus facturas dentro del CAI que te autorizó el SAR, pero{" "}
        <strong>no es una entidad del SAR</strong> ni reemplaza a tu contador. Vos sos responsable de solicitar tu CAI,
        registrarlo correctamente, revisar tus documentos y cumplir con tus obligaciones fiscales. Confirmá con tu
        contador los requisitos de tu régimen.
      </p>

      <h2 className={styles.legalTitulo}>Uso aceptable</h2>
      <p>No podés usar Wake Parts para:</p>
      <ul className={styles.legalLista}>
        <li>Actividades ilegales, fraude o emitir documentos falsos.</li>
        <li>Intentar ver datos de otras empresas, saltarte los permisos o atacar el sistema.</li>
        <li>Subir contenido que no te pertenece o que infrinja derechos de terceros.</li>
        <li>Revender, copiar o hacer ingeniería inversa del sistema sin nuestro permiso.</li>
      </ul>
      <p>Si detectamos un uso así, podemos suspender el acceso de la cuenta o de la empresa.</p>

      <h2 className={styles.legalTitulo}>Tus datos</h2>
      <p>
        Los productos, clientes, precios y documentos que registrás son <strong>de tu empresa</strong>. Los usamos solo
        para prestarte el servicio, como explica la <Link href="/privacidad">política de privacidad</Link>. Podés
        descargar una copia de tus datos en cualquier momento desde Taller › Datos (dueño o administrador).
      </p>

      <h2 className={styles.legalTitulo}>Propiedad del sistema</h2>
      <p>
        El software, el diseño, la marca Wake Parts y el catálogo de vehículos son de {RESPONSABLE}. Usarlos no te da
        ningún derecho sobre ellos más allá de usar el servicio.
      </p>

      <h2 className={styles.legalTitulo}>Responsabilidad</h2>
      <p>
        Hacemos lo posible para que Wake Parts funcione bien y tus datos estén seguros, pero no garantizamos que el
        servicio esté libre de errores o disponible sin interrupciones. En la medida que la ley lo permita, no respondemos por pérdidas
        indirectas, ventas no realizadas ni por decisiones tomadas con base en la información del sistema. Revisá tus
        documentos antes de entregarlos.
      </p>

      <h2 className={styles.legalTitulo}>Cambios y ley aplicable</h2>
      <p>
        Podemos actualizar estos términos; si el cambio es importante lo vamos a avisar antes de que aplique. Estos
        términos se rigen por las leyes de la República de Honduras.
      </p>
    </PaginaLegal>
  );
}
