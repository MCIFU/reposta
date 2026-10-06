import { planRoute } from '@/server/routing';
import { isValidFuel } from '@/server/repository';
import { gzJson, bad } from '@/lib/api';

/** POST { points: [{lat,lng}, ...] (2 a 10), fuel } -> ruta, tramos y gasolineras en el trayecto. */
export async function POST(req: Request) {
  let body: { points?: Array<{ lat: number; lng: number }>; fuel?: string };
  try { body = await req.json(); } catch { return bad('Petición no válida.'); }
  const pts = (body.points ?? []).filter((p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lng));
  const fuel = body.fuel ?? 'g95';
  if (pts.length < 2 || pts.length > 10) return bad('Indica un origen, un destino y hasta 8 paradas.');
  if (pts.some((p) => p.lat < 27 || p.lat > 44.5 || p.lng < -18.5 || p.lng > 4.6)) return bad('Por ahora solo calculamos viajes dentro de España.');
  if (!isValidFuel(fuel)) return bad('Combustible no reconocido.');
  try {
    return gzJson(req, await planRoute(pts, fuel), 300);
  } catch (e) {
    return bad((e as Error).message || 'No se pudo calcular la ruta.', 502);
  }
}
