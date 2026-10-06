import { resolvePlace } from '@/server/geocode';
import { json, bad } from '@/lib/api';

export async function GET(req: Request) {
  const u = new URL(req.url).searchParams;
  const id = u.get('id'), type = u.get('type');
  if (!id || !type) return bad('Faltan parámetros.');
  const r = await resolvePlace(id, type, u.get('q') ?? undefined);
  return r ? json(r, 86400) : bad('No se encontró la ubicación de ese lugar.', 404);
}
