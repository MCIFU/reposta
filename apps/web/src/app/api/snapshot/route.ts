import { getSnapshot, toShared } from '@/server/snapshot';
import { gzJson, bad } from '@/lib/api';

/**
 * Copia compartida de la instantánea ya procesada (estaciones normalizadas, sin los 12 MB originales).
 * La CDN de Vercel la guarda unos minutos; las demás funciones la leen al arrancar en frío en vez de ir al Ministerio.
 * Es la única ruta que descarga de MITECO directamente. Una tarea de GitHub la visita cada 10 min para tenerla caliente.
 */
export async function GET(req: Request) {
  try {
    const s = await getSnapshot({ direct: true, maxAgeMs: 10 * 60_000 });
    return gzJson(req, toShared(s), 300);
  } catch {
    return bad('No se pudo obtener el precio actual de MITECO.', 503);
  }
}
