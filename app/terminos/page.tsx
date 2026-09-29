import type { Metadata } from "next";
import Link from "next/link";
import { PaginaLegal } from "../_publico/legal";
import styles from "../_publico/publico.module.css";
import { CONTACTO, RESPONSABLE } from "@/lib/sitio";

export const metadata: Metadata = {
  title: "Términos de uso",
  description:
    "Condiciones para usar Wake Parts: es una demo de lo que podemos ofrecerle a tu negocio; el precio, el soporte 24/7 y los ajustes se acuerdan directamente con nosotros.",
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
          Wake Parts, tal como está publicado, es una <strong>demo</strong> de lo que te podemos ofrecer. Podés usarla
          gratis para probar. Para usarlo en tu negocio acordamos juntos el precio, el soporte 24/7 y los ajustes que
          necesités.
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

      <h2 className={styles.legalTitulo}>Es una demo</h2>
      <ul className={styles.legalLista}>
        <li>
          La versión publicada sirve para que conozcás el sistema y lo probés con tus datos o con los productos de
          ejemplo. Se ofrece <strong>tal cual</strong>, sin costo y sin garantía de disponibilidad.
        </li>
        <li>Puede cambiar, recibir mejoras o tener interrupciones mientras la seguimos desarrollando.</li>
        <li>
          Si querés usarla para facturar de verdad en tu negocio, <strong>hablemos antes</strong>: acordamos tu versión
          y las condiciones del servicio por escrito.
        </li>
      </ul>

      <h2 className={styles.legalTitulo}>Tu versión para el negocio</h2>
      <ul className={styles.legalLista}>
        <li>
          <strong>Precio a tu medida:</strong> no hay tarifas publicadas; lo definimos entre nosotros según tus
          sucursales, usuarios, ajustes y el acompañamiento que necesités.
        </li>
        <li>
          <strong>Soporte 24/7</strong> por WhatsApp y correo.
        </li>
        <li>
          <strong>Ajustes para tu negocio:</strong> formatos de documentos, reportes, campos, flujos o integraciones,
          según lo que acordemos.
        </li>
      </ul>
      <p>
        Las condiciones de ese servicio (precio, alcance, tiempos) quedan en el acuerdo que firmemos, y en lo que se
        contradiga con estos términos, manda ese acuerdo. Escribinos al WhatsApp{" "}
        <a href={CONTACTO.whatsappUrl} target="_blank" rel="noopener noreferrer">
          {CONTACTO.whatsapp}
        </a>{" "}
        o a <a href={CONTACTO.emailUrl}>{CONTACTO.email}</a>.
      </p>

      <h2 className={styles.legalTitulo}>Tu cuenta y tu equipo</h2>
      <ul className={styles.legalLista}>
        <li>Entrás con tu cuenta de Google; cuidá su acceso, porque todo lo que se haga con ella queda a tu nombre.</li>
        <li>
          El dueño de la empresa decide a quién invita y con qué rol, y responde por lo que hagan los usuarios de su
          empresa.
        </li>
        <li>Los datos que registrés tienen que ser verdaderos y tenés que tener derecho a usarlos.</li>
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
        pedirnos una copia en cualquier momento.
      </p>

      <h2 className={styles.legalTitulo}>Propiedad del sistema</h2>
      <p>
        El software, el diseño, la marca Wake Parts y el catálogo de vehículos son de {RESPONSABLE}. Usarlos no te da
        ningún derecho sobre ellos más allá de usar el servicio.
      </p>

      <h2 className={styles.legalTitulo}>Responsabilidad</h2>
      <p>
        Hacemos lo posible para que Wake Parts funcione bien y tus datos estén seguros, pero en la demo no garantizamos
        que esté libre de errores o siempre disponible. En la medida que la ley lo permita, no respondemos por pérdidas
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
