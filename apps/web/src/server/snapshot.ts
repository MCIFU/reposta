// Instantánea del precio actual (MITECO), en memoria y en disco.
// - En Vercel cada función arranca por separado: para no descargar 12 MB del Ministerio en cada arranque en frío,
//   las funciones leen primero la copia compartida y ya procesada de /api/snapshot (cacheada en la CDN de Vercel).
//   Solo esa ruta descarga de MITECO directamente.
// - Arranque en frío (local/servidor propio): carga la última instantánea guardada y refresca en segundo plano.
// - Refresco: si la instantánea tiene más de REPOSTA_REFRESH_MIN minutos.
// - Cada descarga se guarda comprimida en data/snapshots (auditoría, y base del futuro histórico intradía).
import 'server-only';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';
import {
  MITECO_BASE, normalizeStation, parseMitecoDate, priceStats, FUELS,
  type MitecoRawResponse, type Station, type PriceStats,
} from '@reposta/core';
import { fetchJson } from './http';
import { DATA_DIR, safeWrite } from './data-dir';

export interface Snapshot {
  /** Marca de tiempo publicada por MITECO (campo «Fecha»). */
  sourceTime: string;
  fetchedAt: string;
  stations: Station[];
  byId: Map<number, Station>;
  grid: Map<string, Station[]>;
  national: Record<string, PriceStats>;
  /** true si no se pudo refrescar y se está sirviendo una copia antigua */
  stale: boolean;
}

const SNAP_DIR = path.join(DATA_DIR, 'snapshots');
const REFRESH_MS = Number(process.env.REPOSTA_REFRESH_MIN ?? 30) * 60_000;
export const CELL_DEG = 0.1; // ~11 km
export const cellKey = (lat: number, lng: number) => `${Math.floor(lat / CELL_DEG)}:${Math.floor(lng / CELL_DEG)}`;

function build(raw: MitecoRawResponse, fetchedAt: string, stale = false): Snapshot {
  const stations = raw.ListaEESSPrecio.map(normalizeStation).filter((s): s is Station => !!s);
  return fromStations(stations, parseMitecoDate(raw.Fecha).toISOString(), fetchedAt, stale);
}

/** Índices y estadísticas a partir de estaciones ya normalizadas (descarga directa o copia compartida). */
function fromStations(stations: Station[], sourceTime: string, fetchedAt: string, stale = false): Snapshot {
  const byId = new Map(stations.map((s) => [s.id, s]));
  const grid = new Map<string, Station[]>();
  for (const s of stations) {
    const k = cellKey(s.lat, s.lng);
    (grid.get(k) ?? grid.set(k, []).get(k)!).push(s);
  }
  const national: Record<string, PriceStats> = {};
  for (const f of FUELS) {
    const st = priceStats(stations.map((s) => s.prices[f.code]).filter((p): p is number => p != null));
    if (st) national[f.code] = st;
  }
  return { sourceTime, fetchedAt, stations, byId, grid, national, stale };
}

/** Formato de la copia compartida que sirve /api/snapshot. */
export interface SharedSnapshot { v: 1; sourceTime: string; fetchedAt: string; stations: Station[] }
export const toShared = (s: Snapshot): SharedSnapshot => ({ v: 1, sourceTime: s.sourceTime, fetchedAt: s.fetchedAt, stations: s.stations });

// Dominio de producción (lo define Vercel). Fuera de Vercel no hay copia compartida: se descarga de MITECO.
const SHARED_HOST = process.env.VERCEL_ENV === 'production' ? process.env.VERCEL_PROJECT_PRODUCTION_URL : undefined;

