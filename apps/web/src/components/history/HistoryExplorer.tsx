'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BrandPrice } from '../Brand';
import { price, cents, dayMonth } from '@/lib/format';
import styles from './HistoryExplorer.module.css';

type Point = [string, number, number | null];
type FuelKey = 'g95' | 'diesel' | 'glp';
interface Data {
  source: { name: string; url: string; kind: string };
  fetchedAt: string;
  lastWeek: string;
  series: Record<FuelKey, Point[]>;
}

// Orden fijo de color por combustible (paleta validada para daltonismo en claro y oscuro).
const FUELS: Array<{ key: FuelKey; name: string; cls: string }> = [
  { key: 'g95', name: 'Gasolina 95', cls: 's0' },
  { key: 'diesel', name: 'Diésel', cls: 's1' },
  { key: 'glp', name: 'GLP', cls: 's2' },
];
const PRESETS = [
  { id: '3m', label: '3 meses', months: 3 },
  { id: '1a', label: '1 año', months: 12 },
  { id: '5a', label: '5 años', months: 60 },
  { id: 'todo', label: 'Todo', months: 0 },
] as const;

const fmtDay = (iso: string) => new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso)).replace('.', '');
const fmtMonth = (iso: string) => new Intl.DateTimeFormat('es-ES', { month: 'short', timeZone: 'UTC' }).format(new Date(iso)).replace('.', '');
const pct = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toLocaleString('es-ES', { maximumFractionDigits: 1 })} %`;

function niceTicks(min: number, max: number, count = 5) {
  const span = max - min || 1;
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0)!;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(Math.round(v));
  return out;
}

/** Ancho del contenedor. Ref de callback: el nodo aparece después de cargar los datos, no en el primer render. */
function useWidth<T extends HTMLElement>() {
  const [w, setW] = useState(0);
  const ro = useRef<ResizeObserver | null>(null);
  const ref = useCallback((node: T | null) => {
    ro.current?.disconnect();
    if (!node) return;
    setW(Math.round(node.getBoundingClientRect().width));
    ro.current = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.current.observe(node);
  }, []);
  return [ref, w] as const;
}

export function HistoryExplorer() {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [fuels, setFuels] = useState<FuelKey[]>(['g95', 'diesel']);
  const [preset, setPreset] = useState<string>('5a');
  const [range, setRange] = useState<{ from: number; to: number } | null>(null);
  const [taxes, setTaxes] = useState(true);
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const [boxRef, width] = useWidth<HTMLDivElement>();

  useEffect(() => {
    fetch('/api/history/national')
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; })
      .then(setData)
      .catch((e) => setErr(e.message || 'No se pudo cargar el histórico.'));
  }, []);

  const years = useMemo(() => {
    if (!data) return [];
    const a = Number(data.series.g95[0][0].slice(0, 4)), b = Number(data.lastWeek.slice(0, 4));
    return Array.from({ length: b - a + 1 }, (_, i) => a + i);
  }, [data]);

  // Ventana temporal
  const win = useMemo(() => {
    if (!data) return null;
    const last = data.lastWeek;
    if (range) return { from: `${range.from}-01-01`, to: `${range.to}-12-31` };
    const p = PRESETS.find((x) => x.id === preset)!;
    if (!p.months) return { from: '0000', to: last };
    const d = new Date(last);
    d.setUTCMonth(d.getUTCMonth() - p.months);
    return { from: d.toISOString().slice(0, 10), to: last };
  }, [data, preset, range]);

  const view = useMemo(() => {
    if (!data || !win) return null;
    const pick = (p: Point) => (taxes ? p[1] : p[2]);
    const dates = data.series.g95.map((p) => p[0]).filter((d) => d >= win.from && d <= win.to);
    const byFuel = Object.fromEntries(
      FUELS.map((f) => {
        const m = new Map(data.series[f.key].map((p) => [p[0], pick(p)]));
        return [f.key, dates.map((d) => m.get(d) ?? null)];
      }),
    ) as Record<FuelKey, Array<number | null>>;
    const stats = FUELS.filter((f) => fuels.includes(f.key)).map((f) => {
      const vals = byFuel[f.key].map((v, i) => [v, i] as const).filter((x): x is readonly [number, number] => x[0] != null);
      if (!vals.length) return null;
      const lo = vals.reduce((a, b) => (b[0] < a[0] ? b : a));
      const hi = vals.reduce((a, b) => (b[0] > a[0] ? b : a));
      const first = vals[0], last = vals[vals.length - 1];
      return {
        ...f, last: last[0], lastDate: dates[last[1]], avg: Math.round(vals.reduce((s, v) => s + v[0], 0) / vals.length),
        min: lo[0], minDate: dates[lo[1]], max: hi[0], maxDate: dates[hi[1]],
        delta: last[0] - first[0], deltaPct: ((last[0] - first[0]) / first[0]) * 100, firstDate: dates[first[1]],
      };
    }).filter((x): x is NonNullable<typeof x> => !!x);
    return { dates, byFuel, stats };
  }, [data, win, fuels, taxes]);

  if (err) return <div className={styles.state} role="alert"><p className={styles.stateTitle}>No hemos podido cargar el histórico</p><p>{err}</p></div>;
  if (!data || !view) return (
    <div aria-busy="true" className={styles.state}>
      <div className="skeleton" style={{ height: 72, width: '55%' }} />
      <div className="skeleton" style={{ height: 320, marginTop: 28, borderRadius: 18 }} />
    </div>
  );

  const head = view.stats.find((s) => s.key === 'g95') ?? view.stats[0];

  // Geometría del gráfico (una sola escala vertical)
  const H = width < 600 ? 260 : 360;
  const pad = { l: 8, r: width < 600 ? 50 : 92, t: 16, b: 28 };
  const plotW = Math.max(10, width - pad.l - pad.r), plotH = H - pad.t - pad.b;
  const visible = FUELS.filter((f) => fuels.includes(f.key));
  const allVals = visible.flatMap((f) => view.byFuel[f.key].filter((v): v is number => v != null));
  const vMin = allVals.length ? Math.min(...allVals) : 0, vMax = allVals.length ? Math.max(...allVals) : 1;
  const padV = (vMax - vMin) * 0.08 || 20;
  const y0 = vMin - padV, y1 = vMax + padV;
  const n = view.dates.length;
  const x = (i: number) => pad.l + (n <= 1 ? 0 : (i / (n - 1)) * plotW);
  const y = (v: number) => pad.t + (1 - (v - y0) / (y1 - y0)) * plotH;
  const ticks = niceTicks(y0, y1, 5).filter((t) => t >= y0 && t <= y1);
  const path = (vals: Array<number | null>) => vals.reduce((d, v, i) => (v == null ? d : `${d}${d && vals[i - 1] != null ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`), '');

  // Marcas del eje X: años o meses según la ventana
  const spanDays = n > 1 ? (new Date(view.dates[n - 1]).getTime() - new Date(view.dates[0]).getTime()) / 86_400_000 : 0;
  const xTicks: Array<{ i: number; label: string }> = [];
  view.dates.forEach((d, i) => {
    const prev = view.dates[i - 1];
    if (spanDays > 800) {
      const yr = Number(d.slice(0, 4));
      const every = spanDays > 4000 ? (width < 600 ? 5 : 2) : 1;
      if (prev && d.slice(0, 4) !== prev.slice(0, 4) && yr % every === 0) xTicks.push({ i, label: String(yr) });
    } else if (prev && d.slice(5, 7) !== prev.slice(5, 7)) {
      const m = Number(d.slice(5, 7));
      const every = spanDays > 200 ? (width < 600 ? 3 : 2) : 1;
      if ((m - 1) % every === 0) xTicks.push({ i, label: m === 1 ? d.slice(0, 4) : fmtMonth(d) });
    }
  });

  function move(e: React.PointerEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left - pad.l) / plotW) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  }
  function key(e: React.KeyboardEvent) {
    if (e.key === 'ArrowLeft') { e.preventDefault(); setHover((h) => Math.max(0, (h ?? n - 1) - 1)); }
    if (e.key === 'ArrowRight') { e.preventDefault(); setHover((h) => Math.min(n - 1, (h ?? n - 1) + 1)); }
    if (e.key === 'Escape') setHover(null);
  }

  const toggleFuel = (k: FuelKey) => setFuels((cur) => (cur.includes(k) ? (cur.length > 1 ? cur.filter((x) => x !== k) : cur) : [...cur, k]));
  const tipLeft = hover != null ? Math.min(Math.max(x(hover) + 12, 0), width - 190) : 0;

  // Medias anuales para la vista de tabla
  const yearly = years.map((yr) => {
    const row: Record<string, number | null> = {};
    for (const f of FUELS) {
      const v = data.series[f.key].filter((p) => p[0].startsWith(String(yr))).map((p) => (taxes ? p[1] : p[2])).filter((x): x is number => x != null);
      row[f.key] = v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
    }
    return { yr, row };
  }).reverse();

  return (
    <div className={styles.wrap}>
      {head && (
        <section className={styles.hero} aria-labelledby="hist-hero">
          <h2 id="hist-hero" className="sr-only">Último dato oficial</h2>
          <BrandPrice milli={head.last} />
          <p className={styles.heroText}>
            {head.name} en España, media oficial de la semana del {dayMonth(head.lastDate)}{taxes ? '' : ', sin impuestos'}.{' '}
            {head.max > head.last && <>Su máximo en este periodo fue {price(head.max)} €/L la semana del {fmtDay(head.maxDate)}.</>}
          </p>
        </section>
      )}

      <div className={styles.controls}>
        <div className={styles.group} role="group" aria-label="Combustibles">
          {FUELS.map((f) => (
            <button key={f.key} type="button" className={styles.chip} aria-pressed={fuels.includes(f.key)} onClick={() => toggleFuel(f.key)}>
              <span className={`${styles.swatch} ${styles[f.cls]}`} aria-hidden="true" />{f.name}
            </button>
          ))}
        </div>
        <div className={styles.group} role="radiogroup" aria-label="Periodo">
          {PRESETS.map((p) => (
            <button key={p.id} type="button" role="radio" className={styles.seg} aria-checked={!range && preset === p.id} onClick={() => { setRange(null); setPreset(p.id); }}>{p.label}</button>
          ))}
        </div>
        <div className={styles.group}>
          <label className={styles.year}>Desde
            <select value={range?.from ?? ''} onChange={(e) => { const from = Number(e.target.value); setRange({ from, to: Math.max(from, range?.to ?? years[years.length - 1]) }); }}>
              <option value="" disabled>año</option>
              {years.map((yr) => <option key={yr} value={yr}>{yr}</option>)}
            </select>
          </label>
          <label className={styles.year}>hasta
            <select value={range?.to ?? ''} onChange={(e) => { const to = Number(e.target.value); setRange({ from: Math.min(to, range?.from ?? years[0]), to }); }}>
              <option value="" disabled>año</option>
              {years.map((yr) => <option key={yr} value={yr}>{yr}</option>)}
            </select>
          </label>
          <label className={styles.check}><input type="checkbox" checked={!taxes} onChange={(e) => setTaxes(!e.target.checked)} /> Sin impuestos</label>
        </div>
      </div>

      <figure className={styles.figure}>
        <figcaption className={styles.caption}>
          Precio medio en España, €/L{taxes ? '' : ' sin impuestos'}, semanal. {n > 0 && <>Del {fmtDay(view.dates[0])} al {fmtDay(view.dates[n - 1])}.</>}
        </figcaption>
        <div className={styles.legend} aria-hidden="true">
          {visible.map((f) => <span key={f.key}><i className={`${styles.swatch} ${styles[f.cls]}`} />{f.name}</span>)}
        </div>
        <div ref={boxRef} className={styles.chartBox}>
          {width > 0 && n > 1 && (
            <svg width={width} height={H} className={styles.svg} onPointerMove={move} onPointerLeave={() => setHover(null)}
              tabIndex={0} onKeyDown={key} onFocus={() => setHover((h) => h ?? n - 1)} onBlur={() => setHover(null)}
              role="img" aria-label={`Evolución semanal del precio medio en España. ${view.stats.map((s) => `${s.name}: de ${price(view.byFuel[s.key].find((v) => v != null) ?? s.last)} a ${price(s.last)} euros por litro`).join('. ')}. Usa las flechas para recorrer las semanas.`}>
              {ticks.map((t) => (
                <g key={t}>
                  <line x1={pad.l} x2={pad.l + plotW} y1={y(t)} y2={y(t)} className={styles.grid} />
                  <text x={pad.l + plotW + 8} y={y(t) + 4} className={styles.axis}>{price(t)}</text>
                </g>
              ))}
              {xTicks.map((t) => (
                <g key={t.i}>
                  <line x1={x(t.i)} x2={x(t.i)} y1={pad.t + plotH} y2={pad.t + plotH + 5} className={styles.grid} />
                  <text x={x(t.i)} y={H - 6} className={styles.axis} textAnchor="middle">{t.label}</text>
                </g>
              ))}
              {visible.map((f) => <path key={f.key} d={path(view.byFuel[f.key])} className={`${styles.line} ${styles[f.cls]}`} />)}
              {hover != null && (
                <g>
                  <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + plotH} className={styles.cursor} />
                  {visible.map((f) => { const v = view.byFuel[f.key][hover]; return v == null ? null : <circle key={f.key} cx={x(hover)} cy={y(v)} r="4.5" className={`${styles.dot} ${styles[f.cls]}`} />; })}
                </g>
              )}
            </svg>
          )}
          {hover != null && (
            <div className={styles.tip} style={{ left: tipLeft }} aria-live="polite">
              <p className={styles.tipDate}>Semana del {fmtDay(view.dates[hover])}</p>
              {visible.map((f) => { const v = view.byFuel[f.key][hover]; return <p key={f.key} className={styles.tipRow}><i className={`${styles.swatch} ${styles[f.cls]}`} />{f.name}<b className="num">{v != null ? price(v) : '—'}</b></p>; })}
            </div>
          )}
        </div>
      </figure>

      <table className={styles.stats}>
        <caption className="sr-only">Resumen del periodo</caption>
        <thead><tr><th scope="col">Periodo elegido</th><th scope="col">Último</th><th scope="col">Media</th><th scope="col">Mínimo</th><th scope="col">Máximo</th><th scope="col">Variación</th></tr></thead>
        <tbody>
          {view.stats.map((s) => (
            <tr key={s.key}>
              <th scope="row"><i className={`${styles.swatch} ${styles[s.cls]}`} aria-hidden="true" />{s.name}</th>
              <td className="num">{price(s.last)}</td>
              <td className="num">{price(s.avg)}</td>
              <td><span className="num">{price(s.min)}</span><small>{fmtDay(s.minDate)}</small></td>
              <td><span className="num">{price(s.max)}</span><small>{fmtDay(s.maxDate)}</small></td>
              <td><span className="num" data-dir={s.delta > 0 ? 'up' : s.delta < 0 ? 'down' : 'eq'}>{s.delta === 0 ? 'Igual' : `${s.delta > 0 ? '+' : '−'}${cents(Math.abs(s.delta))}`}</span><small>{pct(s.deltaPct)} desde {fmtDay(s.firstDate)}</small></td>
            </tr>
          ))}
        </tbody>
      </table>

      <button type="button" className={styles.tableBtn} aria-expanded={showTable} onClick={() => setShowTable((v) => !v)}>
        {showTable ? 'Ocultar medias anuales' : 'Ver medias anuales en tabla'}
      </button>
      {showTable && (
        <table className={styles.yearly}>
          <caption className={styles.caption}>Media anual de los datos semanales, €/L{taxes ? '' : ' sin impuestos'}. Calculada por REPOSTA a partir del boletín oficial.</caption>
          <thead><tr><th scope="col">Año</th>{FUELS.map((f) => <th key={f.key} scope="col">{f.name}</th>)}</tr></thead>
          <tbody>{yearly.map(({ yr, row }) => <tr key={yr}><th scope="row">{yr}</th>{FUELS.map((f) => <td key={f.key} className="num">{row[f.key] != null ? price(row[f.key]!) : '—'}</td>)}</tr>)}</tbody>
        </table>
      )}

      <div className={styles.source}>
        <p><strong>Fuente:</strong> {data.source.name} (<a href={data.source.url} target="_blank" rel="noopener">energy.ec.europa.eu</a>). Media oficial semanal para España, ponderada por la Comisión; incluye impuestos salvo que marques «Sin impuestos». Último boletín: semana del {fmtDay(data.lastWeek)}.</p>
        <p>Es una serie distinta de los precios por gasolinera de MITECO que ves en el buscador. La gasolina 98 no figura en este boletín. El histórico diario por comunidad, provincia y municipio (MITECO, desde 2007) llegará en la siguiente fase.</p>
      </div>
    </div>
  );
}
