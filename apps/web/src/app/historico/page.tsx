import type { Metadata } from 'next';
import { AppNav } from '@/components/AppNav';
import { HistoryExplorer } from '@/components/history/HistoryExplorer';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Histórico del precio de la gasolina y el diésel en España',
  description: 'Evolución semanal del precio medio oficial de la gasolina 95, el diésel y el GLP en España desde 2005, con y sin impuestos.',
};

export default function HistoryPage() {
  return (
    <div className={styles.page}>
      <AppNav />
      <main className={styles.main}>
        <h1 className={styles.title}>Histórico del precio en España</h1>
        <HistoryExplorer />
      </main>
    </div>
  );
}
