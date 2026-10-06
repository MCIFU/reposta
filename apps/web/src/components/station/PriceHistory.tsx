'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getFuel } from '@reposta/core';
import { price, dayShort, dayMonth, cents } from '@/lib/format';
import styles from './PriceHistory.module.css';

interface Point { date: string; priceMilli: number | null }
interface Data { points: Point[]; source: string; current: { priceMilli: number | null; sourceTime: string } }

const W = 640, H = 180, PAD = { l: 8, r: 52, t: 18, b: 26 };

export function PriceHistory({ stationId, fuel }: { stationId: number; fuel: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    let alive = true;
    setData(null); setErr(false);
    fetch(`/api/stations/${stationId}/history?fuel=${fuel}&days=30`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => alive && setData(d))
      .catch(() => alive && setErr(true));
    return () => { alive = false; };
  }, [stationId, fuel]);

  const series = useMemo(() => {
    if (!data) return null;
    const pts = [...data.points.map((p) => ({ ...p, today: false }))];
    if (data.current.priceMilli != null) pts.push({ date: data.current.sourceTime, priceMilli: data.current.priceMilli, today: true });
    const valid = pts.filter((p) => p.priceMilli != null) as Array<{ date: string; priceMilli: number; today: boolean }>;
    if (valid.length < 2) return { pts, valid, empty: true as const };
    const vals = valid.map((p) => p.priceMilli);
    let min = Math.min(...vals), max = Math.max(...vals);
    if (max - min < 20) { const m = (max + min) / 2; min = m - 10; max = m + 10; }
    const pad = (max - min) * 0.15;
    const y = (v: number) => PAD.t + (1 - (v - (min - pad)) / (max - min + 2 * pad)) * (H - PAD.t - PAD.b);
    const x = (i: number) => PAD.l + (i / (pts.length - 1)) * (W - PAD.l - PAD.r);
    let d = '';
    pts.forEach((p, i) => { if (p.priceMilli == null) return; d += `${d && pts[i - 1]?.priceMilli != null ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.priceMilli).toFixed(1)}`; });
    const first = valid[0], last = valid[valid.length - 1];
    const lo = valid.reduce((a, p) => (p.priceMilli < a.priceMilli ? p : a));
    const hi = valid.reduce((a, p) => (p.priceMilli > a.priceMilli ? p : a));
    return { pts, valid, empty: false as const, x, y, d, first, last, lo, hi, minV: Math.min(...vals), maxV: Math.max(...vals) };
  }, [data]);

  const unit = getFuel(fuel)?.unit ?? 'L';

  if (err) return <p className={styles.note}>No se pudo cargar el histórico de esta gasolinera ahora mismo.</p>;
  if (!data || !series) return <div className={styles.wrap}><div className="skeleton" style={{ height: 180, borderRadius: 14 }} /><p className={styles.note}>Consultando el histórico oficial de los últimos 30 días…</p></div>;
  if (series.empty) return <p className={styles.note}>MITECO no tiene histórico de este combustible en esta gasolinera para los últimos 30 días.</p>;

  const { x, y, d, first, last, lo, hi, pts } = series;
  const delta = last.priceMilli - first.priceMilli;
  const idx = (p: { date: string }) => pts.findIndex((q) => q.date === p.date);
  const hv = hover != null ? pts[hover] : null;

  function move(e: React.PointerEvent) {
    const r = svgRef.current!.getBoundingClientRect();
    const rel = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((rel - PAD.l) / (W - PAD.l - PAD.r)) * (pts.length - 1));
    setHover(Math.max(0, Math.min(pts.length - 1, i)));
  }

  return (
    <figure className={styles.wrap}>
      <figcaption className={styles.head}>
        <span>Últimos 30 días</span>
        <span className={styles.delta} data-dir={delta > 0 ? 'up' : delta < 0 ? 'down' : 'eq'}>
          {delta === 0 ? 'Sin cambios' : `${delta > 0 ? 'Sube' : 'Baja'} ${cents(Math.abs(delta))}`}
        </span>
      </figcaption>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className={styles.svg} onPointerMove={move} onPointerLeave={() => setHover(null)} role="img"
        aria-label={`Precio entre ${price(series.minV)} y ${price(series.maxV)} euros por ${unit} en los últimos 30 días. Hoy ${price(last.priceMilli)}.`}>
        {[lo, hi].map((p, k) => (
          <g key={k}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(p.priceMilli)} y2={y(p.priceMilli)} className={styles.guide} />
            <text x={W - PAD.r + 6} y={y(p.priceMilli) + 4} className={styles.axis}>{price(p.priceMilli)}</text>
          </g>
        ))}
        <path d={d} className={styles.line} />
        <circle cx={x(idx(lo))} cy={y(lo.priceMilli)} r="3.5" className={styles.lo} />
        <circle cx={x(idx(hi))} cy={y(hi.priceMilli)} r="3.5" className={styles.hi} />
        <circle cx={x(pts.length - 1)} cy={y(last.priceMilli)} r="5" className={styles.now} />
        <text x={PAD.l} y={H - 6} className={styles.axis}>{dayShort(pts[0].date)}</text>
        <text x={W - PAD.r} y={H - 6} className={styles.axis} textAnchor="end">Hoy</text>
        {hv && hover != null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={PAD.t - 6} y2={H - PAD.b} className={styles.cursor} />
            {hv.priceMilli != null && <circle cx={x(hover)} cy={y(hv.priceMilli)} r="4" className={styles.now} />}
          </g>
        )}
      </svg>
      <p className={styles.readout} aria-live="polite">
        {hv
          ? <>{hover === pts.length - 1 ? 'Ahora' : dayMonth(hv.date)}: <strong className="num">{hv.priceMilli != null ? `${price(hv.priceMilli)} €/${unit}` : 'sin dato'}</strong></>
          : <>Mínimo {price(lo.priceMilli)} el {dayMonth(lo.date)}. Máximo {price(hi.priceMilli)} el {dayMonth(hi.date)}.</>}
      </p>
      <p className={styles.note}>Precio vigente a las 00:00 de cada día. Fuente: MITECO (histórico oficial). El último punto es el precio actual.</p>
    </figure>
  );
}
