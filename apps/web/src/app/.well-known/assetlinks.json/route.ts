import { NextResponse } from 'next/server';

/**
 * Digital Asset Links para la app Android (TWA generada con PWABuilder). Si coinciden el paquete y la huella
 * de la clave de firma, Android abre la app a pantalla completa, sin la barra de dirección del navegador.
 *
 * Las huellas SHA-256 son públicas (están pensadas para publicarse aquí); no son secretas.
 * - KNOWN: paquetes ya generados. Añade aquí cada paquete nuevo (p. ej. al pasar a dominio propio).
 * - Variables de entorno opcionales, que se suman a las anteriores:
 *     ANDROID_PACKAGE=com.ejemplo.app
 *     ANDROID_SHA256=AA:BB:...,CC:DD:...   (tu clave y, tras subir a Google Play, la de «Play App Signing»)
 */
const KNOWN: Array<{ pkg: string; sha256: string[] }> = [
  // PWABuilder, 06/10/2026, para https://reposta-two.vercel.app
  { pkg: 'app.vercel.reposta_two.twa', sha256: ['01:12:0A:DE:DE:4A:97:2E:AF:BD:27:B0:52:9D:3F:B0:C3:F0:BA:32:21:8D:27:F9:D1:27:04:ED:22:82:89:34'] },
];

export function GET() {
  const entries = [...KNOWN];
  const pkg = process.env.ANDROID_PACKAGE;
  const prints = (process.env.ANDROID_SHA256 ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (pkg && prints.length) {
    const existing = entries.find((e) => e.pkg === pkg);
    if (existing) existing.sha256 = [...new Set([...existing.sha256, ...prints])];
    else entries.push({ pkg, sha256: prints });
  }
  const body = entries.map((e) => ({
    relation: ['delegate_permission/common.handle_all_urls'],
    target: { namespace: 'android_app', package_name: e.pkg, sha256_cert_fingerprints: e.sha256 },
  }));
  return NextResponse.json(body, { headers: { 'Cache-Control': 'public, max-age=3600' } });
}
