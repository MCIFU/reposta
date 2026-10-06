'use client';
import { useEffect, useState } from 'react';
import { computeSavings, directionsUrl, getFuel, type SavingsResult } from '@reposta/core';
import type { NearbyResult, NearbyStation } from '@/server/repository';
import { BrandPrice } from '../Brand';
import { price, eur, signedEur, km, minutes, ago, clock, cents } from '@/lib/format';
import type { TripPrefs } from '@/lib/prefs';
import styles from './Results.module.css';

export type Sort = 'price' | 'distance';

export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function Updated({ iso, stale }: { iso: string; stale?: boolean }) {
  const now = useNow();
  return (
    <span className={styles.updated} data-stale={stale || undefined}>
      <time dateTime={iso} title={`Dato publicado por MITECO a las ${clock(iso)}`}>Precios oficiales {ago(iso, now)}</time>
      {stale && <span>. No se ha podido actualizar; puede haber cambios.</span>}
    </span>
  );
}

function savingsFor(s: NearbyStation, ref: NearbyStation | null, prefs: TripPrefs): SavingsResult | null {
  if (!ref || ref.id === s.id) return null;
  return computeSavings({
    quantity: prefs.liters, consumptionPer100: prefs.consumption,
    candidate: { id: s.id, pricePerUnit: s.priceMilli / 1000, distanceKm: s.roadKmApprox },
    reference: { id: ref.id, pricePerUnit: ref.priceMilli / 1000, distanceKm: ref.roadKmApprox },
  });
}

function band(p: number, r: NearbyResult): 0 | 1 | 2 {
  const st = r.stats;
  if (!st || st.count < 4) return 1;
  // Unificado con core/stats (p10-p90) y docs/04: misma estación, mismo color en lista y mapa.
  // Si p10==p90 (zona con precio casi idéntico), cae al tercil min-max como respaldo.
  if (st.p10 < st.p90) return p <= st.p10 ? 0 : p >= st.p90 ? 2 : 1;
  const lo = st.min + (st.max - st.min) / 3, hi = st.min + (2 * (st.max - st.min)) / 3;
  return p <= lo ? 0 : p >= hi ? 2 : 1;
}

function Verdict({ s }: { s: SavingsResult | null }) {
  if (!s) return <span className={styles.tag} data-k="ref">La más cercana</span>;
  if (s.verdict === 'worth_it') return <span className={styles.tag} data-k="yes">Compensa {signedEur(s.netSaving)}</span>;
  if (s.verdict === 'indifferent') return <span className={styles.tag} data-k="eq">Da igual</span>;
  return <span className={styles.tag} data-k="no">No compensa</span>;
}

export function Best({ r, prefs, onOpen, onEditPrefs }: { r: NearbyResult; prefs: TripPrefs; onOpen: (id: number) => void; onEditPrefs: () => void }) {
  const c = r.cheapest!;
  const n = r.nearest!;
  const unit = getFuel(r.fuel)?.unit ?? 'L';
  const s = savingsFor(c, n, prefs);
  return (
    <section className={styles.best} aria-labelledby="best-title">
      <h2 id="best-title" className="sr-only">La más barata en {r.radiusKm} km</h2>
      <button type="button" className={styles.bestBtn} onClick={() => onOpen(c.id)}>
        <BrandPrice milli={c.priceMilli} unit={unit} />
        <span className={styles.bestWhere}>
          <strong>{c.brand}</strong> a {km(c.roadKmApprox)}<span className={styles.approx}> (≈ {minutes(c.minutesApprox)})</span>
          <span className={styles.bestAddr}>{c.address}, {c.locality}</span>
        </span>
      </button>
      <div className={styles.answer} data-k={s ? s.verdict : 'ref'}>
        {!s && <p><strong>Es también la más cercana.</strong> No hay nada que pensar.</p>}
        {s?.verdict === 'worth_it' && (
          <p><strong>Compensa ir.</strong> Frente a la más cercana ({n.brand}, {price(n.priceMilli)} a {km(n.roadKmApprox)}) ahorras {eur(s.netSaving)} netos en {prefs.liters} {unit === 'L' ? 'litros' : unit}, ya descontado el trayecto.</p>
        )}
        {s?.verdict === 'indifferent' && (
          <p><strong>Da igual.</strong> Ahorras {eur(s.grossSaving)} en el precio, pero ir y volver te cuesta {eur(s.travelCost)}. La más cercana ({n.brand}, a {km(n.roadKmApprox)}) te sale prácticamente igual.</p>
        )}
        {s?.verdict === 'not_worth_it' && (
          <p><strong>No compensa ir.</strong> Ahorras {eur(s.grossSaving)} en el precio, pero ir y volver te cuesta {eur(s.travelCost)}. Mejor la más cercana: {n.brand}, {price(n.priceMilli)} a {km(n.roadKmApprox)}.</p>
        )}
        <button type="button" className={styles.prefs} onClick={onEditPrefs}>
          Calculado para {prefs.liters} {unit === 'L' ? 'L' : unit} y {String(prefs.consumption).replace('.', ',')} L/100 km. Cambiar
        </button>
      </div>
    </section>
  );
}

