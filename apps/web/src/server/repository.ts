// Capa de acceso a datos. La UI y la API solo conocen esta interfaz.
// Implementación actual: memoria (instantánea MITECO). Fase 2: PostgreSQL + PostGIS (db/schema.sql).
import 'server-only';
import {
  haversineKm, estimateTrip, bboxAround, isOpenAt, madridNow, priceStats, getFuel,
  type Station, type PriceStats, type LatLng,
} from '@reposta/core';
import { getSnapshot, cellKey, CELL_DEG, type Snapshot } from './snapshot';

export type SortMode = 'price' | 'distance';

export interface NearbyQuery {
  origin: LatLng;
  fuel: string;
  radiusKm: number;
  sort: SortMode;
  limit: number;
  openOnly?: boolean;
}

export interface NearbyStation {
  id: number;
  brand: string;
  label: string;
  address: string;
  locality: string;
  municipality: string;
  province: string;
  lat: number;
  lng: number;
  priceMilli: number;
  straightKm: number;
  roadKmApprox: number;
  minutesApprox: number;
  scheduleRaw: string;
  is24h: boolean;
  openNow: boolean | null;
}

export interface Meta {
  source: 'MITECO';
  sourceTime: string;
  fetchedAt: string;
  stale: boolean;
}

export interface NearbyResult {
  meta: Meta;
  fuel: string;
  origin: LatLng;
  radiusKm: number;
  stations: NearbyStation[];
  /** total en el radio antes de aplicar el límite */
  total: number;
  stats: PriceStats | null;
  /** La más cercana que vende el combustible: referencia para «¿Me compensa?». */
  nearest: NearbyStation | null;
  /** La más barata del radio (desempate: la más cercana). */
  cheapest: NearbyStation | null;
  /** Si no hay nada en el radio: la más cercana fuera de él (para un estado vacío útil). */
  closestBeyond: NearbyStation | null;
}

const metaOf = (s: Snapshot): Meta => ({ source: 'MITECO', sourceTime: s.sourceTime, fetchedAt: s.fetchedAt, stale: s.stale });

function toNearby(s: Station, fuel: string, origin: LatLng, now = madridNow()): NearbyStation {
  const straightKm = haversineKm(origin, s);
  const trip = estimateTrip(straightKm);
  return {
    id: s.id, brand: s.brand, label: s.label, address: s.address, locality: s.locality,
    municipality: s.municipality, province: s.province, lat: s.lat, lng: s.lng,
    priceMilli: s.prices[fuel], straightKm, roadKmApprox: trip.km, minutesApprox: trip.minutes,
    scheduleRaw: s.scheduleRaw, is24h: s.is24h, openNow: isOpenAt(s.schedule, now),
  };
}

function candidates(snap: Snapshot, origin: LatLng, radiusKm: number): Station[] {
  const b = bboxAround(origin, radiusKm);
  const out: Station[] = [];
  for (let la = Math.floor(b.minLat / CELL_DEG); la <= Math.floor(b.maxLat / CELL_DEG); la++)
    for (let ln = Math.floor(b.minLng / CELL_DEG); ln <= Math.floor(b.maxLng / CELL_DEG); ln++) {
      const cell = snap.grid.get(`${la}:${ln}`);
      if (cell) out.push(...cell);
    }
  return out;
}

export async function nearby(q: NearbyQuery): Promise<NearbyResult> {
  const snap = await getSnapshot();
  const now = madridNow();
  const all = candidates(snap, q.origin, q.radiusKm)
    .filter((s) => s.prices[q.fuel] != null)
    .map((s) => toNearby(s, q.fuel, q.origin, now))
    .filter((s) => s.straightKm <= q.radiusKm);
  // openOnly oculta las cerradas confirmadas (false) pero conserva las de horario
  // desconocido (null: «Consultar», festivos…): mejor mostrar que esconder.
  const pool = q.openOnly ? all.filter((s) => s.openNow !== false) : all;
  const nearest = pool.reduce<NearbyStation | null>((a, s) => (!a || s.straightKm < a.straightKm ? s : a), null);
  const cheapest = pool.reduce<NearbyStation | null>(
    (a, s) => (!a || s.priceMilli < a.priceMilli || (s.priceMilli === a.priceMilli && s.straightKm < a.straightKm) ? s : a), null);
  const sorted = [...pool].sort((a, b) =>
    q.sort === 'distance' ? a.straightKm - b.straightKm || a.priceMilli - b.priceMilli : a.priceMilli - b.priceMilli || a.straightKm - b.straightKm,
  );

  let closestBeyond: NearbyStation | null = null;
  if (!pool.length) {
    for (const r of [q.radiusKm * 2, q.radiusKm * 4, 150]) {
      const c = candidates(snap, q.origin, r).filter((s) => s.prices[q.fuel] != null);
      if (c.length) {
        closestBeyond = c.map((s) => toNearby(s, q.fuel, q.origin, now)).sort((a, b) => a.straightKm - b.straightKm)[0];
        break;
      }
    }
  }
  return {
    meta: metaOf(snap), fuel: q.fuel, origin: q.origin, radiusKm: q.radiusKm,
    stations: sorted.slice(0, q.limit), total: pool.length,
    stats: priceStats(pool.map((s) => s.priceMilli)), nearest, cheapest, closestBeyond,
  };
}

export async function stationById(id: number) {
  const snap = await getSnapshot();
  const s = snap.byId.get(id);
  return s ? { meta: metaOf(snap), station: s, openNow: isOpenAt(s.schedule), national: snap.national } : null;
}

/** Puntos compactos para el mapa: [id, lat, lng, precio]. ~11k filas, ~120 KB comprimido. */
export async function mapPoints(fuel: string) {
  const snap = await getSnapshot();
  const points: Array<[number, number, number, number]> = [];
  for (const s of snap.stations) {
    const p = s.prices[fuel];
    if (p != null) points.push([s.id, +s.lat.toFixed(5), +s.lng.toFixed(5), p]);
  }
  return { meta: metaOf(snap), fuel, points };
}

export async function nationalSummary() {
  const snap = await getSnapshot();
  return { meta: metaOf(snap), stations: snap.stations.length, national: snap.national };
}

/** Estaciones de un municipio (id interno MITECO) — páginas por municipio. */
export async function municipalityStations(municipalityId: string) {
  const snap = await getSnapshot();
  const list = snap.stations.filter((s) => s.municipalityId === municipalityId);
  return { meta: metaOf(snap), stations: list };
}

export async function municipalityIndex() {
  const snap = await getSnapshot();
  const m = new Map<string, { id: string; name: string; province: string; count: number }>();
  for (const s of snap.stations) {
    const e = m.get(s.municipalityId) ?? { id: s.municipalityId, name: s.municipality, province: s.province, count: 0 };
    e.count++;
    m.set(s.municipalityId, e);
  }
  return [...m.values()];
}

export const isValidFuel = (code: string) => !!getFuel(code)?.searchable;
export { cellKey };
