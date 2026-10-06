import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DEFAULT_FUEL, isFuelCode } from '@reposta/core';
import { stationById } from '@/server/repository';
import { StationDetail } from '@/components/station/StationDetail';
import { AppNav } from '@/components/AppNav';
import { price } from '@/lib/format';
import styles from './page.module.css';

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ fuel?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const r = await stationById(Number((await params).id));
  if (!r) return { title: 'Gasolinera no encontrada' };
  const s = r.station;
  const p95 = s.prices.g95, pd = s.prices.diesel;
  return {
    title: `${s.brand}, ${s.address} (${s.locality}): precios hoy`,
    description: `Precio oficial hoy en ${s.brand} ${s.locality}: ${[p95 && `gasolina 95 a ${price(p95)} €/L`, pd && `diésel a ${price(pd)} €/L`].filter(Boolean).join(', ')}. Histórico de 30 días, horario y cómo llegar.`,
  };
}

export default async function StationPage({ params, searchParams }: Props) {
  const id = Number((await params).id);
  const sp = await searchParams;
  const r = Number.isInteger(id) ? await stationById(id) : null;
  if (!r) notFound();
  const fuel = isFuelCode(sp.fuel) ? sp.fuel : DEFAULT_FUEL;
  return (
    <div className={styles.page}>
      <AppNav />
      <main className={styles.main}>
        <a href={`/?fuel=${fuel}&lat=${r.station.lat}&lng=${r.station.lng}&en=${encodeURIComponent(r.station.locality)}`} className={styles.back}>Gasolineras cerca de esta</a>
        <StationDetail data={{ meta: r.meta, station: r.station, openNow: r.openNow, national: r.national }} fuel={fuel} headingLevel={1} />
      </main>
    </div>
  );
}
