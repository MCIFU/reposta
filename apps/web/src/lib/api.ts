import { NextResponse } from 'next/server';
import { gzipSync } from 'node:zlib';

export const json = (data: unknown, maxAge = 60, init?: ResponseInit) =>
  NextResponse.json(data, {
    ...init,
    headers: { 'Cache-Control': `public, max-age=${Math.min(maxAge, 60)}, s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 4}`, ...init?.headers },
  });

export const bad = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });

export const num = (v: string | null, min: number, max: number): number | null => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};

/** JSON comprimido con gzip si el cliente lo acepta (respuestas grandes: puntos del mapa). */
export function gzJson(req: Request, data: unknown, maxAge = 60) {
  const body = JSON.stringify(data);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': `public, max-age=${Math.min(maxAge, 60)}, s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 4}`,
    Vary: 'Accept-Encoding',
  };
  if (/\bgzip\b/.test(req.headers.get('accept-encoding') ?? '')) {
    headers['Content-Encoding'] = 'gzip';
    return new Response(gzipSync(body, { level: 6 }), { headers });
  }
  return new Response(body, { headers });
}
