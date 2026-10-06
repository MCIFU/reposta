'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { LatLng } from '@reposta/core';
import { StationDetail, type StationPayload } from './StationDetail';
import styles from './StationSheet.module.css';

/** Panel de estación: hoja inferior en móvil, panel lateral en escritorio. */
export function StationSheet({ id, fuel, origin, onClose }: { id: number; fuel: string; origin: LatLng | null; onClose: () => void }) {
  const [data, setData] = useState<StationPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let alive = true;
    setData(null); setErr(null);
    fetch(`/api/stations/${id}`)
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; })
      .then((d) => alive && setData(d))
      .catch((e) => alive && setErr(e.message || 'No se pudo cargar la gasolinera.'));
    ref.current?.scrollTo({ top: 0 });
    return () => { alive = false; };
  }, [id]);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeBtn.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); prev?.focus?.({ preventScroll: true }); };
  }, [onClose]);

  return (
    <>
      <div className={styles.scrim} onClick={onClose} aria-hidden="true" />
      <div ref={ref} className={styles.sheet} role="dialog" aria-modal="false" aria-label={data ? `Gasolinera ${data.station.brand}` : 'Gasolinera'}>
        <div className={styles.bar}>
          <span className={styles.grip} aria-hidden="true" />
          <Link href={`/estacion/${id}?fuel=${fuel}`} className={styles.full}>Ficha completa</Link>
          <button ref={closeBtn} type="button" className={styles.close} onClick={onClose} aria-label="Cerrar">
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </button>
        </div>
        <div className={styles.body}>
          {err && <p role="alert">{err}</p>}
          {!data && !err && (
            <div aria-busy="true">
              <div className="skeleton" style={{ height: 30, width: '50%' }} />
              <div className="skeleton" style={{ height: 14, width: '70%', marginTop: 12 }} />
              <div className="skeleton" style={{ height: 56, width: '45%', marginTop: 28 }} />
              <div className="skeleton" style={{ height: 50, marginTop: 24, borderRadius: 14 }} />
            </div>
          )}
          {data && <StationDetail data={data} fuel={fuel} origin={origin} />}
        </div>
      </div>
    </>
  );
}