export function Controls({
  r, sort, onSort, radius, onRadius, openOnly, onOpenOnly,
}: { r: NearbyResult; sort: Sort; onSort: (s: Sort) => void; radius: number; onRadius: (n: number) => void; openOnly: boolean; onOpenOnly: (v: boolean) => void }) {
  return (
    <div className={styles.controls}>
      <p className={styles.summary}>
        <strong>{r.total}</strong> {r.total === 1 ? 'gasolinera' : 'gasolineras'} en {r.radiusKm} km
        {r.stats && r.total > 1 && <>, de <span className="num">{price(r.stats.min)}</span> a <span className="num">{price(r.stats.max)}</span> ({cents(r.stats.max - r.stats.min)} de diferencia)</>}
      </p>
      <div className={styles.row}>
        <div className={styles.seg} role="radiogroup" aria-label="Ordenar por">
          {(['price', 'distance'] as const).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={sort === k} onClick={() => onSort(k)}>{k === 'price' ? 'Precio' : 'Distancia'}</button>
          ))}
        </div>
        <label className={styles.select}>
          <span className="sr-only">Radio de búsqueda</span>
          <select value={radius} onChange={(e) => onRadius(Number(e.target.value))}>
            {[3, 5, 10, 20, 30, 50].map((n) => <option key={n} value={n}>{n} km</option>)}
          </select>
        </label>
        <label className={styles.check}>
          <input type="checkbox" checked={openOnly} onChange={(e) => onOpenOnly(e.target.checked)} />
          <span>Abiertas ahora</span>
        </label>
      </div>
    </div>
  );
}

export function StationList({ r, prefs, selectedId, onOpen }: { r: NearbyResult; prefs: TripPrefs; selectedId: number | null; onOpen: (id: number) => void }) {
  return (
    <ol className={styles.list} aria-label="Gasolineras">
      {r.stations.map((s) => {
        const sv = savingsFor(s, r.nearest, prefs);
        return (
          <li key={s.id} className={styles.item} data-sel={selectedId === s.id || undefined}>
            <button type="button" className={styles.itemBtn} onClick={() => onOpen(s.id)} aria-label={`${s.brand}, ${price(s.priceMilli)} euros, a ${km(s.roadKmApprox)}`}>
              <span className={styles.name}>{s.brand}</span>
              <span className={styles.addr}>{s.address}{s.locality && s.locality.toLowerCase() !== s.municipality.toLowerCase() ? `, ${s.locality}` : ''}</span>
              <span className={styles.meta}>
                <span>{km(s.roadKmApprox)}</span>
                <span className={styles.open} data-open={s.openNow === true || undefined} data-closed={s.openNow === false || undefined}>
                  {s.is24h ? '24 h' : s.openNow === true ? 'Abierta' : s.openNow === false ? 'Cerrada ahora' : s.scheduleRaw || 'Horario no disponible'}
                </span>
                <Verdict s={sv} />
              </span>
              <span className={`${styles.price} num`} data-band={band(s.priceMilli, r)}>{price(s.priceMilli)}</span>
            </button>
            <a className={styles.go} href={directionsUrl(s, r.origin)} target="_blank" rel="noopener" aria-label={`Cómo llegar a ${s.brand}, ${s.address}`}>
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2.2 17.8 10 10 17.8 2.2 10Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M7.6 11.6V9.4h4.2M10.4 7.6l1.8 1.8-1.8 1.8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </a>
          </li>
        );
      })}
    </ol>
  );
}

export function ResultsSkeleton() {
  return (
    <div className={styles.skel} aria-busy="true" aria-label="Buscando gasolineras">
      <div className="skeleton" style={{ height: 76, width: '62%' }} />
      <div className="skeleton" style={{ height: 14, width: '48%', marginTop: 16 }} />
      <div className="skeleton" style={{ height: 64, marginTop: 20, borderRadius: 16 }} />
      {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 58, marginTop: 14, opacity: 1 - i * 0.18 }} />)}
    </div>
  );
}
