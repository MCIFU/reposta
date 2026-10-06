#!/usr/bin/env node
// Genera el catálogo de coches de REPOSTA a partir del dataset oficial de la Agencia Europea de Medio Ambiente (EEA):
// «Monitoring of CO2 emissions from passenger cars (Regulation (EU) 2019/631)», vía su API SQL pública DISCODATA.
// Solo turismos matriculados en ESPAÑA (MS='ES'), años 2021-2024 (datos finales), con consumo WLTP (Fc, L/100 km).
// Uso: node tools/build-vehicles.mjs  ->  apps/web/src/data/vehicles.json
import { writeFileSync, mkdirSync } from 'node:fs';

const TABLES = ['co2cars_2021Fv24', 'co2cars_2022Fv26', 'co2cars_2023Fv28', 'co2cars_2024Fv30'];
const API = 'https://discodata.eea.europa.eu/sql';
const MIN_UNITS = 10; // versiones con muy pocas matriculaciones se descartan (ruido, importaciones sueltas)

const FUEL = { petrol: 'g95', diesel: 'diesel', lpg: 'glp', ng: 'gnc', 'petrol/electric': 'g95', 'diesel/electric': 'diesel' };
const MAKE_FIX = [
  [/^MITSUBISHI/, 'Mitsubishi'], [/LAMBORGHINI/, 'Lamborghini'], [/^MERCEDES AMG$/, 'Mercedes-AMG'], [/^MERCEDES-BENZ$/, 'Mercedes-Benz'],
  [/^BMW$/, 'BMW'], [/^MG$/, 'MG'], [/^DS$/, 'DS'], [/^DR$/, 'DR'], [/^BYD$/, 'BYD'], [/^DFSK$/, 'DFSK'], [/^KG MOBILITY$/, 'KG Mobility'],
  [/^LYNK&CO$/, 'Lynk & Co'], [/^MINI$/, 'MINI'], [/^SEAT$/, 'SEAT'], [/^CUPRA$/, 'CUPRA'], [/^EVO$/, 'EVO'],
];
const title = (s) => s.toLowerCase().replace(/(^|[\s\-/(])([a-zà-ÿ])/g, (m, a, b) => a + b.toUpperCase());
const makeName = (mk) => (MAKE_FIX.find(([re]) => re.test(mk))?.[1]) ?? title(mk);

function modelName(make, cn) {
  let m = cn.trim().toUpperCase();
  for (const p of [make.toUpperCase(), make.toUpperCase().split(/[\s-]/)[0]]) if (m.startsWith(p + ' ')) m = m.slice(p.length + 1);
  return m.replace(/\s+/g, ' ').split(' ').map((w) => (/\d/.test(w) && w.length <= 6 ? w : /^[A-Z]{1,3}$/.test(w) ? w : title(w))).join(' ');
}

async function query(sql) {
  const res = await fetch(`${API}?query=${encodeURIComponent(sql)}&p=1&nrOfHits=20000`);
  const d = await res.json();
  if (d.errors) throw new Error(JSON.stringify(d.errors));
  return d.results;
}

const groups = new Map();
for (const t of TABLES) {
  const rows = await query(`SELECT Mk, Cn, Ft, Fm, [Ec (cm3)] AS ec, [Ep (KW)] AS kw, COUNT(*) AS n, AVG(Fc) AS fc, AVG([M (kg)]) AS m, MAX(Year) AS y
    FROM [CO2Emission].[latest].[${t}] WHERE MS='ES' AND Fc IS NOT NULL AND Fc > 0 AND Mk IS NOT NULL AND Cn IS NOT NULL
    GROUP BY Mk, Cn, Ft, Fm, [Ec (cm3)], [Ep (KW)]`);
  console.log(t, rows.length, 'grupos');
  for (const r of rows) {
    const ft = String(r.Ft ?? '').toLowerCase();
    if (!FUEL[ft]) continue; // eléctricos, hidrógeno, etc. no aplican a este cálculo
    const make = makeName(String(r.Mk).trim());
    const model = modelName(make, String(r.Cn));
    const k = [make, model, ft, r.Fm, r.ec, r.kw].join('|');
    const g = groups.get(k) ?? { make, model, ft, fm: r.Fm, ec: r.ec, kw: r.kw, n: 0, fcSum: 0, mSum: 0, years: new Set() };
    g.n += r.n; g.fcSum += r.fc * r.n; g.mSum += (r.m ?? 0) * r.n; g.years.add(r.y);
    groups.set(k, g);
  }
}

const vehicles = [...groups.values()]
  .filter((g) => g.n >= MIN_UNITS)
  .map((g) => ({
    make: g.make,
    model: g.model,
    fuel: FUEL[g.ft],
    powertrain: g.fm === 'P' ? 'phev' : g.fm === 'H' ? 'hybrid' : g.ft === 'lpg' || g.fm === 'B' ? 'bifuel' : 'ice',
    cc: g.ec ?? null,
    kw: g.kw ?? null,
    cv: g.kw ? Math.round(g.kw * 1.35962) : null,
    l100: Math.round((g.fcSum / g.n) * 10) / 10,
    kg: g.mSum ? Math.round(g.mSum / g.n) : null,
    years: [...g.years].sort(),
    units: g.n,
  }))
  .sort((a, b) => a.make.localeCompare(b.make) || a.model.localeCompare(b.model) || b.units - a.units);

mkdirSync(new URL('../apps/web/src/data/', import.meta.url), { recursive: true });
writeFileSync(new URL('../apps/web/src/data/vehicles.json', import.meta.url), JSON.stringify({
  source: {
    name: 'Agencia Europea de Medio Ambiente (EEA), Monitoring of CO2 emissions from passenger cars, Reglamento (UE) 2019/631',
    url: 'https://www.eea.europa.eu/en/datahub/datahubitem-view/fa8b1229-3db6-495d-b18e-9c9b3267c02b',
    scope: `Turismos matriculados en España ${TABLES.map((t) => t.slice(7, 11)).join(', ')} (datos finales). Consumo homologado WLTP, media de las unidades matriculadas de cada versión.`,
    generatedAt: new Date().toISOString(),
  },
  vehicles,
}));
console.log('versiones:', vehicles.length, 'marcas:', new Set(vehicles.map((v) => v.make)).size);
