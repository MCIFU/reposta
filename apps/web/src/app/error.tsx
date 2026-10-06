'use client';
export default function Error({ reset }: { reset: () => void }) {
  return (
    <main style={{ width: 'min(640px, 100% - 32px)', margin: '0 auto', padding: '64px 0' }}>
      <h1 style={{ fontSize: '1.6rem' }}>No se pudo cargar REPOSTA</h1>
      <p style={{ color: 'var(--ink-2)' }}>Es posible que el servicio de precios del Ministerio no esté respondiendo. Vuelve a intentarlo en unos segundos.</p>
      <button onClick={reset} style={{ height: 44, padding: '0 18px', borderRadius: 12, border: 0, background: 'var(--ink)', color: 'var(--bg)', fontWeight: 650 }}>Reintentar</button>
    </main>
  );
}
