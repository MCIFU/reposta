'use client';
// Alertas de cambio de precio guardadas en el dispositivo (sin cuenta).
// Se comprueban al abrir REPOSTA y cada 15 minutos mientras está abierta.
import { useSyncExternalStore } from 'react';
import { price } from './format';

export type AlertMode = 'change' | 'below';
export type Alert =
  | { id: string; type: 'station'; stationId: number; fuel: string; label: string; mode: AlertMode; threshold?: number; lastPrice: number | null; createdAt: string }
  | { id: string; type: 'area'; lat: number; lng: number; radiusKm: number; fuel: string; label: string; mode: AlertMode; threshold?: number; lastPrice: number | null; createdAt: string };

export interface AlertEvent {
  id: string;
  alertId: string;
  at: string;
  title: string;
  body: string;
  dir: 'down' | 'up' | 'below';
  href: string;
  read: boolean;
}

interface State { alerts: Alert[]; events: AlertEvent[]; lastCheck: string | null; sourceTime: string | null }
const KEY = 'rp-alerts-v1';
const EMPTY: State = { alerts: [], events: [], lastCheck: null, sourceTime: null };
let state: State = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  try { state = { ...EMPTY, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; } catch {}
  window.addEventListener('storage', (e) => { if (e.key === KEY) { loaded = false; load(); emit(); } });
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} }
function emit() { listeners.forEach((l) => l()); }
function set(next: Partial<State>) { state = { ...state, ...next }; save(); emit(); }

export function useAlerts() {
  return useSyncExternalStore(
    (cb) => { load(); listeners.add(cb); return () => listeners.delete(cb); },
    () => { load(); return state; },
    () => EMPTY,
  );
}

const uid = () => Math.random().toString(36).slice(2, 10);

/** Omit distributivo: conserva los campos de cada tipo de alerta. */
export type NewAlert = Alert extends infer A ? (A extends Alert ? Omit<A, 'id' | 'createdAt'> : never) : never;

export function addAlert(a: NewAlert) {
  load();
  const alert = { ...a, id: uid(), createdAt: new Date().toISOString() } as Alert;
  set({ alerts: [alert, ...state.alerts].slice(0, 30) });
  return alert;
}
export function removeAlert(id: string) { load(); set({ alerts: state.alerts.filter((a) => a.id !== id) }); }
export function markAllRead() { load(); set({ events: state.events.map((e) => ({ ...e, read: true })) }); }
export function clearEvents() { load(); set({ events: [] }); }
export const hasStationAlert = (s: State, stationId: number, fuel: string) => s.alerts.some((a) => a.type === 'station' && a.stationId === stationId && a.fuel === fuel);

/** Consulta los precios actuales y genera avisos donde haya cambios. Devuelve los avisos nuevos. */
export async function checkAlerts(): Promise<AlertEvent[]> {
  load();
  if (!state.alerts.length) return [];
  const items = state.alerts.map((a) => (a.type === 'station'
    ? { id: a.id, type: 'station', stationId: a.stationId, fuel: a.fuel }
    : { id: a.id, type: 'area', lat: a.lat, lng: a.lng, radiusKm: a.radiusKm, fuel: a.fuel }));
  const r = await fetch('/api/alerts/check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items }) });
  if (!r.ok) return [];
  const d = (await r.json()) as { sourceTime: string; results: Array<{ id: string; priceMilli: number | null; name: string | null; stationId?: number | null }> };
  const fresh: AlertEvent[] = [];
  const alerts = state.alerts.map((a) => {
    const res = d.results.find((x) => x.id === a.id);
    if (!res || res.priceMilli == null) return a;
    const now = res.priceMilli, before = a.lastPrice;
    const href = a.type === 'station' ? `/estacion/${a.stationId}?fuel=${a.fuel}` : res.stationId ? `/estacion/${res.stationId}?fuel=${a.fuel}` : '/';
    const where = a.type === 'station' ? a.label : `la más barata de ${a.label} (${res.name})`;
    if (before == null && a.mode === 'below' && a.threshold && now <= a.threshold) {
      fresh.push({ id: uid(), alertId: a.id, at: d.sourceTime, dir: 'below', href, read: false,
        title: `Ya está por debajo de ${price(a.threshold)} €: ${price(now)} €`, body: `${where}.` });
    }
    if (before != null && now !== before) {
      if (a.mode === 'change') {
        const down = now < before;
        fresh.push({ id: uid(), alertId: a.id, at: d.sourceTime, dir: down ? 'down' : 'up', href, read: false,
          title: `${down ? 'Baja' : 'Sube'} ${((Math.abs(now - before)) / 10).toLocaleString('es-ES', { maximumFractionDigits: 1 })} cts: ${price(now)} €`,
          body: `${where}. Antes: ${price(before)} €.` });
      } else if (a.threshold && now <= a.threshold && before > a.threshold) {
        fresh.push({ id: uid(), alertId: a.id, at: d.sourceTime, dir: 'below', href, read: false,
          title: `Por debajo de ${price(a.threshold)} €: ${price(now)} €`, body: `${where}.` });
      }
    }
    return { ...a, lastPrice: now };
  });
  set({ alerts, events: [...fresh, ...state.events].slice(0, 50), lastCheck: new Date().toISOString(), sourceTime: d.sourceTime });
  return fresh;
}
