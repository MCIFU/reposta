'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { getFuel, PRIMARY_FUELS } from '@reposta/core';
import { PlaceSearch, type PickedPlace } from '../finder/PlaceSearch';
import { CarPicker, type SavedCar } from './CarPicker';
import { useStored, DEFAULT_TRIP, type TripPrefs } from '@/lib/prefs';
import { price, eur, km as fmtKm, minutes, integer } from '@/lib/format';
import styles from './Trip.module.css';

const RouteMap = dynamic(() => import('./RouteMap'), { ssr: false, loading: () => <div className={styles.mapLoading}>Cargando mapa…</div> });

interface RouteStation { id: number; brand: string; address: string; locality: string; lat: number; lng: number; priceMilli: number; offRouteKm: number; atKm: number; openNow: boolean | null }
interface Plan {
  meta: { sourceTime: string; routing: string };
  distanceKm: number; durationMin: number;
  legs: Array<{ distanceKm: number; durationMin: number }>;
  geometry: Array<[number, number]>;
  corridorKm: number;
  stations: { count: number; stats: { avg: number; min: number; max: number } | null; cheapest: RouteStation[] };
  national: { avg: number } | null;
}
type Point = { key: number; place: PickedPlace | null };
const LETTERS = 'ABCDEFGHIJ';
const MAX_STOPS = 8;
const num = (s: string) => Number(s.replace(',', '.'));
const dec = (n: number, d = 1) => n.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d });

