// Normalización de la respuesta del servicio REST de MITECO al modelo de REPOSTA.
import { FUELS } from './fuels.ts';
import { normalizeBrand, prettyAddress, titleCase } from './brands.ts';
import { parseSchedule, is24h, type OpeningRule } from './schedule.ts';
import { parseMitecoPrice, parseMitecoCoord } from './format.ts';

export const MITECO_BASE = 'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes';

export type MitecoRawStation = Record<string, string>;
export interface MitecoRawResponse {
  Fecha: string;
  ListaEESSPrecio: MitecoRawStation[];
  ResultadoConsulta?: string;
}

export interface Station {
  id: number;
  brand: string;
  brandKnown: boolean;
  label: string;
  address: string;
  postalCode: string;
  locality: string;
  municipality: string;
  municipalityId: string;
  province: string;
  provinceId: string;
  communityId: string;
  lat: number;
  lng: number;
  scheduleRaw: string;
  schedule: OpeningRule[] | null;
  is24h: boolean;
  /** precios en milésimas de euro por unidad, por código de combustible */
  prices: Record<string, number>;
}

/** «02/10/2026 19:09:38» (hora peninsular) -> Date UTC. */
export function parseMitecoDate(raw: string): Date {
  const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/);
  if (!m) throw new Error(`Fecha MITECO no reconocida: ${raw}`);
  const [, dd, mm, yyyy, hh, mi, ss] = m.map(Number);
  // Calcula el desfase real de Europe/Madrid para esa fecha (CET/CEST).
  const guess = Date.UTC(yyyy, mm - 1, dd, hh, mi, ss);
  const tzName = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Madrid', timeZoneName: 'shortOffset' })
    .formatToParts(new Date(guess))
    .find((p) => p.type === 'timeZoneName')!.value; // «GMT+2»
  const offH = Number(tzName.replace('GMT', '') || 0);
  return new Date(guess - offH * 3600_000);
}

/** dd-mm-aaaa para los endpoints históricos. */
export const mitecoDay = (d: Date) => {
  const p = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit', year: 'numeric' }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)!.value;
  return `${g('day')}-${g('month')}-${g('year')}`;
};

const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
/** La localidad viene en mayúsculas y sin tildes («GIJON»); si coincide con el municipio, usamos el nombre bien escrito. */
const cleanLocality = (locality: string, municipality: string) => {
  const l = locality.trim().replace(/\s{2,}/g, ' ');
  return fold(l) === fold(municipality) ? municipality.trim() : titleCase(l);
};

export function normalizeStation(raw: MitecoRawStation): Station | null {
  const lat = parseMitecoCoord(raw['Latitud'] ?? '');
  const lng = parseMitecoCoord(raw['Longitud (WGS84)'] ?? '');
  const id = Number(raw['IDEESS']);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !id) return null;
  // España (incl. Canarias, Ceuta y Melilla): descarta coordenadas absurdas.
  if (lat < 27 || lat > 44.5 || lng < -18.5 || lng > 4.6) return null;

  const prices: Record<string, number> = {};
  for (const f of FUELS) {
    const p = parseMitecoPrice(raw[f.mitecoField]);
    if (p != null) prices[f.code] = p;
  }
  const brand = normalizeBrand(raw['Rótulo'] ?? '');
  const schedule = parseSchedule(raw['Horario']);
  return {
    id,
    brand: brand.name,
    brandKnown: brand.known,
    label: (raw['Rótulo'] ?? '').trim(),
    address: prettyAddress(raw['Dirección'] ?? ''),
    postalCode: (raw['C.P.'] ?? '').trim(),
    locality: cleanLocality(raw['Localidad'] ?? '', raw['Municipio'] ?? ''),
    municipality: (raw['Municipio'] ?? '').trim(),
    municipalityId: raw['IDMunicipio'] ?? '',
    province: (raw['Provincia'] ?? '').trim(),
    provinceId: raw['IDProvincia'] ?? '',
    communityId: raw['IDCCAA'] ?? '',
    lat,
    lng,
    scheduleRaw: (raw['Horario'] ?? '').trim(),
    schedule,
    is24h: is24h(schedule),
    prices,
  };
}
