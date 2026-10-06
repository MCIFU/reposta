import type { Metadata } from 'next';
import Link from 'next/link';
import { AppNav } from '@/components/AppNav';
import { nationalSummary } from '@/server/repository';
import { getBulletin, WOB_PAGE } from '@/server/oil-bulletin';
import vehicles from '@/data/vehicles.json';
import { FUELS } from '@reposta/core';
import { clock, dayMonth, integer, price } from '@/lib/format';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Datos y metodología',
  description: 'De dónde salen los precios de REPOSTA, cada cuánto se actualizan y cómo calculamos medias, ahorros y viajes.',
};
export const dynamic = 'force-dynamic';

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Madrid' }).format(new Date(iso));

export default async function DataPage() {
  const [s, wob] = await Promise.all([nationalSummary().catch(() => null), getBulletin().catch(() => null)]);
  const fuelsWithPrice = s ? FUELS.filter((f) => s.national[f.code]?.count).length : null;
  const v = vehicles as { source: { generatedAt: string }; vehicles: Array<{ make: string }> };

  const sources = [
    {
      name: 'Precios por gasolinera',
      org: 'Ministerio para la Transición Ecológica y el Reto Demográfico (MITECO)',
      use: 'Precio actual de cada estación, marca, dirección, coordenadas y horario. Histórico diario de los gráficos de 30 días.',
      freq: 'Cada 30 minutos aproximadamente',
      status: s ? `Último dato: ${dayMonth(s.meta.sourceTime)} a las ${clock(s.meta.sourceTime)}${s.meta.stale ? ' (sin actualizar)' : ''}` : 'Sin conexión ahora mismo',
      ok: !!s && !s.meta.stale,
      license: 'Información del sector público reutilizable citando la fuente (Ley 37/2007)',
      url: 'https://geoportalgasolineras.es',
    },
    {
      name: 'Histórico nacional',
      org: 'Comisión Europea, Weekly Oil Bulletin',
      use: 'Precio medio oficial semanal de España desde 2005, con y sin impuestos (pestaña Histórico).',
      freq: 'Semanal',
      status: wob ? `Última semana publicada: ${fmtDate(wob.lastWeek)}` : 'Sin conexión ahora mismo',
      ok: !!wob,
      license: 'Política de reutilización de la Comisión (CC BY 4.0)',
      url: WOB_PAGE,
    },
    {
      name: 'Consumo de los coches',
      org: 'Agencia Europea de Medio Ambiente (EEA)',
      use: `Consumo homologado WLTP de ${integer(v.vehicles.length)} versiones de ${new Set(v.vehicles.map((x) => x.make)).size} marcas matriculadas en España entre 2021 y 2024 (pestaña Viaje).`,
      freq: 'Anual',
      status: `Catálogo generado el ${fmtDate(v.source.generatedAt)}`,
      ok: true,
      license: 'Datos abiertos de la EEA (CC BY 4.0)',
      url: 'https://www.eea.europa.eu/en/datahub/datahubitem-view/fa8b1229-3db6-495d-b18e-9c9b3267c02b',
    },
    {
      name: 'Direcciones y códigos postales',
      org: 'CartoCiudad, Instituto Geográfico Nacional',
      use: 'Buscador de ciudades, códigos postales y calles, y nombre de la calle cuando usas tu ubicación.',
      freq: 'Continua',
      status: 'Consulta en el momento',
      ok: true,
      license: '© Instituto Geográfico Nacional (CC BY 4.0)',
      url: 'https://www.cartociudad.es',
    },
    {
      name: 'Mapa y rutas',
      org: 'OpenStreetMap, vía OpenFreeMap (mapa) y OpenRouteService (rutas)',
      use: 'Mapa base con estilo propio de REPOSTA y cálculo de kilómetros y tiempo de los viajes.',
      freq: 'Continua',
      status: 'Consulta en el momento',
      ok: true,
      license: '© colaboradores de OpenStreetMap (ODbL)',
      url: 'https://www.openstreetmap.org/copyright',
    },
  ];

  return (
    <div className={styles.page}>
      <AppNav />
      <main className={styles.main}>
        <h1 className={styles.title}>Datos</h1>
        <p className={styles.lead}>Todos los precios de REPOSTA son oficiales. Ninguno es estimado ni lo aporta un usuario, y cada cifra dice de dónde sale y de cuándo es.</p>

        {s && (
          <dl className={styles.kpis}>
            <div><dt>Gasolineras con precio hoy</dt><dd className="num">{integer(s.stations)}</dd></div>
            <div><dt>Combustibles con precio</dt><dd className="num">{fuelsWithPrice}</dd></div>
            <div><dt>Media de gasolina 95 hoy</dt><dd className="num">{s.national.g95 ? price(s.national.g95.avg) : '—'}</dd></div>
            <div><dt>Histórico diario oficial</dt><dd className="num">desde 2007</dd></div>
          </dl>
        )}

        <section className={styles.section} aria-labelledby="fuentes">
          <h2 id="fuentes">Fuentes</h2>
          <ul className={styles.sources}>
            {sources.map((x) => (
              <li key={x.name} className={styles.source}>
                <div className={styles.sHead}>
                  <h3>{x.name}</h3>
                  <p className={styles.status} data-ok={x.ok || undefined}><span aria-hidden="true" />{x.status}</p>
                </div>
                <p className={styles.org}>{x.org}</p>
                <p>{x.use}</p>
                <dl className={styles.meta}>
                  <div><dt>Actualización</dt><dd>{x.freq}</dd></div>
                  <div><dt>Licencia</dt><dd>{x.license}</dd></div>
                  <div><dt>Web</dt><dd><a href={x.url} target="_blank" rel="noopener">{new URL(x.url).hostname.replace('www.', '')}</a></dd></div>
                </dl>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.section} aria-labelledby="calculos">
          <h2 id="calculos">Cómo calculamos</h2>
          <div className={styles.methods}>
            <article>
              <h3>Medias de REPOSTA</h3>
              <p>Media de todas las gasolineras que venden ese combustible, sin el 2 % más barato ni el 2 % más caro, para que un error de una estación no distorsione el dato. No está ponderada por ventas porque esa información no es pública. Siempre la etiquetamos como «calculada por REPOSTA».</p>
            </article>
            <article>
              <h3>¿Me compensa?</h3>
              <p className={styles.formula}>ahorro neto = litros × diferencia de precio − coste de ir y volver</p>
              <p>Comparamos con la gasolinera más cercana. Las distancias de la lista son estimadas (≈): línea recta multiplicada por un factor de carretera.</p>
            </article>
            <article>
              <h3>Viajes</h3>
              <p className={styles.formula}>litros = km × consumo / 100 · coste = litros × precio</p>
              <p>Los kilómetros y el tiempo salen de una ruta real por carretera. El consumo de cada coche es el homologado WLTP; el real suele ser algo mayor, por eso puedes ajustarlo. El precio por defecto es la media de las gasolineras cercanas a tu ruta.</p>
            </article>
            <article>
              <h3>Histórico</h3>
              <p>El gráfico de cada gasolinera usa el precio oficial de MITECO vigente a las 00:00 de cada día. La pestaña Histórico usa la media semanal oficial de la Comisión Europea, que es una serie distinta.</p>
            </article>
          </div>
        </section>

        <p className={styles.back}><Link href="/">Ver los precios de hoy</Link> · <Link href="/privacidad">Política de privacidad</Link></p>
      </main>
    </div>
  );
}
