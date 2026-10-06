import { mapPoints, isValidFuel } from '@/server/repository';
import { gzJson, bad } from '@/lib/api';

export async function GET(req: Request) {
  const fuel = new URL(req.url).searchParams.get('fuel') ?? 'g95';
  if (!isValidFuel(fuel)) return bad('Combustible no reconocido.');
  const d = await mapPoints(fuel);
  // format=geojson: lo descarga y procesa directamente el worker de MapLibre (no ocupa el hilo principal).
  if (new URL(req.url).searchParams.get('format') === 'geojson') {
    return gzJson(req, {
      type: 'FeatureCollection',
      features: d.points.map(([id, lat, lng, p]) => ({ type: 'Feature', properties: { id, p }, geometry: { type: 'Point', coordinates: [lng, lat] } })),
    }, 300);
  }
  return gzJson(req, d, 300);
}
