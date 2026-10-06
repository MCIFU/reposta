import { NextResponse } from 'next/server';

/**
 * Digital Asset Links para la app Android (TWA generada con PWABuilder): permite abrirla a pantalla completa, sin barra del navegador.
 * Configuración por variables de entorno (las da PWABuilder al generar el paquete):
 *   ANDROID_PACKAGE=es.reposta.app
 *   ANDROID_SHA256=AA:BB:...   (una o varias huellas separadas por comas: la de tu clave y la de Google Play App Signing)
 */
export function GET() {
  const pkg = process.env.ANDROID_PACKAGE;
  const prints = (process.env.ANDROID_SHA256 ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const body = pkg && prints.length
    ? [{ relation: ['delegate_permission/common.handle_all_urls'], target: { namespace: 'android_app', package_name: pkg, sha256_cert_fingerprints: prints } }]
    : [];
  return NextResponse.json(body, { headers: { 'Cache-Control': 'public, max-age=3600' } });
}
