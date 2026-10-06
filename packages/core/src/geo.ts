export interface LatLng {
  lat: number;
  lng: number;
}

const R = 6371.0088; // radio medio terrestre, km

/** Distancia en línea recta (km). */
export function haversineKm(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Estimación de distancia por carretera y tiempo SIN motor de rutas.
 * Factor de tortuosidad y velocidad media según distancia. Se muestra siempre con «≈».
 */
export function estimateTrip(straightKm: number): { km: number; minutes: number } {
  const factor = straightKm < 3 ? 1.35 : straightKm < 15 ? 1.28 : 1.2;
  const km = straightKm * factor;
  const kmh = km < 3 ? 25 : km < 15 ? 38 : 65;
  return { km, minutes: Math.max(1, Math.round((km / kmh) * 60)) };
}

/** Caja que contiene un círculo (aprox.), para prefiltrar. */
export function bboxAround(c: LatLng, radiusKm: number) {
  const dLat = radiusKm / 111.32;
  const dLng = radiusKm / (111.32 * Math.cos((c.lat * Math.PI) / 180));
  return { minLat: c.lat - dLat, maxLat: c.lat + dLat, minLng: c.lng - dLng, maxLng: c.lng + dLng };
}

export const directionsUrl = (to: LatLng, from?: LatLng) =>
  `https://www.google.com/maps/dir/?api=1${from ? `&origin=${from.lat},${from.lng}` : ''}&destination=${to.lat},${to.lng}&travelmode=driving`;
