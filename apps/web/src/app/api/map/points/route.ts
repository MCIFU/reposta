import { mapPoints, isValidFuel } from '@/server/repository';
import { gzJson, bad } from '@/lib/api';

export async function GET(req: Request) {
  const fuel = new URL(req.url).searchParams.get('fuel') ?? 'g95';
  if (!isValidFuel(fuel)) return bad('Combustible no reconocido.');
  return gzJson(req, await mapPoints(fuel), 300);
}
