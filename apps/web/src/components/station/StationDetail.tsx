'use client';
import { useState } from 'react';
import { FUELS, directionsUrl, getFuel, haversineKm, estimateTrip, type Station, type LatLng, type PriceStats } from '@reposta/core';
import { BrandPrice } from '../Brand';
import { PriceHistory } from './PriceHistory';
import { Updated } from '../finder/Results';
import { price, km, minutes, cents } from '@/lib/format';
import { useAlerts, addAlert, removeAlert } from '@/lib/alerts';
import styles from './StationDetail.module.css';

const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export interface StationPayload {
  meta: { sourceTime: string; stale: boolean };
  station: Station;
  openNow: boolean | null;
  national: Record<string, PriceStats>;
}

export function StationDetail({ data, fuel, origin, headingLevel = 2 }: { data: StationPayload; fuel: string; origin?: LatLng | null; headingLevel?: 1 | 2 }) {
  const s = data.station;
  const available = FUELS.filter((f) => s.prices[f.code] != null);
  const [active, setActive] = useState(s.prices[fuel] != null ? fuel : available[0]?.code ?? fuel);
  const H = headingLevel === 1 ? 'h1' : 'h2';
  const H3 = headingLevel === 1 ? 'h2' : 'h3';
  const unit = getFuel(active)?.unit ?? 'L';
  const nat = data.national[active];
  const trip = origin ? estimateTrip(haversineKm(origin, s)) : null;
  const diff = nat && s.prices[active] != null ? s.prices[active] - nat.avg : null;

  return (
    <article className={styles.wrap}>
      <header className={styles.head}>
        <H className={styles.title}>{s.brand}</H>
        <p className={styles.addr}>{s.address}<br />{s.postalCode} {s.locality}{s.municipality && s.municipality.toLowerCase() !== s.locality.toLowerCase() ? `, ${s.municipality}` : ''}</p>
        {!s.brandKnown && s.label && s.brand !== s.label && <p className={styles.label}>Rótulo registrado: {s.label}</p>}
      </header>

      {s.prices[active] != null && (
        <div className={styles.hero}>
          <BrandPrice milli={s.prices[active]} unit={unit} size="lg" />
          <p className={styles.heroSub}>
            {getFuel(active)?.name}
            {diff != null && (
              <> · {diff === 0 ? 'igual que la media de España' : `${cents(Math.abs(diff))} ${diff < 0 ? 'por debajo' : 'por encima'} de la media de España (${price(nat!.avg)})`}</>
            )}
          </p>
          <Updated iso={data.meta.sourceTime} stale={data.meta.stale} />
        </div>
      )}

      <div className={styles.actions}>
        <AlertButton stationId={s.id} fuel={active} label={`${s.brand}, ${s.locality}`} current={s.prices[active] ?? null} />
        <a className={styles.primary} href={directionsUrl(s, origin ?? undefined)} target="_blank" rel="noopener">
          Cómo llegar{trip && <span> · {km(trip.km)}, ≈ {minutes(trip.minutes)}</span>}
        </a>
      </div>

      <section className={styles.section} aria-labelledby={`fuels-${s.id}`}>
        <H3 id={`fuels-${s.id}`} className={styles.h3}>Combustibles</H3>
        <ul className={styles.fuels}>
          {available.map((f) => (
            <li key={f.code}>
              <button type="button" className={styles.fuel} aria-pressed={active === f.code} onClick={() => setActive(f.code)}>
                <span>{f.name}</span>
                <span className="num">{price(s.prices[f.code])} <small>€/{f.unit}</small></span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section} aria-label="Histórico de precio">
        <PriceHistory stationId={s.id} fuel={active} />
      </section>

      <section className={styles.section} aria-labelledby={`h-${s.id}`}>
        <H3 id={`h-${s.id}`} className={styles.h3}>
          Horario {data.openNow === true && <span className={styles.openNow}>Abierta ahora</span>}
          {data.openNow === false && <span className={styles.closedNow}>Cerrada ahora</span>}
        </H3>
        {s.schedule ? (
          <dl className={styles.hours}>
            {DAY_NAMES.map((n, i) => {
              const rules = s.schedule!.filter((r) => r.days.includes(i + 1));
              const txt = rules.length
                ? rules.flatMap((r) => r.ranges).map(([a, b]) => (a === 0 && b >= 1440 ? '24 horas' : `${fmt(a)}–${fmt(b % 1440)}`)).join(' y ')
                : 'Cerrado';
              return <div key={n}><dt>{n}</dt><dd>{txt}</dd></div>;
            })}
          </dl>
        ) : (
          <p className={styles.muted}>{s.scheduleRaw || 'La estación no ha comunicado su horario.'}</p>
        )}
      </section>

      <p className={styles.source}>Datos: Ministerio para la Transición Ecológica y el Reto Demográfico (MITECO). Identificador de estación {s.id}. Media de España calculada por REPOSTA con {nat?.count ?? 0} estaciones.</p>
    </article>
  );
}

const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

function AlertButton({ stationId, fuel, label, current }: { stationId: number; fuel: string; label: string; current: number | null }) {
  const st = useAlerts();
  const existing = st.alerts.find((a) => a.type === 'station' && a.stationId === stationId && a.fuel === fuel);
  return (
    <button
      type="button"
      className={styles.secondary}
      aria-pressed={!!existing}
      onClick={() => (existing ? removeAlert(existing.id) : addAlert({ type: 'station', stationId, fuel, label, mode: 'change', lastPrice: current }))}
    >
      {existing ? 'Alerta activa' : 'Avisarme si cambia'}
    </button>
  );
}
