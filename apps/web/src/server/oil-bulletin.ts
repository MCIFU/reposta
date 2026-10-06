// Comisión Europea · Weekly Oil Bulletin: precio medio nacional SEMANAL (con y sin impuestos) desde 2005.
// Fuente oficial, ponderada por la Comisión. Se descarga el .xlsx histórico, se lee sin dependencias pesadas
// (unzip + XML) y se guarda en data/ (refresco diario: el boletín se publica los lunes/martes).
import 'server-only';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { unzipSync, strFromU8 } from 'fflate';
import { DATA_DIR, safeWrite } from './data-dir';

export const WOB_URL =
  'https://energy.ec.europa.eu/document/download/906e60ca-8b6a-44e7-8589-652854d2fd3f_en?filename=Weekly_Oil_Bulletin_Prices_History_maticni_4web.xlsx';
export const WOB_PAGE = 'https://energy.ec.europa.eu/data-and-analysis/weekly-oil-bulletin_en';

/** Combustibles del boletín -> código REPOSTA. El boletín no publica gasolina 98. */
const SERIES = { g95: 'euro95', diesel: 'diesel', glp: 'LPG' } as const;
export type WobFuel = keyof typeof SERIES;
export const WOB_FUELS = Object.keys(SERIES) as WobFuel[];

/** Un punto: semana (lunes, ISO), precio con impuestos y sin impuestos, en milésimas de €/L. */
export type WobPoint = [date: string, withTax: number, withoutTax: number | null];
export interface WobData {
  fetchedAt: string;
  lastWeek: string;
  series: Record<WobFuel, WobPoint[]>;
}

const CACHE = path.join(DATA_DIR, 'oil-bulletin.json');
const MAX_AGE = 24 * 3600_000;

const colOf = (ref: string) => ref.replace(/\d+/g, '');
const excelDate = (serial: number) => new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000).toISOString().slice(0, 10);

function sharedStrings(files: Record<string, Uint8Array>): string[] {
  const xml = files['xl/sharedStrings.xml'] ? strFromU8(files['xl/sharedStrings.xml']) : '';
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join(''));
}

/** Lee una hoja como filas { columna -> valor }. Solo lo necesario: números y cadenas compartidas. */
function readSheet(xml: string, strings: string[]) {
  const rows: Array<Record<string, string | number>> = [];
  for (const r of xml.matchAll(/<row [^>]*>([\s\S]*?)<\/row>/g)) {
    const row: Record<string, string | number> = {};
    for (const c of r[1].matchAll(/<c r="([A-Z]+\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const v = c[3]?.match(/<v>([^<]*)<\/v>/)?.[1];
      if (v == null) continue;
      row[colOf(c[1])] = /t="s"/.test(c[2]) ? strings[Number(v)] : Number(v);
    }
    rows.push(row);
  }
  return rows;
}

function sheetPath(files: Record<string, Uint8Array>, name: string) {
  const wb = strFromU8(files['xl/workbook.xml']);
  const rid = wb.match(new RegExp(`<sheet [^>]*name="${name}"[^>]*r:id="([^"]+)"`))?.[1];
  const rels = strFromU8(files['xl/_rels/workbook.xml.rels']);
  const target = rels.match(new RegExp(`Id="${rid}"[^>]*Target="([^"]+)"`))?.[1] ?? rels.match(new RegExp(`Target="([^"]+)"[^>]*Id="${rid}"`))?.[1];
  if (!target) throw new Error(`Hoja no encontrada: ${name}`);
  return 'xl/' + target.replace(/^\/?xl\//, '');
}

export function parseBulletin(buf: Uint8Array): Omit<WobData, 'fetchedAt'> {
  const files = unzipSync(buf, { filter: (f) => /^xl\/(workbook\.xml|_rels\/|sharedStrings\.xml|worksheets\/sheet\d+\.xml)/.test(f.name) });
  const strings = sharedStrings(files);
  const read = (name: string) => readSheet(strFromU8(files[sheetPath(files, name)]), strings);
  const withTax = read('Prices with taxes');
  const noTax = read('Prices wo taxes');

  const series = {} as Record<WobFuel, WobPoint[]>;
  for (const fuel of WOB_FUELS) {
    const colW = Object.entries(withTax[0]).find(([, v]) => v === `ES_price_with_tax_${SERIES[fuel]}`)?.[0];
    const colN = Object.entries(noTax[0]).find(([, v]) => v === `ES_price_wo_tax_${SERIES[fuel]}`)?.[0];
    if (!colW) throw new Error(`Columna de España no encontrada para ${fuel}`);
    const noTaxByDate = new Map<number, number>();
    for (const r of noTax) if (typeof r.A === 'number' && colN && typeof r[colN] === 'number') noTaxByDate.set(r.A, r[colN] as number);
    const pts: WobPoint[] = [];
    for (const r of withTax) {
      const d = r.A, v = r[colW];
      // €/1000 L == milésimas de €/L. Se descartan huecos y valores absurdos.
      if (typeof d !== 'number' || typeof v !== 'number' || v < 300 || v > 4000) continue;
      const n = noTaxByDate.get(d);
      pts.push([excelDate(d), Math.round(v), n != null && n > 100 ? Math.round(n) : null]);
    }
    series[fuel] = pts.sort((a, b) => a[0].localeCompare(b[0]));
  }
  const lastWeek = series.g95.at(-1)?.[0] ?? '';
  return { lastWeek, series };
}

let mem: { data: WobData; at: number } | null = null;
let inflight: Promise<WobData> | null = null;

async function download(): Promise<WobData> {
  const res = await fetch(WOB_URL, { redirect: 'follow', cache: 'no-store' });
  if (!res.ok) throw new Error(`Boletín UE: HTTP ${res.status}`);
  const data = { fetchedAt: new Date().toISOString(), ...parseBulletin(new Uint8Array(await res.arrayBuffer())) };
  await safeWrite(CACHE, JSON.stringify(data));
  return data;
}

export async function getBulletin(): Promise<WobData> {
  if (mem && Date.now() - mem.at < MAX_AGE) return mem.data;
  if (!mem) {
    try {
      const disk = JSON.parse(await fs.readFile(CACHE, 'utf8')) as WobData;
      mem = { data: disk, at: new Date(disk.fetchedAt).getTime() };
      if (Date.now() - mem.at < MAX_AGE) return disk;
    } catch {}
  }
  inflight ??= download()
    .then((d) => ((mem = { data: d, at: Date.now() }), d))
    .finally(() => (inflight = null));
  // Con copia en disco: se sirve ya y se refresca en segundo plano.
  if (mem) {
    inflight.catch(() => {});
    return mem.data;
  }
  return inflight;
}
