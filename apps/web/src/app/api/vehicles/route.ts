import data from '@/data/vehicles.json';
import { json, bad } from '@/lib/api';

type V = { make: string; model: string; fuel: string; powertrain: string; cc: number | null; kw: number | null; cv: number | null; l100: number; kg: number | null; years: number[]; units: number };
const all = (data as { vehicles: V[] }).vehicles;
const makes = [...new Set(all.map((v) => v.make))].sort((a, b) => a.localeCompare(b, 'es'));

/** ?  -> marcas · ?make=X -> modelos y versiones de esa marca. Fuente: EEA (ver /datos). */
export async function GET(req: Request) {
  const make = new URL(req.url).searchParams.get('make');
  if (!make) return json({ makes, source: (data as { source: unknown }).source }, 86400);
  if (!makes.includes(make)) return bad('Marca no encontrada.', 404);
  const versions = all.filter((v) => v.make === make).map((v, i) => ({ id: `${make}|${i}`, ...v }));
  return json({ make, versions }, 86400);
}
