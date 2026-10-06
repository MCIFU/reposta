const p3 = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const eur2 = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const n1 = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });
const int = new Intl.NumberFormat('es-ES');

/** 1707 -> «1,707» */
export const price = (milli: number) => p3.format(milli / 1000);
/** Divide «1,707» en «1» y «707» para componer la coma de marca. */
export const priceParts = (milli: number) => {
  const [a, b] = price(milli).split(',');
  return { int: a, dec: b };
};
export const eur = (v: number) => `${eur2.format(v)} €`;
export const signedEur = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${eur2.format(Math.abs(v))} €`;
export const cents = (milliDiff: number) => `${n1.format(milliDiff / 10)} cts`;
export const km = (v: number) => (v < 1 ? `${Math.round(v * 1000 / 50) * 50} m` : `${n1.format(v)} km`);
export const minutes = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`);
export const integer = (v: number) => int.format(v);

const timeFmt = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' });
const dateFmt = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', day: 'numeric', month: 'long' });
const shortDate = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', day: 'numeric', month: 'short' });

export const clock = (iso: string) => timeFmt.format(new Date(iso));
export const dayMonth = (iso: string) => dateFmt.format(new Date(iso));
export const dayShort = (iso: string) => shortDate.format(new Date(iso)).replace('.', '');

/** «hace 12 min», «hace 2 h», o fecha y hora si es de otro día. */
export function ago(iso: string, now = Date.now()) {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const m = Math.round(diff / 60_000);
  if (m < 1) return 'hace un momento';
  if (m < 60) return `hace ${m} min`;
  if (m < 60 * 12) return `hace ${Math.round(m / 60)} h`;
  return `el ${dayMonth(iso)} a las ${clock(iso)}`;
}
