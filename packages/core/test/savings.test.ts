import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeSavings } from '../src/savings.ts';
import { parseMitecoPrice, formatPriceMilli } from '../src/format.ts';

// Ejemplo del briefing: A 1,459 €/L a 8 km · B 1,479 €/L a 1 km.
const A = { id: 'A', pricePerUnit: 1.459, distanceKm: 8 };
const B = { id: 'B', pricePerUnit: 1.479, distanceKm: 1 };

test('ejemplo del briefing: 40 L y 6,5 L/100 km -> NO compensa', () => {
  const r = computeSavings({ quantity: 40, consumptionPer100: 6.5, candidate: A, reference: B });
  assert.equal(r.grossSaving, 0.8);       // 40 × 0,02
  assert.equal(r.extraKm, 14);            // (8-1) × 2, ida y vuelta
  assert.equal(r.extraFuel, 0.91);        // 14 × 6,5 / 100
  assert.equal(r.travelCost, 1.33);       // 0,91 × 1,459
  assert.equal(r.netSaving, -0.53);
  assert.equal(r.verdict, 'not_worth_it');
  assert.equal(r.breakEvenQuantity, 66.4); // haría falta repostar 66,4 L
  assert.equal(r.maxWorthwhileExtraKm, 8.4);
});

test('misma diferencia, gasolinera de camino (desvío 1 km) -> compensa', () => {
  const r = computeSavings({
    quantity: 40, consumptionPer100: 6.5, mode: 'onTheWay',
    candidate: { ...A, detourKm: 1 }, reference: { ...B, detourKm: 0 },
  });
  assert.equal(r.netSaving, 0.71);
  assert.equal(r.verdict, 'worth_it');
});

test('diferencia grande de precio sí compensa ir y volver', () => {
  const r = computeSavings({
    quantity: 50, consumptionPer100: 6,
    candidate: { id: 'C', pricePerUnit: 1.389, distanceKm: 5 },
    reference: { id: 'D', pricePerUnit: 1.489, distanceKm: 1 },
  });
  assert.equal(r.grossSaving, 5);
  assert.equal(r.travelCost, 0.67);       // 8 km × 0,06 × 1,389
  assert.equal(r.netSaving, 4.33);
  assert.equal(r.verdict, 'worth_it');
});

test('zona de indiferencia', () => {
  const r = computeSavings({
    quantity: 30, consumptionPer100: 6,
    candidate: { id: 'E', pricePerUnit: 1.47, distanceKm: 2 },
    reference: { id: 'F', pricePerUnit: 1.479, distanceKm: 1 },
  });
  assert.equal(r.verdict, 'indifferent');
});

test('el valor del tiempo se resta cuando se indica', () => {
  const r = computeSavings({
    quantity: 50, consumptionPer100: 6, valueOfTimeEurH: 12,
    candidate: { id: 'C', pricePerUnit: 1.389, distanceKm: 5, durationMin: 8 },
    reference: { id: 'D', pricePerUnit: 1.489, distanceKm: 1, durationMin: 2 },
  });
  assert.equal(r.timeCost, 2.4);           // 12 min extra (ida+vuelta) a 12 €/h
  assert.equal(r.netSaving, 1.93);
});

test('simetría: la cercana y algo más cara compensa frente a la lejana', () => {
  const r = computeSavings({ quantity: 40, consumptionPer100: 6.5, candidate: B, reference: A });
  assert.equal(r.breakEvenQuantity, null); // no es más barata: no hay «litros mínimos»
  assert.equal(r.netSaving, 0.55);         // -0,80 € de precio + 1,35 € de desplazamiento ahorrado
  assert.equal(r.verdict, 'worth_it');
});

test('entradas inválidas', () => {
  assert.throws(() => computeSavings({ quantity: 0, consumptionPer100: 6, candidate: A, reference: B }), RangeError);
});

test('parseo y formato de precios MITECO', () => {
  assert.equal(parseMitecoPrice('1,459'), 1459);
  assert.equal(parseMitecoPrice(''), null);
  assert.equal(formatPriceMilli(1459), '1,459');
});
