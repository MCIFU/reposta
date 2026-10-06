import { stationById, isValidFuel } from '@/server/repository';
import { stationHistory } from '@/server/history';
import { json, bad, num } from '@/lib/api';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = Number((await ctx.params).id);
  const u = new URL(req.url).searchParams;
  const fuel = u.get('fuel') ?? 'g95';
  const days = num(u.get('days'), 7, 60) ?? 30;
  if (!Number.isInteger(id) || !isValidFuel(fuel)) return bad('Parámetros no válidos.');
  const s = await stationById(id);
  if (!s) return bad('No existe ninguna gasolinera con ese identificador.', 404);
  const h = await stationHistory(id, s.station.municipalityId, fuel, days);
  // 10 min: MITECO actualiza ~cada 30 min y la respuesta incluye el precio actual.
  // Con 3600 se serviría precio viejo 1h desde el CDN.
  return json({ ...h, fuel, current: { priceMilli: s.station.prices[fuel] ?? null, sourceTime: s.meta.sourceTime } }, 600);
}
