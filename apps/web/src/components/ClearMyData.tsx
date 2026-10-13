'use client';
import { useEffect, useState } from 'react';
import styles from './ClearMyData.module.css';

/** Todo lo que REPOSTA guarda en el dispositivo empieza por «rp-» (ver /privacidad). */
const PREFIX = 'rp-';

interface Saved { car: string | null; place: string | null; alerts: number; other: number }

function readSaved(): Saved | null {
  try {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(PREFIX));
    if (!keys.length) return { car: null, place: null, alerts: 0, other: 0 };
    const car = JSON.parse(localStorage.getItem('rp-car') ?? 'null');
    const place = JSON.parse(localStorage.getItem('rp-place') ?? 'null');
    const alerts = JSON.parse(localStorage.getItem('rp-alerts-v1') ?? '{}')?.alerts?.length ?? 0;
    const known = ['rp-car', 'rp-place', 'rp-alerts-v1'];
    return {
      car: car?.version ? `${car.version.make} ${car.version.model}` : car?.make ? `${car.make} ${car.model ?? ''}`.trim() : null,
      place: place?.label ?? null,
      alerts,
      other: keys.filter((k) => !known.includes(k)).length,
    };
  } catch {
    return null;
  }
}

export function ClearMyData() {
  const [saved, setSaved] = useState<Saved | null>(null);
  const [step, setStep] = useState<'idle' | 'confirm' | 'done'>('idle');
  useEffect(() => setSaved(readSaved()), []);

  async function clearAll() {
    try {
      for (const k of Object.keys(localStorage)) if (k.startsWith(PREFIX)) localStorage.removeItem(k);
      sessionStorage.clear();
    } catch {}
    try {
      if ('caches' in window) for (const k of await caches.keys()) if (k.startsWith('reposta-')) await caches.delete(k);
    } catch {}
    setStep('done');
    setTimeout(() => location.assign('/'), 1400);
  }

  const empty = saved && !saved.car && !saved.place && !saved.alerts && !saved.other;

  return (
    <div className={styles.box}>
      <h2 className={styles.title}>Tus datos en este dispositivo</h2>
      {saved === null && <p className={styles.text}>Este navegador no permite leer el almacenamiento local.</p>}
      {saved && empty && step !== 'done' && <p className={styles.text}>No hay nada guardado: REPOSTA está como recién instalada.</p>}
      {saved && !empty && step !== 'done' && (
        <ul className={styles.list}>
          {saved.car && <li>Tu coche: <strong>{saved.car}</strong></li>}
          {saved.place && <li>Último lugar buscado: <strong>{saved.place}</strong></li>}
          {saved.alerts > 0 && <li>Alertas de precio: <strong>{saved.alerts}</strong></li>}
          {saved.other > 0 && <li>Ajustes (combustible, tema, consumo…): <strong>{saved.other}</strong></li>}
        </ul>
      )}
      <p className={styles.note}>Se guarda solo aquí, nunca en nuestros servidores. Borrarlo no afecta a otros dispositivos.</p>

      {step === 'idle' && !empty && saved && (
        <button type="button" className={styles.danger} onClick={() => setStep('confirm')}>Borrar mis datos</button>
      )}
      {step === 'confirm' && (
        <div className={styles.confirm} role="alertdialog" aria-labelledby="clear-q">
          <p id="clear-q"><strong>¿Borrar todo?</strong> Se eliminarán tu coche, tus alertas, el último lugar y tus ajustes. No se puede deshacer.</p>
          <div className={styles.actions}>
            <button type="button" className={styles.danger} onClick={clearAll} autoFocus>Sí, borrar</button>
            <button type="button" className={styles.ghost} onClick={() => setStep('idle')}>Cancelar</button>
          </div>
        </div>
      )}
      {step === 'done' && <p className={styles.done} role="status">Datos borrados. Volviendo al inicio…</p>}
    </div>
  );
}
