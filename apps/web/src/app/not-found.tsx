import Link from 'next/link';
import { Wordmark } from '@/components/Brand';

export default function NotFound() {
  return (
    <main style={{ width: 'min(640px, 100% - 32px)', margin: '0 auto', padding: '32px 0' }}>
      <Wordmark />
      <h1 style={{ fontSize: '2rem', margin: '48px 0 8px' }}>Esta página no existe</h1>
      <p style={{ color: 'var(--ink-2)' }}>Puede que la gasolinera haya dejado de publicar precios o que el enlace esté incompleto.</p>
      <p><Link href="/" style={{ color: 'var(--brand)', fontWeight: 650 }}>Buscar gasolineras</Link></p>
    </main>
  );
}
