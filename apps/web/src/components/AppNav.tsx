'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Wordmark } from './Brand';
import { ThemeToggle } from './ThemeToggle';
import { AlertsBell } from './alerts/AlertsBell';
import styles from './AppNav.module.css';

const TABS = [
  { href: '/', label: 'Precios', icon: 'M4 18V9l8-5 8 5v9M9 18v-5h6v5' },
  { href: '/historico', label: 'Histórico', icon: 'M4 19h16M5 15l4-5 4 3 6-7' },
  { href: '/viaje', label: 'Viaje', icon: 'M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM6 15V9a3 3 0 0 1 3-3h4M18 9v6a3 3 0 0 1-3 3h-4' },
  { href: '/datos', label: 'Datos', icon: 'M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3ZM4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6' },
] as const;

/** Cabecera con pestañas (escritorio) y barra inferior (móvil). Una sola fuente de verdad para la navegación. */
export function AppNav() {
  const path = usePathname();
  const isActive = (href: string) => (href === '/' ? path === '/' || path.startsWith('/estacion') : path.startsWith(href));
  return (
    <>
      <header className={styles.header}>
        <Wordmark />
        <nav className={styles.tabs} aria-label="Secciones">
          {TABS.map((t) => (
            <Link key={t.href} href={t.href} className={styles.tab} aria-current={isActive(t.href) ? 'page' : undefined}>{t.label}</Link>
          ))}
        </nav>
        <div className={styles.actions}><AlertsBell /><ThemeToggle /></div>
      </header>
      <nav className={styles.bottom} aria-label="Secciones">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} className={styles.bItem} aria-current={isActive(t.href) ? 'page' : undefined}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d={t.icon} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span>{t.label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