async function fetchShared(): Promise<Snapshot | null> {
  if (!SHARED_HOST) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8_000);
  try {
    const r = await fetch(`https://${SHARED_HOST}/api/snapshot`, { signal: ctrl.signal, cache: 'no-store', headers: { Accept: 'application/json' } });
    if (!r.ok) return null;
    const d = (await r.json()) as SharedSnapshot;
    // Solo si es válida y reciente (el Ministerio publica cada ~30 min).
    if (d?.v !== 1 || !Array.isArray(d.stations) || d.stations.length < 5000) return null;
    if (Date.now() - new Date(d.sourceTime).getTime() > 3 * 3600_000) return null;
    return fromStations(d.stations, d.sourceTime, new Date().toISOString());
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

type State = { snap?: Snapshot; inflight?: Promise<Snapshot>; inflightDirect?: Promise<Snapshot>; lastError?: string; lastAttempt?: number };
const g = globalThis as unknown as { __repostaSnap?: State };
const state: State = (g.__repostaSnap ??= {});

async function loadFromDisk(): Promise<Snapshot | undefined> {
  try {
    const files = (await fs.readdir(SNAP_DIR)).filter((f) => f.endsWith('.json.gz')).sort();
    const last = files.at(-1);
    if (!last) return;
    const buf = await fs.readFile(path.join(SNAP_DIR, last));
    const raw = JSON.parse(gunzipSync(buf).toString('utf8')) as MitecoRawResponse;
    const stat = await fs.stat(path.join(SNAP_DIR, last));
    // No es «sin actualizar»: se refresca enseguida por antigüedad (fetchedAt = fecha del archivo). Solo un fallo real marca stale.
    return build(raw, stat.mtime.toISOString(), false);
  } catch {
    return undefined;
  }
}

async function fetchFresh(direct = false): Promise<Snapshot> {
  state.lastAttempt = Date.now();
  if (!direct) {
    const shared = await fetchShared();
    if (shared && (!state.snap || shared.sourceTime >= state.snap.sourceTime)) {
      state.lastError = undefined;
      return shared;
    }
  }
  const raw = await fetchJson<MitecoRawResponse>(`${MITECO_BASE}/EstacionesTerrestres/`, { timeoutMs: 90_000 });
  if (!raw?.ListaEESSPrecio?.length) throw new Error('MITECO devolvió una lista vacía');
  const snap = build(raw, new Date().toISOString());
  if (snap.sourceTime !== state.snap?.sourceTime) {
    const name = snap.sourceTime.replace(/[:.]/g, '-') + '.json.gz';
    await safeWrite(path.join(SNAP_DIR, name), gzipSync(JSON.stringify(raw)));
  }
  state.lastError = undefined;
  return snap;
}

// Dos descargas independientes: la directa (MITECO) y la de la copia compartida. Si compartieran la misma
// promesa, /api/snapshot podría quedarse esperando a una lectura de la copia que, a su vez, le espera a ella.
function refresh(direct = false): Promise<Snapshot> {
  const slot = direct ? 'inflightDirect' : 'inflight';
  state[slot] ??= fetchFresh(direct)
    .then((s) => (state.snap = !state.snap || s.sourceTime >= state.snap.sourceTime ? s : state.snap))
    .catch((e) => {
      state.lastError = String(e?.message ?? e);
      if (state.snap) return (state.snap = { ...state.snap, stale: true });
      throw e;
    })
    .finally(() => (state[slot] = undefined));
  return state[slot]!;
}

/**
 * Devuelve la mejor instantánea disponible sin bloquear si ya hay una en memoria.
 * direct: descarga de MITECO sin pasar por la copia compartida (solo /api/snapshot).
 * maxAgeMs: si la copia en memoria es más antigua, espera a refrescarla antes de responder.
 */
export async function getSnapshot(opts: { direct?: boolean; maxAgeMs?: number } = {}): Promise<Snapshot> {
  const { direct = false, maxAgeMs } = opts;
  if (!state.snap) {
    const disk = await loadFromDisk();
    if (disk) {
      state.snap = disk;
      const pending = refresh(direct);
      // Si se exige frescura (/api/snapshot), no se reparte una copia de disco antigua: se espera a la nueva.
      if (maxAgeMs != null && Date.now() - new Date(disk.fetchedAt).getTime() > maxAgeMs) return pending.catch(() => disk);
      pending.catch(() => {});
    } else {
      return refresh(direct);
    }
  }
  const age = Date.now() - new Date(state.snap.fetchedAt).getTime();
  const backoffOk = !state.lastAttempt || Date.now() - state.lastAttempt > 60_000;
  if (maxAgeMs != null && age > maxAgeMs && backoffOk) return refresh(direct).catch(() => state.snap!);
  if ((age > REFRESH_MS || state.snap.stale) && backoffOk) refresh(direct).catch(() => {});
  return state.snap;
}

export const snapshotHealth = () => ({
  sourceTime: state.snap?.sourceTime ?? null,
  fetchedAt: state.snap?.fetchedAt ?? null,
  stale: state.snap?.stale ?? null,
  stations: state.snap?.stations.length ?? 0,
  refreshing: !!state.inflight || !!state.inflightDirect,
  lastError: state.lastError ?? null,
});
