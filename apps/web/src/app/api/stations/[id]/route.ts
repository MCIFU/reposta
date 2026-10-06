import { stationById } from '@/server/repository';
import { json, bad } from '@/lib/api';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return bad('Identificador no válido.');
  const r = await stationById(id);
  return r ? json(r, 300) : bad('No existe ninguna gasolinera con ese identificador.', 404);
}
