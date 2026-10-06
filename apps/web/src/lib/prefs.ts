'use client';
// Preferencias por dispositivo (fase 1, sin cuenta). En la fase 4 se migran a la cuenta al iniciar sesión.
import { useCallback, useEffect, useState } from 'react';

export interface TripPrefs {
  liters: number;
  consumption: number; // L/100 km
}
export const DEFAULT_TRIP: TripPrefs = { liters: 40, consumption: 6.5 };

function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? { ...fallback, ...JSON.parse(v) } : fallback;
  } catch {
    return fallback;
  }
}

export function useStored<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(fallback);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setValue(read(key, fallback));
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const update = useCallback(
    (v: T) => {
      setValue(v);
      try {
        localStorage.setItem(key, JSON.stringify(v));
      } catch {}
    },
    [key],
  );
  return [value, update, ready] as const;
}

export function readFuel(): string | null {
  try {
    return localStorage.getItem('rp-fuel');
  } catch {
    return null;
  }
}
export function storeFuel(code: string) {
  try {
    localStorage.setItem('rp-fuel', code);
  } catch {}
}
