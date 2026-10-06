import { reverse } from '@/server/geocode';
import { json, bad, num } from '@/lib/api';

export async function GET(req: Request) {
  const u = new URL(req.url).searchParams;
  const lat = num(u.get('lat'), 27, 44.5), lng = num(u.get('lng'), -18.5, 4.6);
  if (lat == null || lng == null) return bad('Ubicación fuera de España.');
  return json((await reverse(lat, lng)) ?? { label: null, municipality: null }, 86400);
}
