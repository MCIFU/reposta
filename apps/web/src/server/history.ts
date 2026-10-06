// Histórico reciente de una estación (fase 1): se obtiene bajo demanda del endpoint oficial
// EstacionesTerrestresHist/FiltroMunicipio/{dd-mm-aaaa}/{IDMunicipio} y se cachea en disco.
// Cada punto es el precio vigente a las 00:00 de ese día. En la fase 2 lo sustituye price_month (Postgres).
import 'server-only';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';
import { MITECO_BASE, mitecoDay, FUELS, parseMitecoPrice, type MitecoRawResponse } from '@reposta/core';
import { fetchJson, pool } from './http';

const DATA_DIR = path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.REPOSTA_DATA_DIR ?? '../../data');
const HIST_DIR = path.join(DATA_DIR, 'hist-municipio');

type DayFile = { date: string; stations: Record<string, Record<string, number>> };
const mem = new Map<string, Promise<DayFile | null>>();

async function loadDay(municipalityId: string, d: Date): Promise<DayFile | null> {
  const day = mitecoDay(d); // dd-mm-aaaa
  const iso = day.split('-').reverse().join('-');
  const file = path.join(HIST_DIR, municipalityId, `${iso}.json.gz`);
  try {
    return JSON.parse(gunzipSync(await fs.readFile(file)).toString('utf8'));
  } catch {}
  const raw = await fetchJson<MitecoRawResponse>(
    `${MITECO_BASE}/EstacionesTerrestresHist/FiltroMunicipio/${day}/${encodeURIComponent(municipalityId)}`,
    { timeoutMs: 30_000, retries: 1 },
  ).catch(() => null);
  if (!raw?.ListaEESSPrecio) return null;
  const stations: DayFile['stations'] = {};
  for (const s of raw.ListaEESSPrecio) {
    const prices: Record<string, number> = {};
    for (const f of FUELS) {
      const p = parseMitecoPrice(s[f.mitecoField]);
      if (p != null) prices[f.code] = p;
    }
    stations[s['IDEESS']] = prices;
  }
  const out: DayFile = { date: iso, stations };
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, gzipSync(JSON.stringify(out)));
  return out;
}

export interface HistoryPoint {
  date: string;
  priceMilli: number | null;
}

export async function stationHistory(stationId: number, municipalityId: string, fuel: string, days = 30) {
  const today = new Date();
  const dates = Array.from({ length: days }, (_, i) => new Date(today.getTime() - (days - i) * 86_400_000));
  const files = await pool(dates, 6, (d) => {
    const key = `${municipalityId}:${mitecoDay(d)}`;
    if (!mem.has(key)) mem.set(key, loadDay(municipalityId, d).catch(() => null));
    return mem.get(key)!;
  });
  const points: HistoryPoint[] = files.map((f, i) => ({
    date: f?.date ?? mitecoDay(dates[i]).split('-').reverse().join('-'),
    priceMilli: f?.stations[String(stationId)]?.[fuel] ?? null,
  }));
  return { source: 'MITECO (histórico diario, 00:00)', points };
}
