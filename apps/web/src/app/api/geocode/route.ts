import { searchPlaces } from '@/server/geocode';
import { json, bad } from '@/lib/api';

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('q') ?? '';
  try {
    return json({ places: await searchPlaces(q), source: 'CartoCiudad (IGN)' }, 86400);
  } catch {
    return bad('El buscador de direcciones no responde. Prueba con tu ubicación o con el mapa.', 503);
  }
}
