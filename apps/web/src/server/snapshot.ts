// Instantánea del precio actual (MITECO), en memoria y en disco.
// - Arranque en frío: carga la última instantánea guardada y refresca en segundo plano.
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
  return { sourceTime: parseMitecoDate(raw.Fecha).toISOString(), fetchedAt, stations, byId, grid, national, stale };
}

type State = { snap?: Snapshot; inflight?: Promise<Snapshot>; lastError?: string; lastAttempt?: number };
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

async function fetchFresh(): Promise<Snapshot> {
  state.lastAttempt = Date.now();
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

function refresh(): Promise<Snapshot> {
  state.inflight ??= fetchFresh()
    .then((s) => (state.snap = s))
    .catch((e) => {
      state.lastError = String(e?.message ?? e);
      if (state.snap) return (state.snap = { ...state.snap, stale: true });
      throw e;
    })
    .finally(() => (state.inflight = undefined));
  return state.inflight;
}

/** Devuelve la mejor instantánea disponible sin bloquear si ya hay una en memoria. */
export async function getSnapshot(): Promise<Snapshot> {
  if (!state.snap) {
    const disk = await loadFromDisk();
    if (disk) {
      state.snap = disk;
      refresh().catch(() => {});
    } else {
      return refresh();
    }
  }
  const age = Date.now() - new Date(state.snap.fetchedAt).getTime();
  const backoffOk = !state.lastAttempt || Date.now() - state.lastAttempt > 60_000;
  if ((age > REFRESH_MS || state.snap.stale) && backoffOk) refresh().catch(() => {});
  return state.snap;
}

export const snapshotHealth = () => ({
  sourceTime: state.snap?.sourceTime ?? null,
  fetchedAt: state.snap?.fetchedAt ?? null,
  stale: state.snap?.stale ?? null,
  stations: state.snap?.stations.length ?? 0,
  refreshing: !!state.inflight,
  lastError: state.lastError ?? null,
});
