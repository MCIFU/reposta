'use client';
import { FUELS, PRIMARY_FUELS } from '@reposta/core';
import styles from './FuelPicker.module.css';

const OTHERS = FUELS.filter((f) => !f.primary && f.searchable);
const LABEL: Record<string, { big: string; small: string }> = {
  g95: { big: '95', small: 'Gasolina' },
  g98: { big: '98', small: 'Gasolina' },
  diesel: { big: 'Diésel', small: 'Gasóleo A' },
  glp: { big: 'GLP', small: 'Autogás' },
};

/** Cinco casillas idénticas: 95 · 98 · Diésel · GLP · Otros. */
export function FuelPicker({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const other = OTHERS.find((f) => f.code === value);
  return (
    <fieldset className={styles.group}>
      <legend className="sr-only">Combustible</legend>
      {PRIMARY_FUELS.map((f) => (
        <label key={f.code} className={styles.opt} data-on={value === f.code || undefined}>
          <input type="radio" name="fuel" value={f.code} checked={value === f.code} onChange={() => onChange(f.code)} />
          <span className={styles.small} aria-hidden="true">{LABEL[f.code].small}</span>
          <span className={styles.big}><span className="sr-only">{LABEL[f.code].small} </span>{LABEL[f.code].big}</span>
        </label>
      ))}
      <label className={styles.opt} data-on={other ? true : undefined}>
        <span className={styles.small} aria-hidden="true">{other ? 'Otros' : 'Más'}</span>
        <span className={styles.big} aria-hidden="true">{other ? other.short : 'Otros'}</span>
        <select className={styles.select} value={other?.code ?? ''} onChange={(e) => e.target.value && onChange(e.target.value)} aria-label="Otros combustibles">
          <option value="">Otros combustibles</option>
          {OTHERS.map((f) => (
            <option key={f.code} value={f.code}>{f.name}{f.unit !== 'L' ? ` (€/${f.unit})` : ''}</option>
          ))}
        </select>
      </label>
    </fieldset>
  );
}
