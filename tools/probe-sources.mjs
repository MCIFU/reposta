#!/usr/bin/env node
// REPOSTA · Fase 0 — Verificación reproducible de fuentes de datos.
// Uso: node tools/probe-sources.mjs [dd-mm-aaaa ...]
// Sin dependencias. Requiere Node >= 18 (fetch nativo).

const MITECO = 'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes';
const CARTOCIUDAD = 'https://www.cartociudad.es/geocoder/api/geocoder';

const num = (v) => (v ? Number(String(v).replace(',', '.')) : null);

async function getJson(url) {
  const t0 = performance.now();
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  const text = await res.text();
  return { status: res.status, ms: Math.round(performance.now() - t0), bytes: text.length, json: text ? JSON.parse(text) : null };
}

function summarize(list) {
  const priceKeys = Object.keys(list[0] ?? {}).filter((k) => k.startsWith('Precio '));
  const fuels = priceKeys
    .map((k) => {
      const v = list.map((s) => num(s[k])).filter((x) => x != null);
      if (!v.length) return null;
      const avg = v.reduce((a, b) => a + b, 0) / v.length;
      return `${k.replace('Precio ', '').padEnd(32)} n=${String(v.length).padStart(5)}  media=${avg.toFixed(3)}  min=${Math.min(...v).toFixed(3)}  max=${Math.max(...v).toFixed(3)}`;
    })
    .filter(Boolean);
  return fuels;
}

async function main() {
  console.log('REPOSTA · verificación de fuentes ·', new Date().toISOString(), '\n');

  const live = await getJson(`${MITECO}/EstacionesTerrestres/`);
  const L = live.json.ListaEESSPrecio;
  console.log(`[MITECO actual] HTTP ${live.status} · ${(live.bytes / 1e6).toFixed(1)} MB · ${live.ms} ms`);
  console.log(`  Fecha del dato: ${live.json.Fecha} · estaciones: ${L.length}`);
  console.log(`  Campos: ${Object.keys(L[0]).join(' | ')}`);
  summarize(L).forEach((l) => console.log('  ' + l));

  for (const path of ['Listados/ComunidadesAutonomas/', 'Listados/Provincias/', 'Listados/Municipios/', 'Listados/ProductosPetroliferos/']) {
    const r = await getJson(`${MITECO}/${path}`);
    console.log(`[MITECO ${path}] HTTP ${r.status} · ${r.json.length} registros`);
  }

  const dates = process.argv.slice(2);
  for (const d of dates.length ? dates : ['01-01-2007', '01-01-2015', '01-01-2020']) {
    const r = await getJson(`${MITECO}/EstacionesTerrestresHist/${d}`);
    const H = r.json?.ListaEESSPrecio ?? [];
    console.log(`\n[MITECO histórico ${d}] HTTP ${r.status} · ${(r.bytes / 1e6).toFixed(1)} MB · Fecha=${r.json?.Fecha} · estaciones=${H.length}`);
    if (H.length) summarize(H).forEach((l) => console.log('  ' + l));
  }

  const cp = await getJson(`${CARTOCIUDAD}/find?q=33201&type=Codpost`);
  console.log(`\n[CartoCiudad find CP 33201] HTTP ${cp.status} · lat=${cp.json?.lat} lng=${cp.json?.lng}`);
  const rev = await getJson(`${CARTOCIUDAD}/reverseGeocode?lon=-5.66&lat=43.54`);
  console.log(`[CartoCiudad reverse] HTTP ${rev.status} · ${rev.json?.address} · ${rev.json?.muni} (${rev.json?.muniCode})`);
}

main().catch((e) => {
  console.error('Fallo en la verificación:', e);
  process.exit(1);
});
