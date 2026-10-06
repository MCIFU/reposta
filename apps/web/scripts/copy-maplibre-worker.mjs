// MapLibre 6 (ESM) carga su worker desde un archivo aparte que el bundler de Next no sirve.
// Lo copiamos a /public/maplibre y lo indicamos con setWorkerUrl().
import { cpSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
const dist = path.dirname(createRequire(import.meta.url).resolve('maplibre-gl/package.json')) + '/dist';
const out = new URL('../public/maplibre/', import.meta.url);
mkdirSync(out, { recursive: true });
for (const f of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) cpSync(`${dist}/${f}`, new URL(f, out));
console.log('maplibre worker copiado a public/maplibre');
