// Geocodificación con CartoCiudad (IGN). Proxy con caché para no exponer al cliente un servicio sin SLA.
import 'server-only';
import { fetchJson } from './http';

const BASE = 'https://www.cartociudad.es/geocoder/api/geocoder';
const cache = new Map<string, { at: number; value: unknown }>();
const TTL = 24 * 3600_000;

async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value as T;
  const value = await fn();
  cache.set(key, { at: Date.now(), value });
  if (cache.size > 5000) cache.delete(cache.keys().next().value!);
  return value;
}

interface CcCandidate {
  id: string; type: string; address: string | null; postalCode: string | null; muni: string | null;
  province: string | null; poblacion: string | null; lat: number; lng: number;
}

export interface Place {
  id: string;
  type: 'Codpost' | 'Municipio' | 'poblacion' | 'callejero' | 'portal' | 'toponimo' | string;
  label: string;
  detail: string;
}

const KEEP = new Set(['Codpost', 'Municipio', 'poblacion', 'callejero', 'portal', 'toponimo']);
const TYPE_RANK: Record<string, number> = { Codpost: 0, poblacion: 1, Municipio: 2, callejero: 3, portal: 4, toponimo: 5 };

export async function searchPlaces(q: string): Promise<Place[]> {
  const query = q.trim().slice(0, 80);
  if (query.length < 2) return [];
  return cached(`c:${query.toLowerCase()}`, async () => {
    const list = await fetchJson<CcCandidate[]>(`${BASE}/candidates?q=${encodeURIComponent(query)}&limit=12&countrycode=es`, { timeoutMs: 8000, retries: 1 });
    const seen = new Set<string>();
    return list
      .filter((c) => KEEP.has(c.type))
      .sort((a, b) => (TYPE_RANK[a.type] ?? 9) - (TYPE_RANK[b.type] ?? 9))
      .map((c): Place => {
        if (c.type === 'Codpost') return { id: c.id, type: c.type, label: c.postalCode ?? c.id, detail: 'Código postal' };
        if (c.type === 'Municipio') return { id: c.id, type: c.type, label: c.muni ?? c.address ?? '', detail: c.province ?? 'Municipio' };
        if (c.type === 'poblacion') return { id: c.id, type: c.type, label: c.poblacion ?? c.address ?? '', detail: [c.muni, c.province].filter(Boolean).join(', ') };
        return { id: c.id, type: c.type, label: (c.address ?? '').replace(/\s*\([^)]*\)\s*$/, ''), detail: [c.muni, c.province].filter(Boolean).join(', ') };
      })
      .filter((p) => p.label && !seen.has(p.type + p.label + p.detail) && seen.add(p.type + p.label + p.detail))
      .slice(0, 7);
  });
}

export async function resolvePlace(id: string, type: string, q?: string): Promise<{ lat: number; lng: number } | null> {
  return cached(`f:${type}:${id}`, async () => {
    const url = type === 'Codpost'
      ? `${BASE}/find?q=${encodeURIComponent(id)}&type=Codpost`
      : `${BASE}/find?id=${encodeURIComponent(id)}&type=${encodeURIComponent(type)}${q ? `&q=${encodeURIComponent(q)}` : ''}`;
    const r = await fetchJson<{ lat?: number; lng?: number; geom?: string } | null>(url, { timeoutMs: 8000, retries: 1 }).catch(() => null);
    if (r?.lat && r?.lng) return { lat: r.lat, lng: r.lng };
    // Algunos tipos (viales) solo traen geometría: usamos su primer vértice.
    const m = r?.geom?.match(/(-?\d+\.\d+)\s+(-?\d+\.\d+)/);
    return m ? { lat: Number(m[2]), lng: Number(m[1]) } : null;
  });
}

export async function reverse(lat: number, lng: number): Promise<{ label: string; municipality: string | null } | null> {
  const key = `r:${lat.toFixed(3)}:${lng.toFixed(3)}`;
  return cached(key, async () => {
    const r = await fetchJson<{ address?: string; muni?: string; poblacion?: string; portalNumber?: number } | null>(
      `${BASE}/reverseGeocode?lon=${lng}&lat=${lat}`, { timeoutMs: 6000, retries: 0 },
    ).catch(() => null);
    if (!r) return null;
    const street = r.address ? r.address.charAt(0) + r.address.slice(1).toLowerCase() : null;
    return { label: [street, r.poblacion ?? r.muni].filter(Boolean).join(', '), municipality: r.muni ?? null };
  });
}
