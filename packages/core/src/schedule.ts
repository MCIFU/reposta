// Parser del campo «Horario» de MITECO (texto libre). Formatos observados:
//   "L-D: 24H"   "L-D: 07:00-22:00"   "L-V: 06:00-22:00; S: 07:00-15:00"   "L-S: 06:00-22:00"
//   "L: 08:00-14:00 y 16:00-20:00"   "L-V: 07:30-14:30 y 15:30-21:00; S-D: 09:00-14:00"
// Si no se reconoce, se devuelve null y la interfaz muestra el texto original.

export interface OpeningRule {
  /** 1 = lunes … 7 = domingo */
  days: number[];
  /** Intervalos en minutos desde las 00:00. close puede ser > 1440 si cruza medianoche. */
  ranges: Array<[number, number]>;
}

const DAY: Record<string, number> = { L: 1, M: 2, X: 3, J: 4, V: 5, S: 6, D: 7 };

function parseDays(spec: string): number[] | null {
  const out = new Set<number>();
  for (const part of spec.split(',').map((s) => s.trim()).filter(Boolean)) {
    const m = part.match(/^([LMXJVSD])(?:-([LMXJVSD]))?$/);
    if (!m) return null;
    const a = DAY[m[1]];
    const b = m[2] ? DAY[m[2]] : a;
    for (let d = a; ; d = (d % 7) + 1) {
      out.add(d);
      if (d === b) break;
    }
  }
  return [...out].sort();
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

export function parseSchedule(raw: string | null | undefined): OpeningRule[] | null {
  if (!raw) return null;
  const rules: OpeningRule[] = [];
  for (const seg of raw.split(';').map((s) => s.trim()).filter(Boolean)) {
    const m = seg.match(/^([LMXJVSD,\- ]+):\s*(.+)$/i);
    if (!m) return null;
    const days = parseDays(m[1].replace(/\s/g, '').toUpperCase());
    if (!days) return null;
    const body = m[2].trim();
    if (/^24\s*H$/i.test(body)) {
      rules.push({ days, ranges: [[0, 1440]] });
      continue;
    }
    const ranges: Array<[number, number]> = [];
    for (const r of body.split(/\s+y\s+|,/i)) {
      const t = r.trim().match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/);
      if (!t) return null;
      let open = toMin(t[1]);
      let close = toMin(t[2]);
      if (close <= open) close += 1440; // cruza medianoche
      ranges.push([open, close]);
    }
    rules.push({ days, ranges });
  }
  return rules.length ? rules : null;
}

export const is24h = (rules: OpeningRule[] | null) =>
  !!rules && [1, 2, 3, 4, 5, 6, 7].every((d) => rules.some((r) => r.days.includes(d) && r.ranges.some(([a, b]) => a === 0 && b >= 1440)));

/** Día (1-7) y minuto actuales en hora peninsular española. */
export function madridNow(date = new Date()): { day: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  const wd = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(get('weekday')) + 1;
  return { day: wd, minute: Number(get('hour')) * 60 + Number(get('minute')) };
}

/** true / false, o null si el horario no se pudo interpretar. */
export function isOpenAt(rules: OpeningRule[] | null, at = madridNow()): boolean | null {
  if (!rules) return null;
  const prev = at.day === 1 ? 7 : at.day - 1;
  for (const r of rules) {
    for (const [a, b] of r.ranges) {
      if (r.days.includes(at.day) && at.minute >= a && at.minute < b) return true;
      // tramo del día anterior que cruza medianoche
      if (b > 1440 && r.days.includes(prev) && at.minute < b - 1440) return true;
    }
  }
  return false;
}