export function TripPlanner() {
  const [points, setPoints] = useState<Point[]>([{ key: 1, place: null }, { key: 2, place: null }]);
  const [roundTrip, setRoundTrip] = useState(false);
  const [car, setCar] = useStored<SavedCar | null>('rp-car', null);
  const [fuelSel, setFuelSel] = useState<string>('g95');
  const [consStr, setConsStr] = useState('');
  const [priceStr, setPriceStr] = useState('');
  const [tankStr, setTankStr] = useStored<string>('rp-tank', '');
  const [pax, setPax] = useState(1);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [err, setErr] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const seq = useRef(0);
  const nextKey = useRef(3);

  // Ruta compartible: /viaje?p=lat,lng,etiqueta|lat,lng,etiqueta&iv=1
  const urlRead = useRef(false);
  useEffect(() => {
    const u = new URLSearchParams(location.search);
    const raw = u.get('p');
    if (raw) {
      const pts = raw.split('|').map((x) => { const [la, ln, ...l] = x.split(','); return { lat: Number(la), lng: Number(ln), label: l.join(',').trim() || 'Punto' }; })
        .filter((x) => Number.isFinite(x.lat) && Number.isFinite(x.lng)).slice(0, MAX_STOPS + 2);
      if (pts.length >= 2) setPoints(pts.map((pl, i) => ({ key: 100 + i, place: { ...pl, source: 'search' as const } })));
    }
    if (u.get('iv') === '1') setRoundTrip(true);
    urlRead.current = true;
  }, []);
  useEffect(() => {
    if (!urlRead.current) return;
    const ps = points.map((p) => p.place);
    const q = new URLSearchParams();
    if (ps.every(Boolean) && ps.length >= 2) q.set('p', ps.map((p) => `${p!.lat.toFixed(5)},${p!.lng.toFixed(5)},${p!.label.replace(/\|/g, ' ')}`).join('|'));
    if (roundTrip) q.set('iv', '1');
    history.replaceState(null, '', q.toString() ? `/viaje?${q}` : '/viaje');
  }, [points, roundTrip]);

  // Consumo inicial: el de los ajustes de la pestaña Precios (6,5 L/100 km por defecto) hasta que se elija coche.
  const [tripPrefs, , prefsReady] = useStored<TripPrefs>('rp-trip', DEFAULT_TRIP);
  useEffect(() => { if (prefsReady && !consStr) setConsStr(dec(tripPrefs.consumption)); }, [prefsReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const version = car?.version ?? null;
  // El combustible sale del coche elegido (si lo hay); se puede cambiar (p. ej. 98 en un coche de gasolina).
  useEffect(() => { if (version) setFuelSel(version.fuel); }, [version?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (version) setConsStr(dec(version.l100)); }, [version?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const filled = points.map((p) => p.place).filter((p): p is PickedPlace => !!p);
  const complete = filled.length === points.length && points.length >= 2;
  const routeKey = complete ? JSON.stringify([filled.map((p) => [p.lat.toFixed(4), p.lng.toFixed(4)]), fuelSel]) : '';

  useEffect(() => {
    if (!complete) { setPlan(null); setStatus('idle'); return; }
    const my = ++seq.current;
    setStatus('loading'); setErr(null);
    fetch('/api/route', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ points: filled.map((p) => ({ lat: p.lat, lng: p.lng })), fuel: fuelSel }) })
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d as Plan; })
      .then((d) => { if (my === seq.current) { setPlan(d); setStatus('ready'); } })
      .catch((e) => { if (my === seq.current) { setErr(e.message || 'No se pudo calcular la ruta.'); setStatus('error'); } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey]);

  const setPlace = (key: number, place: PickedPlace | null) => setPoints((ps) => ps.map((p) => (p.key === key ? { ...p, place } : p)));
  const addStop = () => setPoints((ps) => (ps.length - 2 >= MAX_STOPS ? ps : [...ps.slice(0, -1), { key: nextKey.current++, place: null }, ps[ps.length - 1]]));
  const removeStop = (key: number) => setPoints((ps) => ps.filter((p) => p.key !== key));
  const swap = () => setPoints((ps) => [...ps].reverse());

  function locateOrigin() {
    if (!('geolocation' in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const p: PickedPlace = { lat: pos.coords.latitude, lng: pos.coords.longitude, label: 'Tu ubicación', source: 'gps' };
        setPlace(points[0].key, p);
        setLocating(false);
        try {
          const r = await fetch(`/api/geocode/reverse?lat=${p.lat}&lng=${p.lng}`).then((x) => x.json());
          if (r?.label) setPlace(points[0].key, { ...p, label: r.label });
        } catch {}
      },
      () => { setLocating(false); setErr('No se pudo obtener tu ubicación. Escribe el origen.'); },
      { timeout: 12_000, maximumAge: 120_000 },
    );
  }

  // Cálculo
  const fuel = getFuel(fuelSel)!;
  const consumption = num(consStr);
  const defaultPrice = plan?.stations.stats?.avg ?? plan?.national?.avg ?? null;
  const priceMilli = priceStr ? Math.round(num(priceStr) * 1000) : defaultPrice;
  const tank = num(tankStr);
  const calc = useMemo(() => {
    if (!plan || !(consumption > 0) || !priceMilli) return null;
    const f = roundTrip ? 2 : 1;
    const dist = plan.distanceKm * f;
    const liters = (dist * consumption) / 100;
    const cost = (liters * priceMilli) / 1000;
    const cheapest = plan.stations.cheapest[0];
    const saving = cheapest && plan.stations.stats ? (liters * (plan.stations.stats.avg - cheapest.priceMilli)) / 1000 : null;
    const range = tank > 0 ? (tank / consumption) * 100 : null;
    const refuels = range ? Math.max(0, Math.ceil(dist / range) - 1) : null;
    return { dist, time: plan.durationMin * f, liters, cost, perPax: cost / Math.max(1, pax), per100: (consumption * priceMilli) / 1000, saving, range, refuels };
  }, [plan, consumption, priceMilli, roundTrip, pax, tank]);

  return (
    <main className={styles.layout}>
      <h1 className="sr-only">Calculadora de viaje</h1>
      <div className={styles.side}>
      <div className={styles.panel}>
        <section aria-labelledby="ruta" className={styles.block}>
          <h2 id="ruta" className={styles.h2}>Ruta</h2>
          <ol className={styles.points}>
            {points.map((p, i) => {
              const isFirst = i === 0, isLast = i === points.length - 1;
              const role = isFirst ? 'Origen' : isLast ? 'Destino' : `Parada ${i}`;
              return (
                <li key={p.key} className={styles.point}>
                  <span className={styles.letter} aria-hidden="true">{LETTERS[i]}</span>
                  <div className={styles.pointField}>
                    <PlaceSearch
                      compact current={p.place} onPick={(pl) => setPlace(p.key, pl)}
                      onLocate={isFirst ? locateOrigin : undefined} locating={isFirst && locating}
                      placeholder={isFirst ? 'Desde dónde sales' : isLast ? 'A dónde vas' : 'Parada intermedia'} label={role}
                    />
                  </div>
                  {!isFirst && !isLast && (
                    <button type="button" className={styles.iconBtn} onClick={() => removeStop(p.key)} aria-label={`Quitar ${role.toLowerCase()}`}>
                      <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 6 8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
          <div className={styles.rowActions}>
            <button type="button" className={styles.ghostBtn} onClick={addStop} disabled={points.length - 2 >= MAX_STOPS}>Añadir parada</button>
            <button type="button" className={styles.ghostBtn} onClick={swap}>Invertir</button>
            <label className={styles.check}><input type="checkbox" checked={roundTrip} onChange={(e) => setRoundTrip(e.target.checked)} /> Ida y vuelta</label>
          </div>
        </section>

        <section aria-labelledby="coche" className={styles.block}>
          <h2 id="coche" className={styles.h2}>Tu coche</h2>
          <CarPicker value={car} onChange={setCar} />
        </section>

        <section aria-labelledby="calculo" className={styles.block}>
          <h2 id="calculo" className={styles.h2}>Cálculo</h2>
          <div className={styles.inputs}>
            <label className={styles.field}><span>Combustible</span>
              <select value={fuelSel} onChange={(e) => setFuelSel(e.target.value)}>
                {PRIMARY_FUELS.map((f) => <option key={f.code} value={f.code}>{f.name}</option>)}
              </select>
            </label>
            <label className={styles.field}><span>Consumo (L/100 km)</span>
              <input inputMode="decimal" value={consStr} placeholder="6,5" onChange={(e) => setConsStr(e.target.value)} />
            </label>
            <label className={styles.field}><span>Precio (€/{fuel.unit})</span>
              <input inputMode="decimal" value={priceStr} placeholder={defaultPrice ? price(defaultPrice) : '1,800'} onChange={(e) => setPriceStr(e.target.value)} />
            </label>
            <label className={styles.field}><span>Depósito (L, opcional)</span>
              <input inputMode="decimal" value={tankStr} placeholder="50" onChange={(e) => setTankStr(e.target.value)} />
            </label>
            <label className={styles.field}><span>Personas</span>
              <select value={pax} onChange={(e) => setPax(Number(e.target.value))}>{[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{n}</option>)}</select>
            </label>
          </div>
          <p className={styles.hint}>{version ? `Consumo homologado del ${version.make} ${version.model}; súbelo un poco si vas cargado o rápido.` : 'Consumo por defecto. Elige tu coche arriba o escribe el tuyo.'}</p>
          {defaultPrice && !priceStr && <p className={styles.hint}>Precio: media REPOSTA de las {plan?.stations.count} gasolineras a menos de {plan?.corridorKm} km de tu ruta. Puedes cambiarlo.</p>}
        </section>
      </div>


      <section className={styles.results} aria-live="polite" aria-labelledby="resultado">
        <h2 id="resultado" className="sr-only">Resultado del viaje</h2>
        {status === 'idle' && <p className={styles.empty}>Indica origen y destino para calcular el viaje. Puedes añadir hasta {MAX_STOPS} paradas.</p>}
        {status === 'loading' && <div aria-busy="true"><div className="skeleton" style={{ height: 64, width: '50%' }} /><div className="skeleton" style={{ height: 120, marginTop: 16 }} /></div>}
        {status === 'error' && <div className={styles.errorBox} role="alert"><p><strong>No se pudo calcular la ruta.</strong> {err}</p></div>}
        {status === 'ready' && plan && (
          <>
            <div className={styles.summary}>
              <div className={styles.bigCost}>
                {calc ? <><span className="num">{dec(calc.cost, 2)}</span><small>€</small></> : <span className={styles.noCost}>Falta el consumo</span>}
              </div>
              <p className={styles.sumText}>
                {calc ? <>de {fuel.name.toLowerCase()} para {integer(Math.round(calc.dist))} km{roundTrip ? ' (ida y vuelta)' : ''}{pax > 1 ? <>, <strong>{eur(calc.perPax)} por persona</strong></> : null}.</>
                  : <>Ruta de {integer(Math.round(plan.distanceKm * (roundTrip ? 2 : 1)))} km. Elige tu coche o escribe el consumo para ver el coste.</>}
              </p>
            </div>
            <dl className={styles.kpis}>
              <div><dt>Distancia</dt><dd className="num">{integer(Math.round(plan.distanceKm * (roundTrip ? 2 : 1)))} km</dd></div>
              <div><dt>Tiempo al volante</dt><dd className="num">{minutes(Math.round(plan.durationMin * (roundTrip ? 2 : 1)))}</dd></div>
              <div><dt>Combustible</dt><dd className="num">{calc ? `${dec(calc.liters)} ${fuel.unit}` : '—'}</dd></div>
              <div><dt>Coste cada 100 km</dt><dd className="num">{calc ? eur(calc.per100) : '—'}</dd></div>
              {calc?.range && <div><dt>Autonomía con el depósito</dt><dd className="num">{integer(Math.round(calc.range))} km</dd></div>}
              {calc?.refuels != null && <div><dt>Repostajes en ruta</dt><dd className="num">{calc.refuels === 0 ? 'Ninguno' : calc.refuels}</dd></div>}
            </dl>
            {calc?.refuels != null && <p className={styles.hint}>Saliendo con el depósito lleno y llegando a la reserva.</p>}

            {plan.legs.length > 1 && (
              <table className={styles.legs}>
                <caption className={styles.caption}>Tramos{roundTrip ? ' (solo ida)' : ''}</caption>
                <thead><tr><th scope="col">Tramo</th><th scope="col">Distancia</th><th scope="col">Tiempo</th>{calc && <th scope="col">Coste</th>}</tr></thead>
                <tbody>
                  {plan.legs.map((l, i) => (
                    <tr key={i}>
                      <th scope="row">{LETTERS[i]} → {LETTERS[i + 1]}<small>{filled[i]?.label} → {filled[i + 1]?.label}</small></th>
                      <td className="num">{fmtKm(l.distanceKm)}</td>
                      <td className="num">{minutes(Math.round(l.durationMin))}</td>
                      {calc && <td className="num">{eur((l.distanceKm * consumption / 100) * (priceMilli! / 1000))}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {plan.stations.cheapest.length > 0 && (
              <div className={styles.cheap}>
                <h3 className={styles.h3}>Las más baratas en tu ruta</h3>
                <p className={styles.hint}>
                  {fuel.name} a menos de {plan.corridorKm} km del trayecto, entre {plan.stations.count} gasolineras.
                  {calc?.saving && calc.saving > 0.5 ? <> Repostando todo el viaje en la más barata ahorrarías unos <strong>{eur(calc.saving)}</strong> frente a la media de la ruta.</> : null}
                </p>
                <ol className={styles.cheapList}>
                  {plan.stations.cheapest.slice(0, 5).map((s) => (
                    <li key={s.id}>
                      <Link href={`/estacion/${s.id}?fuel=${fuelSel}`} className={styles.cheapItem}>
                        <span className={styles.cheapName}>{s.brand}<small>{s.locality}, km {integer(Math.round(s.atKm))} de la ruta{s.offRouteKm > 0.3 ? `, a ${fmtKm(s.offRouteKm)} de la carretera` : ''}</small></span>
                        <span className={`${styles.cheapPrice} num`}>{price(s.priceMilli)}</span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            <p className={styles.source}>Ruta: {plan.meta.routing}. Precios: MITECO. Consumo: homologado WLTP (EEA) o el que indiques. El consumo real depende de la velocidad, la carga y el tráfico.</p>
          </>
        )}
      </section>
      </div>

      <div className={styles.mapArea}>
        {status === 'ready' && plan && calc && (
          <div className={styles.floatCard} aria-hidden="true">
            <span className={styles.floatCost}><b className="num">{dec(calc.cost, 2)}</b> €</span>
            <span className="num">{integer(Math.round(calc.dist))} km · {minutes(Math.round(calc.time))} · {dec(calc.liters)} {fuel.unit}</span>
          </div>
        )}
        <RouteMap
          points={filled}
          geometry={plan?.geometry ?? null}
          stations={plan?.stations.cheapest.slice(0, 5) ?? []}
          onStation={(id) => window.open(`/estacion/${id}?fuel=${fuelSel}`, '_self')}
        />
      </div>
    </main>
  );
}
