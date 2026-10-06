'use client';
import { useEffect, useMemo, useState } from 'react';
import { getFuel } from '@reposta/core';
import { integer } from '@/lib/format';
import styles from './Trip.module.css';

export interface Version {
  id: string; make: string; model: string; fuel: string; powertrain: 'ice' | 'hybrid' | 'phev' | 'bifuel';
  cc: number | null; kw: number | null; cv: number | null; l100: number; kg: number | null; years: number[]; units: number;
}
export interface SavedCar { make: string; model: string; version: Version | null }

const PT: Record<Version['powertrain'], string> = { ice: 'Combustión', hybrid: 'Híbrido', phev: 'Híbrido enchufable', bifuel: 'Bifuel (GLP + gasolina)' };
const versionLabel = (v: Version) =>
  [getFuel(v.fuel)?.name.replace('Gasolina 95', 'Gasolina'), v.cc ? `${(v.cc / 1000).toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} l` : null, v.cv ? `${v.cv} CV` : null, v.powertrain !== 'ice' ? PT[v.powertrain] : null, v.years.length ? `${v.years[0]}${v.years.length > 1 ? `–${v.years[v.years.length - 1]}` : ''}` : null]
    .filter(Boolean).join(' · ');

export function CarPicker({ value, onChange }: { value: SavedCar | null; onChange: (c: SavedCar | null) => void }) {
  const [makes, setMakes] = useState<string[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const make = value?.make ?? '';
  const model = value?.model ?? '';

  useEffect(() => {
    fetch('/api/vehicles').then((r) => r.json()).then((d) => setMakes(d.makes)).catch(() => setErr('No se pudo cargar el catálogo de coches.'));
  }, []);
  useEffect(() => {
    if (!make) { setVersions([]); return; }
    fetch(`/api/vehicles?make=${encodeURIComponent(make)}`).then((r) => r.json()).then((d) => setVersions(d.versions ?? [])).catch(() => setErr('No se pudo cargar el catálogo de coches.'));
  }, [make]);

  const models = useMemo(() => [...new Set(versions.map((v) => v.model))].sort((a, b) => a.localeCompare(b, 'es')), [versions]);
  const modelVersions = useMemo(() => versions.filter((v) => v.model === model).sort((a, b) => b.units - a.units), [versions, model]);
  const v = value?.version ?? null;

  return (
    <div className={styles.car}>
      <div className={styles.carSelects}>
        <label className={styles.field}><span>Marca</span>
          <select value={make} onChange={(e) => onChange(e.target.value ? { make: e.target.value, model: '', version: null } : null)}>
            <option value="">Elige marca</option>
            {makes.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        <label className={styles.field}><span>Modelo</span>
          <select value={model} disabled={!make} onChange={(e) => onChange({ make, model: e.target.value, version: null })}>
            <option value="">{make ? 'Elige modelo' : '—'}</option>
            {models.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        <label className={`${styles.field} ${styles.wide}`}><span>Versión</span>
          <select value={v?.id ?? ''} disabled={!model} onChange={(e) => onChange({ make, model, version: modelVersions.find((x) => x.id === e.target.value) ?? null })}>
            <option value="">{model ? 'Elige versión' : '—'}</option>
            {modelVersions.map((x) => <option key={x.id} value={x.id}>{versionLabel(x)}</option>)}
          </select>
        </label>
      </div>
      {err && <p className={styles.err} role="alert">{err}</p>}
      {v && (
        <div className={styles.carCard}>
          <p className={styles.carName}>{v.make} {v.model}</p>
          <dl className={styles.carSpecs}>
            <div><dt>Consumo homologado</dt><dd className="num">{v.l100.toLocaleString('es-ES')} L/100 km</dd></div>
            <div><dt>Combustible</dt><dd>{getFuel(v.fuel)?.name.replace('Gasolina 95', 'Gasolina')}</dd></div>
            {v.cc && <div><dt>Motor</dt><dd className="num">{integer(v.cc)} cm³{v.cv ? `, ${v.cv} CV (${v.kw} kW)` : ''}</dd></div>}
            <div><dt>Tipo</dt><dd>{PT[v.powertrain]}</dd></div>
            {v.kg && <div><dt>Masa en orden de marcha</dt><dd className="num">{integer(v.kg)} kg</dd></div>}
            <div><dt>Matriculados en España</dt><dd className="num">{integer(v.units)} ({v.years.join(', ')})</dd></div>
          </dl>
          {v.powertrain === 'phev' && (
            <p className={styles.warn}>Los híbridos enchufables homologan un consumo muy bajo porque cuenta la parte eléctrica. En un viaje largo con la batería gastada consumen bastante más: ajusta el consumo abajo.</p>
          )}
          <p className={styles.carSource}>Datos oficiales WLTP: Agencia Europea de Medio Ambiente, media de las unidades matriculadas de esta versión. El consumo real suele ser algo mayor.</p>
        </div>
      )}
    </div>
  );
}
