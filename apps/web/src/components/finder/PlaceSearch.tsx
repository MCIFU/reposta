'use client';
import { useEffect, useId, useRef, useState } from 'react';
import styles from './PlaceSearch.module.css';

export interface PickedPlace {
  lat: number;
  lng: number;
  label: string;
  source: 'gps' | 'search' | 'map';
}

interface Place { id: string; type: string; label: string; detail: string }

const TYPE_LABEL: Record<string, string> = { Codpost: 'CP', Municipio: 'Municipio', poblacion: 'Localidad', callejero: 'Calle', portal: 'Dirección', toponimo: 'Lugar' };

export function PlaceSearch({
  current, onPick, onLocate, locating = false, placeholder = 'Ciudad, código postal o dirección', label = 'Buscar ciudad, código postal o dirección', compact = false,
}: {
  current: PickedPlace | null; onPick: (p: PickedPlace) => void; onLocate?: () => void; locating?: boolean;
  placeholder?: string; label?: string; compact?: boolean;
}) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const seq = useRef(0);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) { setItems([]); setBusy(false); return; }
    const my = ++seq.current;
    setBusy(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
        const d = await r.json();
        if (my !== seq.current) return;
        if (!r.ok) throw new Error(d.error);
        setItems(d.places); setActive(d.places.length ? 0 : -1); setErr(null);
      } catch (e) {
        if (my === seq.current) { setItems([]); setErr((e as Error).message || 'El buscador no responde.'); }
      } finally {
        if (my === seq.current) setBusy(false);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  async function choose(p: Place) {
    setOpen(false);
    setBusy(true);
    try {
      const r = await fetch(`/api/geocode/find?id=${encodeURIComponent(p.id)}&type=${encodeURIComponent(p.type)}&q=${encodeURIComponent(p.label)}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      onPick({ lat: d.lat, lng: d.lng, label: p.type === 'Codpost' ? `CP ${p.label}` : p.label, source: 'search' });
      setQ('');
      inputRef.current?.blur();
    } catch (e) {
      setErr((e as Error).message || 'No se encontró ese lugar.');
    } finally {
      setBusy(false);
    }
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(items.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Enter' && open && items[active]) { e.preventDefault(); choose(items[active]); }
    else if (e.key === 'Escape') { setOpen(false); }
  }

  const showList = open && q.trim().length >= 2;

  return (
    <div className={styles.wrap}>
      <div className={styles.field} data-compact={compact || undefined}>
        <svg className={styles.icon} viewBox="0 0 20 20" aria-hidden="true"><circle cx="9" cy="9" r="5.8" fill="none" stroke="currentColor" strokeWidth="1.7" /><path d="m13.4 13.4 3.6 3.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
        <input
          ref={inputRef}
          type="search"
          inputMode="search"
          autoComplete="off"
          enterKeyHint="search"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
          aria-label={label}
          placeholder={current ? current.label : placeholder}
          className={styles.input}
          data-has-place={current ? '' : undefined}
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setErr(null); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKey}
        />
        {busy && <span className={styles.spin} aria-hidden="true" />}
        {onLocate && <button type="button" className={styles.locate} onClick={onLocate} disabled={locating} aria-label="Usar mi ubicación" title="Usar mi ubicación">
          <svg viewBox="0 0 20 20" aria-hidden="true" data-pulse={locating || undefined}>
            <circle cx="10" cy="10" r="3.2" fill="currentColor" />
            <circle cx="10" cy="10" r="6.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M10 1.5v2.6M10 15.9v2.6M1.5 10h2.6M15.9 10h2.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <span className={styles.locateText}>{locating ? 'Localizando…' : 'Mi ubicación'}</span>
        </button>}
      </div>
      {showList && (
        <ul id={listId} role="listbox" className={styles.list} aria-label="Sugerencias">
          {items.map((p, i) => (
            <li
              key={p.type + p.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={styles.item}
              onMouseDown={(e) => { e.preventDefault(); choose(p); }}
              onMouseEnter={() => setActive(i)}
            >
              <span className={styles.itemLabel}>{p.label}</span>
              <span className={styles.itemDetail}>{p.detail}</span>
              <span className={styles.itemType}>{TYPE_LABEL[p.type] ?? ''}</span>
            </li>
          ))}
          {!busy && !items.length && !err && <li className={styles.empty}>Sin coincidencias. Prueba con el nombre del municipio o un código postal.</li>}
          {err && <li className={styles.empty} role="alert">{err}</li>}
          <li className={styles.credit}>Direcciones: CartoCiudad, Instituto Geográfico Nacional</li>
        </ul>
      )}
    </div>
  );
}
