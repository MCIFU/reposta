import { getSnapshot } from '@/server/snapshot';
import { nearby, isValidFuel } from '@/server/repository';
import { bad } from '@/lib/api';
import { NextResponse } from 'next/server';

type Item =
  | { id: string; type: 'station'; stationId: number; fuel: string }
  | { id: string; type: 'area'; lat: number; lng: number; radiusKm: number; fuel: string };

/** Comprobación en bloque de las alertas guardadas en el dispositivo: devuelve el precio actual de cada una. */
export async function POST(req: Request) {
  let items: Item[];
  try { items = ((await req.json()).items ?? []).slice(0, 30); } catch { return bad('Petición no válida.'); }
  const snap = await getSnapshot();
  const results = await Promise.all(items.map(async (it) => {
    if (!isValidFuel(it.fuel)) return { id: it.id, error: 'combustible' };
    if (it.type === 'station') {
      const s = snap.byId.get(Number(it.stationId));
      return { id: it.id, priceMilli: s?.prices[it.fuel] ?? null, name: s ? `${s.brand}, ${s.locality}` : null };
    }
    const r = await nearby({ origin: { lat: it.lat, lng: it.lng }, fuel: it.fuel, radiusKm: Math.min(50, Math.max(1, it.radiusKm)), sort: 'price', limit: 1 });
    const c = r.cheapest;
    return { id: it.id, priceMilli: c?.priceMilli ?? null, stationId: c?.id ?? null, name: c ? `${c.brand}, ${c.locality}` : null };
  }));
  return NextResponse.json({ sourceTime: snap.sourceTime, results }, { headers: { 'Cache-Control': 'no-store' } });
}
