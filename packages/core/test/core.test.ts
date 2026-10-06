import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSchedule, isOpenAt, is24h } from '../src/schedule.ts';
import { normalizeBrand, prettyAddress } from '../src/brands.ts';
import { parseMitecoDate, normalizeStation } from '../src/miteco.ts';
import { haversineKm, estimateTrip } from '../src/geo.ts';
import { priceStats } from '../src/stats.ts';

test('horario 24H', () => {
  const r = parseSchedule('L-D: 24H');
  assert.ok(is24h(r));
  assert.equal(isOpenAt(r, { day: 3, minute: 200 }), true);
});

test('horario con varios tramos y días', () => {
  const r = parseSchedule('L-V: 07:30-14:30 y 15:30-21:00; S-D: 09:00-14:00');
  assert.equal(isOpenAt(r, { day: 2, minute: 15 * 60 }), false);   // martes 15:00, cerrado
  assert.equal(isOpenAt(r, { day: 2, minute: 16 * 60 }), true);
  assert.equal(isOpenAt(r, { day: 7, minute: 13 * 60 }), true);    // domingo 13:00
  assert.equal(isOpenAt(r, { day: 7, minute: 15 * 60 }), false);
});

test('horario que cruza medianoche', () => {
  const r = parseSchedule('L-D: 06:00-02:00');
  assert.equal(isOpenAt(r, { day: 4, minute: 60 }), true);          // jueves 01:00 (tramo del miércoles)
  assert.equal(isOpenAt(r, { day: 4, minute: 3 * 60 }), false);
});

test('horario no reconocible -> null', () => {
  assert.equal(parseSchedule('Consultar'), null);
  assert.equal(isOpenAt(null), null);
});

test('marcas', () => {
  assert.deepEqual(normalizeBrand('E.S. REPSOL'), { name: 'Repsol', known: true });
  assert.equal(normalizeBrand('Nº 10.935').name, 'Sin marca');
  assert.equal(normalizeBrand('LA COOPERATIVA').name, 'La Cooperativa');
});

test('direcciones legibles', () => {
  assert.equal(prettyAddress('AVENIDA DE LOS CAMPONES, 2'), 'Avenida de los Campones, 2');
  assert.equal(prettyAddress('CR CM-332, 46,4'), 'Carretera CM-332, 46,4');
  assert.equal(prettyAddress('AUTOPISTA AS -2 KM. 22'), 'Autopista AS-2 km 22');
  assert.equal(prettyAddress('CALLE CARRETERA CARBONERA , (GASOLINERA), 52'), 'Calle Carretera Carbonera, 52');
});

test('fecha MITECO en hora peninsular (CEST)', () => {
  assert.equal(parseMitecoDate('02/10/2026 19:09:38').toISOString(), '2026-10-02T17:09:38.000Z');
  assert.equal(parseMitecoDate('15/01/2026 10:00:00').toISOString(), '2026-01-15T09:00:00.000Z'); // CET
});

test('normalización de estación real (IDEESS 4375, Abengibre)', () => {
  const s = normalizeStation({
    'C.P.': '02250', 'Dirección': 'AVENIDA CASTILLA LA MANCHA, 26', 'Horario': 'L-D: 07:00-22:00',
    'Latitud': '39,211417', 'Localidad': 'ABENGIBRE', 'Longitud (WGS84)': '-1,539167', 'Municipio': 'Abengibre',
    'Precio Gasoleo A': '1,849', 'Precio Gasoleo B': '1,549', 'Precio Gasolina 95 E5': '1,749', 'Provincia': 'ALBACETE',
    'Rótulo': 'Nº 10.935', 'IDEESS': '4375', 'IDMunicipio': '52', 'IDProvincia': '02', 'IDCCAA': '07',
  })!;
  assert.equal(s.lat, 39.211417);
  assert.deepEqual(s.prices, { g95: 1749, diesel: 1849, 'gasoleo-b': 1549 });
  assert.equal(s.brand, 'Sin marca');
});

test('geo', () => {
  // Gijón (Plaza Mayor) -> Oviedo (catedral): ~23,6 km en línea recta
  const d = haversineKm({ lat: 43.5453, lng: -5.6619 }, { lat: 43.3625, lng: -5.8433 });
  assert.ok(d > 24 && d < 26, String(d));
  assert.ok(estimateTrip(1).minutes >= 1);
});

test('estadísticos', () => {
  const s = priceStats([1700, 1710, 1720, 1800, 1900])!;
  assert.equal(s.median, 1720);
  assert.equal(s.min, 1700);
});
