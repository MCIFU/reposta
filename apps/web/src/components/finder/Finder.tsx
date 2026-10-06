'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { DEFAULT_FUEL, getFuel, isFuelCode, type PriceStats } from '@reposta/core';
import type { NearbyResult } from '@/server/repository';
import { AppNav } from '../AppNav';
import { FuelPicker } from './FuelPicker';
import { PlaceSearch, type PickedPlace } from './PlaceSearch';
import { Best, Controls, StationList, ResultsSkeleton, Updated, useNow, type Sort } from './Results';
import { TripSettings } from './TripSettings';
import { StationSheet } from '../station/StationSheet';
import { DEFAULT_TRIP, readFuel, storeFuel, useStored, type TripPrefs } from '@/lib/prefs';
import { price, km, integer, clock, ago } from '@/lib/format';
import styles from './Finder.module.css';

const MapView = dynamic(() => import('../map/MapView'), { ssr: false, loading: () => <div className={styles.mapLoading}>Cargando mapa…</div> });

interface Summary { meta: { sourceTime: string; stale: boolean }; stations: number; national: Record<string, PriceStats> }

type Status = 'idle' | 'locating' | 'loading' | 'ready' | 'error';
const RADII = [3, 5, 10, 20, 30, 50];

export function Finder({ summary }: { summary: Summary | null }) {
  const [fuel, setFuel] = useState(DEFAULT_FUEL);
  const [place, setPlace] = useState<PickedPlace | null>(null);
  const [sort, setSort] = useState<Sort>('price');
  const [radius, setRadius] = useState(10);
  const [openOnly, setOpenOnly] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<NearbyResult | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [prefsOpen, setPrefsOpen] = useState(false);
  // El mapa (MapLibre + 11.000 puntos) es lo más pesado: se monta cuando el navegador queda libre tras pintar la lista.
  const [mapWanted, setMapWanted] = useState(false);
  useEffect(() => {
    const ric = window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 1200));
    const id = ric(() => setMapWanted(true), { timeout: 2000 });
    return () => (window.cancelIdleCallback ?? clearTimeout)(id as number);
  }, []);
  const [prefs, setPrefs] = useStored<TripPrefs>('rp-trip', DEFAULT_TRIP);
  const [savedPlace, setSavedPlace, placeReady] = useStored<PickedPlace | null>('rp-place', null);
  const reqSeq = useRef(0);
  const listTop = useRef<HTMLElement>(null);

  // Estado inicial: URL > último lugar guardado. El combustible se recuerda.
  useEffect(() => {
    if (!placeReady) return;
    const u = new URLSearchParams(location.search);
    const f = u.get('fuel') ?? readFuel();
    if (isFuelCode(f) && getFuel(f)?.searchable) setFuel(f);
    const lat = Number(u.get('lat')), lng = Number(u.get('lng'));
    if (lat && lng) setPlace({ lat, lng, label: u.get('en') ?? 'Ubicación compartida', source: 'search' });
    else if (savedPlace) setPlace(savedPlace);
    if (u.get('r')) setRadius(Math.min(50, Math.max(3, Number(u.get('r')) || 10)));
    if (u.get('orden') === 'distancia') setSort('distance');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeReady]);

  // Consulta
  useEffect(() => {
    if (!place) return;
    const my = ++reqSeq.current;
    setStatus('loading');
    setError(null);
    const q = new URLSearchParams({ lat: place.lat.toFixed(5), lng: place.lng.toFixed(5), fuel, radius: String(radius), sort, limit: '60' });
    if (openOnly) q.set('open', '1');
    fetch(`/api/stations/nearby?${q}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d as NearbyResult;
      })
      .then((d) => {
        if (my !== reqSeq.current) return;
        setResult(d);
        setStatus('ready');
      })
      .catch((e) => {
        if (my !== reqSeq.current) return;
        setError(e.message || 'No se pudieron cargar las gasolineras.');
        setStatus('error');
      });
    const share = new URLSearchParams({ fuel, lat: place.lat.toFixed(4), lng: place.lng.toFixed(4), en: place.label });
    if (radius !== 10) share.set('r', String(radius));
    if (sort === 'distance') share.set('orden', 'distancia');
    history.replaceState(null, '', `/?${share}`);
  }, [place, fuel, radius, sort, openOnly]);

  const pick = useCallback((p: PickedPlace) => {
    setPlace(p);
    setSelected(null);
    setSavedPlace(p);
    listTop.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [setSavedPlace]);

  const locate = useCallback(() => {
    if (!('geolocation' in navigator)) { setError('Tu navegador no permite obtener la ubicación. Busca una ciudad o un código postal.'); setStatus('error'); return; }
    setStatus('locating');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const p: PickedPlace = { lat: pos.coords.latitude, lng: pos.coords.longitude, label: 'Tu ubicación', source: 'gps' };
        pick(p);
        try {
          const r = await fetch(`/api/geocode/reverse?lat=${p.lat}&lng=${p.lng}`).then((x) => x.json());
          if (r?.label) { const named = { ...p, label: r.label }; setPlace((cur) => (cur === p ? named : cur)); setSavedPlace(named); }
        } catch {}
      },
      (e) => {
        setStatus(result ? 'ready' : 'idle');
        setError(e.code === e.PERMISSION_DENIED
          ? 'No has dado permiso para usar tu ubicación. Puedes buscar una ciudad, un código postal o moverte por el mapa.'
          : 'No se pudo obtener tu ubicación. Prueba a buscar una ciudad o un código postal.');
      },
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 120_000 },
    );
  }, [pick, result, setSavedPlace]);

  const changeFuel = (f: string) => { setFuel(f); storeFuel(f); };
  const open = (id: number) => setSelected(id);

  const showResults = status === 'ready' && result && result.fuel === fuel;
  const fuelInfo = getFuel(fuel)!;

  const meta = showResults ? result.meta : summary?.meta;

  return (
    <div className={styles.app}>
      <AppNav />
      <main className={styles.layout}>
        <div className={styles.search}>
          <h1 className="sr-only">Precios del combustible hoy y gasolineras más baratas</h1>
          {meta && <DayBar iso={meta.sourceTime} stale={meta.stale} />}
          <FuelPicker value={fuel} onChange={changeFuel} />
          <PlaceSearch current={place} onPick={pick} onLocate={locate} locating={status === 'locating'} />
          {error && status !== 'error' && <p className={styles.inlineError} role="alert">{error}</p>}
        </div>

        <section className={styles.mapArea} aria-label="Mapa de precios">
          {mapWanted ? <MapView
            fuel={fuel}
            origin={place}
            radiusKm={radius}
            selectedId={selected}
            bestId={showResults ? result.cheapest?.id ?? null : null}
            onSelect={open}
            onSearchHere={(c) => pick({ ...c, label: 'Zona del mapa', source: 'map' })}
            fitKey={`${place?.lat},${place?.lng},${radius}`}
          /> : <div className={styles.mapLoading}>Cargando mapa…</div>}
        </section>

        <section ref={listTop} className={styles.results} aria-label="Resultados">
          {!place && status !== 'locating' && <Intro summary={summary} fuel={fuel} onLocate={locate} />}
          {(status === 'loading' || status === 'locating') && !showResults && <ResultsSkeleton />}
          {status === 'error' && (
            <div className={styles.state} role="alert">
              <p className={styles.stateTitle}>No hemos podido cargar las gasolineras</p>
              <p>{error}</p>
              <button type="button" className={styles.retry} onClick={() => place && setPlace({ ...place })}>Reintentar</button>
            </div>
          )}
          {showResults && result.total === 0 && (
            <div className={styles.state}>
              <p className={styles.stateTitle}>Ninguna gasolinera con {fuelInfo.name} a menos de {result.radiusKm} km{openOnly ? ' abierta ahora' : ''}</p>
              {result.closestBeyond ? (
                <p>La más cercana está a {km(result.closestBeyond.roadKmApprox)}: {result.closestBeyond.brand}, {result.closestBeyond.locality}, a {price(result.closestBeyond.priceMilli)} €/{fuelInfo.unit}.</p>
              ) : <p>No hay estaciones con este combustible en la zona.</p>}
              <div className={styles.stateActions}>
                {(() => {
                  // Propone el radio que de verdad incluye la más cercana (si cabe en el máximo de 50 km).
                  const need = result.closestBeyond ? RADII.find((n) => n >= result.closestBeyond!.straightKm) : RADII.find((n) => n > result.radiusKm);
                  return need && need > result.radiusKm ? <button type="button" className={styles.retry} onClick={() => setRadius(need)}>Ampliar a {need} km</button> : null;
                })()}
                {openOnly && <button type="button" className={styles.ghost} onClick={() => setOpenOnly(false)}>Ver también las cerradas</button>}
                {result.closestBeyond && <button type="button" className={styles.ghost} onClick={() => open(result.closestBeyond!.id)}>Ver la más cercana</button>}
              </div>
            </div>
          )}
          {showResults && result.total > 0 && (
            <>
              <Best r={result} prefs={prefs} onOpen={open} onEditPrefs={() => setPrefsOpen(true)} />
              <Controls r={result} sort={sort} onSort={setSort} radius={radius} onRadius={setRadius} openOnly={openOnly} onOpenOnly={setOpenOnly} />
              <StationList r={result} prefs={prefs} selectedId={selected} onOpen={open} />
              <footer className={styles.listFoot}>
                <Updated iso={result.meta.sourceTime} stale={result.meta.stale} />
                <span>Distancias y tiempos estimados por carretera (≈). Fuente: MITECO.</span>
              </footer>
            </>
          )}
        </section>
      </main>

      {selected != null && <StationSheet id={selected} fuel={fuel} origin={place} onClose={() => setSelected(null)} />}
      <TripSettings open={prefsOpen} value={prefs} unit={fuelInfo.unit} onClose={() => setPrefsOpen(false)} onSave={(v) => { setPrefs(v); setPrefsOpen(false); }} />
    </div>
  );
}

/** «Precios de hoy, lunes 6 de octubre» + hora de la última publicación oficial. */
function DayBar({ iso, stale }: { iso: string; stale: boolean }) {
  const now = useNow();
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', weekday: 'long', day: 'numeric', month: 'long' }).format(d);
  const today = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', dateStyle: 'short' }).format(new Date(now)) ===
    new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', dateStyle: 'short' }).format(d);
  return (
    <div className={styles.dayBar} data-stale={stale || undefined}>
      <p className={styles.day}><span>{today ? 'Precios de hoy' : 'Últimos precios'}</span> {day}</p>
      <p className={styles.dayMeta}>
        <span className={styles.live} aria-hidden="true" />
        Oficiales de MITECO, publicados a las {clock(iso)} ({ago(iso, now)}){stale ? '. No se han podido actualizar desde entonces.' : ''}
      </p>
    </div>
  );
}

function Intro({ summary, fuel, onLocate }: { summary: Summary | null; fuel: string; onLocate: () => void }) {
  const st = summary?.national[fuel];
  const f = getFuel(fuel)!;
  return (
    <section className={styles.intro} aria-labelledby="intro-title">
      <h2 id="intro-title" className={styles.introTitle}>¿Dónde quieres repostar?</h2>
      <p className={styles.introText}>Usa tu ubicación, busca una ciudad o un código postal, o muévete por el mapa. Te enseñamos las gasolineras más baratas y si de verdad compensa ir hasta ellas.</p>
      <button type="button" className={styles.cta} onClick={onLocate}>Usar mi ubicación</button>
      {st && summary && (
        <div className={styles.today}>
          <p className={styles.todayTitle}>{f.name} hoy en España</p>
          <dl className={styles.todayGrid}>
            <div><dt>Media</dt><dd className="num">{price(st.avg)}</dd></div>
            <div><dt>Más barata</dt><dd className="num">{price(st.min)}</dd></div>
            <div><dt>Más cara</dt><dd className="num">{price(st.max)}</dd></div>
          </dl>
          <p className={styles.todayNote}>
            Media calculada por REPOSTA con {integer(st.count)} estaciones (sin el 2 % de cada extremo). <Updated iso={summary.meta.sourceTime} stale={summary.meta.stale} />.
          </p>
          <Link href="/historico" className={styles.histLink}>Ver cómo ha evolucionado desde 2005</Link>
        </div>
      )}
    </section>
  );
}
