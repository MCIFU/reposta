// Rutas por carretera (datos de OpenStreetMap).
// - Producción: OpenRouteService si hay ORS_API_KEY (plan gratuito: 2.000 rutas/día, 40/min).
// - Desarrollo: OSRM (REPOSTA_ROUTING_URL; por defecto el servidor público de demostración, no apto para uso intensivo).
import 'server-only';
import { haversineKm, isOpenAt, type LatLng, priceStats } from '@reposta/core';
import { getSnapshot, CELL_DEG } from './snapshot';
import { fetchJson } from './http';

const OSRM = process.env.REPOSTA_ROUTING_URL ?? 'https://router.project-osrm.org';
const ORS_KEY = process.env.ORS_API_KEY;
export const ROUTING_PROVIDER = ORS_KEY ? 'OpenRouteService · © OpenStreetMap' : 'OSRM · © OpenStreetMap';
const cache = new Map<string, Promise<RouteCore>>();

interface RouteCore {
  distanceKm: number;
  durationMin: number;
  legs: Array<{ distanceKm: number; durationMin: number }>;
  /** [lng, lat] */
  geometry: Array<[number, number]>;
}

export interface RouteStation {
  id: number;
  brand: string;
  address: string;
  locality: string;
  lat: number;
  lng: number;
  priceMilli: number;
  /** distancia en línea recta desde la ruta */
  offRouteKm: number;
  /** punto kilométrico aproximado de la ruta */
  atKm: number;
  openNow: boolean | null;
}

async function ors(points: LatLng[]): Promise<RouteCore> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch('https://api.openrouteservice.org/v2/directions/driving-car/geojson', {
      method: 'POST', signal: ctrl.signal, cache: 'no-store',
      headers: { Authorization: ORS_KEY!, 'Content-Type': 'application/json', Accept: 'application/geo+json, application/json' },
      body: JSON.stringify({ coordinates: points.map((p) => [p.lng, p.lat]), instructions: false }),
    });
    const d = await res.json();
    if (res.status === 429) throw new Error('Se ha alcanzado el límite de rutas por ahora. Inténtalo en un minuto.');
    if (res.status === 401 || res.status === 403) {
      console.error('[rutas] OpenRouteService rechaza la clave ORS_API_KEY:', d?.error);
      throw new Error('El servicio de rutas no está disponible ahora mismo.');
    }
    // ORS devuelve error como texto o como { code, message } según el caso.
    if (!res.ok) throw new Error(res.status === 404 || /route/i.test(JSON.stringify(d?.error ?? '')) ? 'No hay ruta por carretera entre esos puntos.' : 'No se pudo calcular la ruta.');
    const f = d.features?.[0];
    if (!f) throw new Error('No se pudo calcular la ruta.');
    const segs: Array<{ distance?: number; duration?: number }> = f.properties?.segments ?? [];
    return {
      distanceKm: (f.properties?.summary?.distance ?? 0) / 1000,
      durationMin: (f.properties?.summary?.duration ?? 0) / 60,
      legs: segs.map((sg) => ({ distanceKm: (sg.distance ?? 0) / 1000, durationMin: (sg.duration ?? 0) / 60 })),
      geometry: f.geometry.coordinates,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function osrm(points: LatLng[]): Promise<RouteCore> {
  const coords = points.map((p) => `${p.lng.toFixed(5)},${p.lat.toFixed(5)}`).join(';');
  const key = coords;
  if (!cache.has(key)) {
    cache.set(key, ORS_KEY ? ors(points) : (async () => {
      const r = await fetchJson<{ code: string; message?: string; routes?: Array<{ distance: number; duration: number; legs: Array<{ distance: number; duration: number }>; geometry: { coordinates: Array<[number, number]> } }> }>(
        `${OSRM}/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`,
        { timeoutMs: 20_000, retries: 1 },
      );
      if (r.code !== 'Ok' || !r.routes?.length) throw new Error(r.code === 'NoRoute' ? 'No hay ruta por carretera entre esos puntos.' : 'No se pudo calcular la ruta.');
      const route = r.routes[0];
      return {
        distanceKm: route.distance / 1000,
        durationMin: route.duration / 60,
        legs: route.legs.map((l) => ({ distanceKm: l.distance / 1000, durationMin: l.duration / 60 })),
        geometry: route.geometry.coordinates,
      };
    })());
    if (cache.size > 300) cache.delete(cache.keys().next().value!);
    cache.get(key)!.catch(() => cache.delete(key));
  }
  return cache.get(key)!;
}

/** Puntos de la ruta cada ~stepKm, con su km acumulado. */
function sample(geom: Array<[number, number]>, stepKm: number) {
  const out: Array<{ lat: number; lng: number; km: number }> = [];
  let acc = 0, next = 0;
  for (let i = 0; i < geom.length; i++) {
    const p = { lat: geom[i][1], lng: geom[i][0] };
    if (i > 0) acc += haversineKm({ lat: geom[i - 1][1], lng: geom[i - 1][0] }, p);
    if (acc >= next || i === geom.length - 1) {
      out.push({ ...p, km: acc });
      next = acc + stepKm;
    }
  }
  return out;
}

/** Simplifica la geometría para el cliente (máx. ~1.200 vértices). */
function thin(geom: Array<[number, number]>, max = 1200) {
  if (geom.length <= max) return geom;
  const step = geom.length / max;
  const out: Array<[number, number]> = [];
  for (let i = 0; i < geom.length; i += step) out.push(geom[Math.floor(i)]);
  out.push(geom[geom.length - 1]);
  return out;
}

export async function planRoute(points: LatLng[], fuel: string, corridorKm = 2) {
  const core = await osrm(points);
  const snap = await getSnapshot();
  const samples = sample(core.geometry, 0.8);
  const found = new Map<number, RouteStation>();
  for (const sp of samples) {
    const la = Math.floor(sp.lat / CELL_DEG), ln = Math.floor(sp.lng / CELL_DEG);
    for (let a = la - 1; a <= la + 1; a++)
      for (let b = ln - 1; b <= ln + 1; b++) {
        for (const s of snap.grid.get(`${a}:${b}`) ?? []) {
          const p = s.prices[fuel];
          if (p == null) continue;
          const d = haversineKm(sp, s);
          if (d > corridorKm) continue;
          const prev = found.get(s.id);
          if (!prev || d < prev.offRouteKm)
            found.set(s.id, {
              id: s.id, brand: s.brand, address: s.address, locality: s.locality, lat: s.lat, lng: s.lng,
              priceMilli: p, offRouteKm: d, atKm: sp.km, openNow: isOpenAt(s.schedule),
            });
        }
      }
  }
  const all = [...found.values()];
  const stats = priceStats(all.map((s) => s.priceMilli));
  const cheapest = [...all].sort((a, b) => a.priceMilli - b.priceMilli || a.offRouteKm - b.offRouteKm).slice(0, 8);
  return {
    meta: { source: 'MITECO', sourceTime: snap.sourceTime, routing: ROUTING_PROVIDER },
    distanceKm: core.distanceKm,
    durationMin: core.durationMin,
    legs: core.legs,
    geometry: thin(core.geometry),
    corridorKm,
    stations: { count: all.length, stats, cheapest },
    national: snap.national[fuel] ?? null,
  };
}
