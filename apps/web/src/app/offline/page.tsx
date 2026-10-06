import type { Metadata } from 'next';
import { Wordmark } from '@/components/Brand';

export const metadata: Metadata = { title: 'Sin conexión' };

/** Se muestra cuando no hay red y la página pedida no estaba guardada. */
export default function Offline() {
  return (
    <main style={{ width: 'min(560px, 100% - 32px)', margin: '0 auto', padding: '40px 0' }}>
      <Wordmark />
      <h1 style={{ fontSize: 'clamp(2rem, 8vw, 3rem)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, margin: '48px 0 12px' }}>Sin conexión</h1>
      <p style={{ fontSize: '1.15rem', margin: '0 0 8px' }}>REPOSTA necesita internet para mostrarte los precios oficiales de hoy.</p>
      <p style={{ color: 'var(--ink-2)' }}>Cuando vuelvas a tener red, recarga la página. Tus alertas, tu coche y tus ajustes siguen guardados en este dispositivo.</p>
      <a href="/" style={{ display: 'inline-flex', alignItems: 'center', height: 48, padding: '0 22px', marginTop: 16, borderRadius: 14, background: 'var(--ink)', color: 'var(--bg)', fontWeight: 700, textDecoration: 'none' }}>Reintentar</a>
    </main>
  );
}
