// Estadísticos descriptivos usados en «media calculada por REPOSTA» (método v1, ver docs/04-calculos.md).

export interface PriceStats {
  count: number;
  min: number;
  max: number;
  median: number;
  p10: number;
  p90: number;
  /** media recortada p2–p98 */
  avg: number;
}

const q = (sorted: number[], p: number) => {
  if (!sorted.length) return NaN;
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
};

export function priceStats(values: number[]): PriceStats | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const k = Math.floor(s.length * 0.02);
  const core = s.length > 10 ? s.slice(k, s.length - k) : s;
  const avg = core.reduce((a, b) => a + b, 0) / core.length;
  return {
    count: s.length,
    min: s[0],
    max: s[s.length - 1],
    median: Math.round(q(s, 0.5)),
    p10: Math.round(q(s, 0.1)),
    p90: Math.round(q(s, 0.9)),
    avg: Math.round(avg),
  };
}

/** Tercil relativo para colorear: 0 barato, 1 habitual, 2 caro. */
export function relativeBand(price: number, lowCut: number, highCut: number): 0 | 1 | 2 {
  return price <= lowCut ? 0 : price >= highCut ? 2 : 1;
}

export { q as quantile };
