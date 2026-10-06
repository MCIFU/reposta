'use client';
import { useEffect, useRef, useState } from 'react';
import type { TripPrefs } from '@/lib/prefs';
import styles from './TripSettings.module.css';

export function TripSettings({ open, value, unit, onClose, onSave }: { open: boolean; value: TripPrefs; unit: string; onClose: () => void; onSave: (v: TripPrefs) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [liters, setLiters] = useState(String(value.liters));
  const [cons, setCons] = useState(String(value.consumption).replace('.', ','));
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) { setLiters(String(value.liters)); setCons(String(value.consumption).replace('.', ',')); setErr(null); d.showModal(); }
    if (!open && d.open) d.close();
  }, [open, value]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const l = Number(liters.replace(',', '.')), c = Number(cons.replace(',', '.'));
    if (!(l >= 1 && l <= 200)) return setErr(`Indica entre 1 y 200 ${unit === 'L' ? 'litros' : unit}.`);
    if (!(c >= 1 && c <= 40)) return setErr('Indica un consumo entre 1 y 40 L/100 km.');
    onSave({ liters: Math.round(l * 10) / 10, consumption: Math.round(c * 10) / 10 });
  }

  return (
    <dialog ref={ref} className={styles.dialog} onClose={onClose} onClick={(e) => e.target === ref.current && onClose()} aria-labelledby="trip-title">
      <form onSubmit={submit} className={styles.form}>
        <h2 id="trip-title" className={styles.title}>Tu repostaje</h2>
        <p className={styles.help}>Con estos datos calculamos si compensa desplazarse: lo que ahorras en el precio menos lo que gastas en ir y volver.</p>
        <label className={styles.field}>
          <span>Cantidad a repostar</span>
          <span className={styles.input}><input inputMode="decimal" value={liters} onChange={(e) => setLiters(e.target.value)} required /><em>{unit === 'L' ? 'litros' : unit}</em></span>
        </label>
        <label className={styles.field}>
          <span>Consumo medio de tu coche</span>
          <span className={styles.input}><input inputMode="decimal" value={cons} onChange={(e) => setCons(e.target.value)} required /><em>L/100 km</em></span>
        </label>
        {err && <p className={styles.err} role="alert">{err}</p>}
        <p className={styles.note}>Se guarda solo en este dispositivo.</p>
        <div className={styles.actions}>
          <button type="button" className={styles.ghost} onClick={onClose}>Cancelar</button>
          <button type="submit" className={styles.primary}>Guardar</button>
        </div>
      </form>
    </dialog>
  );
}
