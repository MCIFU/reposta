import { getBulletin, WOB_PAGE } from '@/server/oil-bulletin';
import { gzJson, bad } from '@/lib/api';

/** Serie oficial semanal de España (Comisión Europea), todos los combustibles disponibles. */
export async function GET(req: Request) {
  try {
    const d = await getBulletin();
    return gzJson(req, {
      source: { name: 'Comisión Europea, Weekly Oil Bulletin', url: WOB_PAGE, kind: 'Media oficial semanal ponderada (con y sin impuestos)' },
      fetchedAt: d.fetchedAt, lastWeek: d.lastWeek, series: d.series,
    }, 3600);
  } catch {
    return bad('No se pudo obtener el histórico oficial de la Comisión Europea. Inténtalo más tarde.', 503);
  }
}
