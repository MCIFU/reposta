// Carpeta de cachés en disco (instantáneas MITECO, histórico por municipio, boletín UE).
// - REPOSTA_DATA_DIR si está definida (p. ej. un volumen persistente en Railway).
// - En Vercel solo se puede escribir en /tmp (efímero: se pierde entre arranques, y no pasa nada).
// - En local: ../../data (raíz del repositorio).
import 'server-only';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export const DATA_DIR = process.env.REPOSTA_DATA_DIR
  ? path.resolve(/*turbopackIgnore: true*/ process.env.REPOSTA_DATA_DIR)
  : process.env.VERCEL
    ? '/tmp/reposta-data'
    : path.resolve(/*turbopackIgnore: true*/ process.cwd(), '../../data');

/** Escritura «mejor esfuerzo»: es una caché, nunca debe tumbar una respuesta. */
export async function safeWrite(file: string, data: string | Uint8Array) {
  try {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, data);
  } catch (e) {
    console.warn('[cache] no se pudo escribir', file, (e as Error).message);
  }
}
