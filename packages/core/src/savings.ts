// REPOSTA · «¿Realmente me compensa?»
// Lógica pura, sin DOM: la comparten la web y la app Android.
// Unidades: precios en €/L (o €/kg), distancias en km, consumo en L/100 km.

export type TripMode =
  /** Salgo de mi posición, voy a la gasolinera y vuelvo (o sigo) desde el mismo punto. */
  | 'roundtrip'
  /** La gasolinera está de camino; `detourKm` es el desvío extra real respecto a mi ruta. */
  | 'onTheWay';

export interface StationOption {
  id: string | number;
  pricePerUnit: number;
  /** Distancia de ida desde el origen (km). En modo onTheWay se ignora y se usa detourKm. */
  distanceKm: number;
  /** Desvío adicional respecto a la ruta del usuario (solo modo onTheWay). */
  detourKm?: number;
  /** Minutos de ida estimados (opcional, para el valor del tiempo). */
  durationMin?: number;
}

export interface SavingsInput {
  /** Litros (o kg) que el usuario quiere repostar. */
  quantity: number;
  /** Consumo del vehículo en L/100 km. */
  consumptionPer100: number;
  candidate: StationOption;
  /** Opción de referencia: normalmente la más cercana. */
  reference: StationOption;
  mode?: TripMode;
  /** €/hora. Si se indica, el tiempo extra cuenta como coste. Por defecto 0 (no se valora). */
  valueOfTimeEurH?: number;
  /** Por debajo de este ahorro neto (en valor absoluto) se considera «da igual». */
  indifferenceEur?: number;
}

export type Verdict = 'worth_it' | 'indifferent' | 'not_worth_it';

export interface SavingsResult {
  verdict: Verdict;
  /** Diferencia de precio × cantidad, sin contar el desplazamiento. */
  grossSaving: number;
  /** Km adicionales que exige el candidato frente a la referencia (puede ser negativo). */
  extraKm: number;
  /** Combustible gastado en esos km adicionales. */
  extraFuel: number;
  /** Coste de ese combustible, valorado al precio del candidato (es lo que costará reponerlo). */
  travelCost: number;
  /** Coste del tiempo extra (0 si no se valora). */
  timeCost: number;
  netSaving: number;
  /** Cantidad mínima a repostar para que compense (null si el candidato no es más barato). */
  breakEvenQuantity: number | null;
  /** Distancia máxima extra que compensaría con esta cantidad (null si no es más barato). */
  maxWorthwhileExtraKm: number | null;
}

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

function extraKmFor(o: StationOption, mode: TripMode): number {
  return mode === 'onTheWay' ? (o.detourKm ?? 0) : 2 * o.distanceKm;
}

export function computeSavings(input: SavingsInput): SavingsResult {
  const {
    quantity,
    consumptionPer100,
    candidate,
    reference,
    mode = 'roundtrip',
    valueOfTimeEurH = 0,
    indifferenceEur = 0.25,
  } = input;

  if (!(quantity > 0)) throw new RangeError('quantity debe ser > 0');
  if (!(consumptionPer100 > 0)) throw new RangeError('consumptionPer100 debe ser > 0');

  const priceDiff = reference.pricePerUnit - candidate.pricePerUnit; // >0 si el candidato es más barato
  const grossSaving = priceDiff * quantity;

  const extraKm = extraKmFor(candidate, mode) - extraKmFor(reference, mode);
  const extraFuel = (extraKm * consumptionPer100) / 100;
  const travelCost = extraFuel * candidate.pricePerUnit;

  const extraMin =
    candidate.durationMin != null && reference.durationMin != null
      ? (mode === 'roundtrip' ? 2 : 1) * (candidate.durationMin - reference.durationMin)
      : 0;
  const timeCost = (Math.max(0, extraMin) / 60) * valueOfTimeEurH;

  const netSaving = grossSaving - travelCost - timeCost;

  const verdict: Verdict =
    netSaving > indifferenceEur ? 'worth_it' : netSaving < -indifferenceEur ? 'not_worth_it' : 'indifferent';

  const fixedCost = travelCost + timeCost;
  const breakEvenQuantity = priceDiff > 0 ? Math.max(0, fixedCost / priceDiff) : null;
  const maxWorthwhileExtraKm =
    priceDiff > 0 ? (grossSaving - timeCost) / ((consumptionPer100 / 100) * candidate.pricePerUnit) : null;

  return {
    verdict,
    grossSaving: round(grossSaving),
    extraKm: round(extraKm, 1),
    extraFuel: round(extraFuel, 2),
    travelCost: round(travelCost),
    timeCost: round(timeCost),
    netSaving: round(netSaving),
    breakEvenQuantity: breakEvenQuantity == null ? null : round(breakEvenQuantity, 1),
    maxWorthwhileExtraKm: maxWorthwhileExtraKm == null ? null : round(maxWorthwhileExtraKm, 1),
  };
}
