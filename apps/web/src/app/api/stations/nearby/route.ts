import { nearby, isValidFuel, type SortMode } from '@/server/repository';
import { gzJson, bad, num } from '@/lib/api';

export async function GET(req: Request) {
  const u = new URL(req.url).searchParams;
  const lat = num(u.get('lat'), 27, 44.5);
  const lng = num(u.get('lng'), -18.5, 4.6);
  const fuel = u.get('fuel') ?? 'g95';
  if (lat == null || lng == null) return bad('Indica una ubicación en España (lat, lng).');
  if (!isValidFuel(fuel)) return bad('Combustible no reconocido.');
  const radiusKm = num(u.get('radius'), 1, 50) ?? 10;
  const sort: SortMode = u.get('sort') === 'distance' ? 'distance' : 'price';
  const limit = num(u.get('limit'), 1, 100) ?? 40;
  try {
    const r = await nearby({ origin: { lat, lng }, fuel, radiusKm, sort, limit, openOnly: u.get('open') === '1' });
    return gzJson(req, r, 120);
  } catch {
    return bad('No se pudo obtener el precio actual de MITECO. Inténtalo de nuevo en unos minutos.', 503);
  }
}
