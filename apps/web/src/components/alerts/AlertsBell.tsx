'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { getFuel, PRIMARY_FUELS } from '@reposta/core';
import { useAlerts, checkAlerts, removeAlert, markAllRead, clearEvents, addAlert, type AlertEvent } from '@/lib/alerts';
import { price, ago } from '@/lib/format';
import styles from './Alerts.module.css';

const CHECK_MS = 15 * 60_000;

/** Campana de la cabecera: comprueba las alertas, muestra avisos y gestiona las alertas guardadas. */
export function AlertsBell() {
  const s = useAlerts();
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<AlertEvent | null>(null);
  const dlg = useRef<HTMLDialogElement>(null);
  const unread = s.events.filter((e) => !e.read).length;

  // Comprobación: al abrir, cada 15 min y al volver a la pestaña.
  useEffect(() => {
    let last = 0;
    const run = async () => {
      if (Date.now() - last < 60_000) return;
      last = Date.now();
      const fresh = await checkAlerts().catch(() => []);
      if (!fresh.length) return;
      setToast(fresh[0]);
      if (document.visibilityState === 'hidden' && 'Notification' in window && Notification.permission === 'granted') {
        for (const e of fresh.slice(0, 3)) new Notification(`REPOSTA: ${e.title}`, { body: e.body, icon: '/icon.svg', tag: e.id });
      }
    };
    run();
    const t = setInterval(run, CHECK_MS);
    const vis = () => document.visibilityState === 'visible' && run();
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis); };
  }, [s.alerts.length]);

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 9000); return () => clearTimeout(t); }, [toast]);

  useEffect(() => {
    const d = dlg.current; if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <>
      <button type="button" className={styles.bell} onClick={() => setOpen(true)} aria-label={unread ? `Alertas, ${unread} avisos sin leer` : 'Alertas de precio'} title="Alertas de precio">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Zm4 4a2 2 0 0 0 4 0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" /></svg>
        {unread > 0 && <span className={styles.badge} aria-hidden="true">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {toast && (
        <div className={styles.toast} role="status" data-dir={toast.dir}>
          <Link href={toast.href} onClick={() => setToast(null)}><strong>{toast.title}</strong><span>{toast.body}</span></Link>
          <button type="button" onClick={() => setToast(null)} aria-label="Cerrar aviso">×</button>
        </div>
      )}

      <dialog ref={dlg} className={styles.panel} onClose={() => { setOpen(false); markAllRead(); }} onClick={(e) => e.target === dlg.current && setOpen(false)} aria-labelledby="alerts-title">
        <div className={styles.inner}>
          <div className={styles.head}>
            <h2 id="alerts-title">Alertas de precio</h2>
            <button type="button" className={styles.close} onClick={() => setOpen(false)} aria-label="Cerrar">×</button>
          </div>
          <p className={styles.note}>
            Se guardan en este dispositivo y se comprueban al abrir REPOSTA y cada 15 minutos mientras está abierta.
            {s.lastCheck && <> Última comprobación {ago(s.lastCheck)}.</>}
          </p>
          <NotifyToggle />

          <section aria-labelledby="ev-title">
            <div className={styles.secHead}>
              <h3 id="ev-title">Cambios recientes</h3>
              {s.events.length > 0 && <button type="button" className={styles.link} onClick={clearEvents}>Borrar</button>}
            </div>
            {s.events.length === 0 ? (
              <p className={styles.empty}>{s.alerts.length ? 'Sin cambios desde que creaste tus alertas.' : 'Aquí aparecerán los cambios de precio de tus alertas.'}</p>
            ) : (
              <ul className={styles.events}>
                {s.events.slice(0, 12).map((e) => (
                  <li key={e.id} data-dir={e.dir} data-unread={!e.read || undefined}>
                    <Link href={e.href} onClick={() => setOpen(false)}>
                      <strong>{e.title}</strong><span>{e.body}</span><time dateTime={e.at}>{ago(e.at)}</time>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="al-title">
            <h3 id="al-title">Tus alertas</h3>
            {s.alerts.length === 0 && <p className={styles.empty}>Aún no tienes alertas. Crea una para tu zona aquí abajo o desde la ficha de cualquier gasolinera («Avisarme si cambia»).</p>}
            <ul className={styles.alerts}>
              {s.alerts.map((a) => (
                <li key={a.id}>
                  <div>
                    <strong>{a.type === 'station' ? a.label : `La más barata en ${a.label} (${a.radiusKm} km)`}</strong>
                    <span>{getFuel(a.fuel)?.name}, {a.mode === 'change' ? 'cualquier cambio' : `cuando baje de ${price(a.threshold!)} €`}{a.lastPrice != null ? `. Ahora: ${price(a.lastPrice)} €` : ''}</span>
                  </div>
                  <button type="button" className={styles.remove} onClick={() => removeAlert(a.id)} aria-label="Eliminar alerta">Quitar</button>
                </li>
              ))}
            </ul>
            <AreaForm />
          </section>
        </div>
      </dialog>
    </>
  );
}

function NotifyToggle() {
  const [perm, setPerm] = useState<string>('default');
  useEffect(() => { if ('Notification' in window) setPerm(Notification.permission); else setPerm('unsupported'); }, []);
  if (perm === 'unsupported' || perm === 'granted') return perm === 'granted' ? <p className={styles.ok}>Notificaciones del sistema activadas.</p> : null;
  if (perm === 'denied') return <p className={styles.note}>Las notificaciones del sistema están bloqueadas en este navegador; verás los avisos dentro de REPOSTA.</p>;
  return <button type="button" className={styles.secondary} onClick={async () => setPerm(await Notification.requestPermission())}>Activar notificaciones del sistema</button>;
}

/** Alerta de zona: usa el último lugar buscado en Precios. */
function AreaForm() {
  const [place, setPlace] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const [fuel, setFuel] = useState('g95');
  const [mode, setMode] = useState<'change' | 'below'>('change');
  const [thr, setThr] = useState('');
  const [radius, setRadius] = useState(10);
  useEffect(() => {
    try { setPlace(JSON.parse(localStorage.getItem('rp-place') ?? 'null')); const f = localStorage.getItem('rp-fuel'); if (f) setFuel(f); } catch {}
  }, []);
  if (!place) return <p className={styles.empty}>Para vigilar tu zona, busca primero un lugar en <Link href="/" className={styles.inlineLink}>Precios</Link>.</p>;
  const thrMilli = Math.round(Number(thr.replace(',', '.')) * 1000);
  const valid = mode === 'change' || (thrMilli > 300 && thrMilli < 4000);
  return (
    <form className={styles.form} onSubmit={(e) => { e.preventDefault(); if (!valid) return; addAlert({ type: 'area', lat: place.lat, lng: place.lng, radiusKm: radius, fuel, label: place.label, mode, threshold: mode === 'below' ? thrMilli : undefined, lastPrice: null }); setThr(''); }}>
      <p className={styles.formTitle}>Nueva alerta en <strong>{place.label}</strong></p>
      <div className={styles.row}>
        <select value={fuel} onChange={(e) => setFuel(e.target.value)} aria-label="Combustible">{PRIMARY_FUELS.map((f) => <option key={f.code} value={f.code}>{f.name}</option>)}</select>
        <select value={radius} onChange={(e) => setRadius(Number(e.target.value))} aria-label="Radio">{[5, 10, 20, 30].map((n) => <option key={n} value={n}>{n} km</option>)}</select>
      </div>
      <div className={styles.row}>
        <select value={mode} onChange={(e) => setMode(e.target.value as 'change' | 'below')} aria-label="Cuándo avisar">
          <option value="change">Avisar si cambia la más barata</option>
          <option value="below">Avisar si baja de…</option>
        </select>
        {mode === 'below' && <input inputMode="decimal" placeholder="1,700" value={thr} onChange={(e) => setThr(e.target.value)} aria-label="Precio en euros por litro" />}
      </div>
      <button type="submit" className={styles.primary} disabled={!valid}>Crear alerta</button>
    </form>
  );
}
