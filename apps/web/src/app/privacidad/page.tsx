import type { Metadata } from 'next';
import Link from 'next/link';
import { AppNav } from '@/components/AppNav';
import styles from '../datos/page.module.css';

export const metadata: Metadata = {
  title: 'Política de privacidad',
  description: 'Qué datos usa REPOSTA, para qué y dónde se guardan.',
};

const CONTACT = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
const OWNER = process.env.NEXT_PUBLIC_OWNER_NAME;
const UPDATED = '6 de octubre de 2026';

export default function PrivacyPage() {
  return (
    <div className={styles.page}>
      <AppNav />
      <main className={styles.main}>
        <h1 className={styles.title} style={{ fontSize: 'clamp(2.2rem, 8vw, 3.6rem)' }}>Privacidad</h1>
        <p className={styles.lead}>REPOSTA no tiene cuentas de usuario, no usa cookies ni publicidad y no vende ni comparte datos. Lo poco que guarda se queda en tu dispositivo.</p>
        <p style={{ color: 'var(--ink-2)', fontSize: 'var(--t-sm)' }}>Última actualización: {UPDATED}.</p>

        <section className={styles.section}>
          <h2>Responsable</h2>
          <p>{OWNER ?? 'Titular de REPOSTA'}{CONTACT ? <>. Contacto: <a href={`mailto:${CONTACT}`} style={{ color: 'var(--brand)' }}>{CONTACT}</a></> : null}.</p>
        </section>

        <section className={styles.section}>
          <h2>Tu ubicación</h2>
          <p>Solo se usa si pulsas «Mi ubicación» y das permiso en tu navegador o en Android. Las coordenadas se envían a nuestro servidor únicamente para buscar las gasolineras cercanas y el nombre de la calle (este último se consulta a CartoCiudad, del Instituto Geográfico Nacional). No guardamos tu ubicación en el servidor ni la asociamos a ninguna persona. Puedes retirar el permiso cuando quieras en los ajustes del navegador o del teléfono.</p>
        </section>

        <section className={styles.section}>
          <h2>Lo que se guarda en tu dispositivo</h2>
          <p>Para que no tengas que repetir nada, REPOSTA guarda en el almacenamiento local de tu navegador: el combustible elegido, el último lugar buscado, los litros y el consumo para «¿Me compensa?», tu coche y la capacidad del depósito, el modo claro u oscuro y tus alertas de precio con sus avisos. Nada de esto sale de tu dispositivo salvo lo necesario para comprobar las alertas (el identificador de la gasolinera o el punto y el radio de la zona). Puedes borrarlo todo eliminando los datos del sitio en tu navegador o desinstalando la app.</p>
        </section>

        <section className={styles.section}>
          <h2>Viajes</h2>
          <p>Cuando calculas un viaje, las coordenadas del origen, las paradas y el destino se envían a nuestro servidor y, desde él, a un servicio de rutas basado en OpenStreetMap, solo para obtener los kilómetros y el tiempo. No se guardan.</p>
        </section>

        <section className={styles.section}>
          <h2>Servicios de terceros</h2>
          <p>El mapa se descarga de OpenFreeMap, que, como cualquier servidor web, recibe tu dirección IP al servir las imágenes del mapa. Los precios proceden del Ministerio para la Transición Ecológica y el histórico de la Comisión Europea; esas consultas las hace nuestro servidor, no tu dispositivo. Las fuentes tipográficas se sirven desde nuestro propio dominio.</p>
        </section>

        <section className={styles.section}>
          <h2>Registros técnicos</h2>
          <p>Como cualquier web, el proveedor de alojamiento puede registrar de forma temporal datos técnicos de las peticiones (dirección IP, fecha y página) para seguridad y resolución de errores. No los usamos para identificarte ni para estadísticas comerciales.</p>
        </section>

        <section className={styles.section}>
          <h2>Tus derechos</h2>
          <p>Como no tenemos cuentas ni bases de datos de usuarios, no guardamos datos personales tuyos que podamos consultar o borrar. Aun así, puedes escribirnos{CONTACT ? <> a <a href={`mailto:${CONTACT}`} style={{ color: 'var(--brand)' }}>{CONTACT}</a></> : null} para cualquier consulta y, si lo consideras, reclamar ante la Agencia Española de Protección de Datos (aepd.es).</p>
        </section>

        <p className={styles.back}><Link href="/datos">Datos y fuentes</Link></p>
      </main>
    </div>
  );
}
