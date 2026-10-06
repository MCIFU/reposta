// Formato de cifras para España. Los precios de carburante se muestran con 3 decimales (precisión de la fuente).

const priceFmt = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const eurFmt = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });

/** 1459 (milésimas) -> «1,459» */
export const formatPriceMilli = (milli: number) => priceFmt.format(milli / 1000);

/** 0.84 -> «0,84 €» */
export const formatEur = (eur: number) => eurFmt.format(eur);

/** «1,459» (texto de la fuente MITECO) -> 1459 milésimas. Devuelve null si está vacío. */
export function parseMitecoPrice(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const n = Math.round(Number(raw.replace(',', '.')) * 1000);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Coordenada MITECO («39,211417») -> número. Vacío/no numérico -> NaN (la estación se descarta). */
export const parseMitecoCoord = (raw: string) => {
  if (!raw || !raw.trim()) return NaN;
  return Number(raw.replace(',', '.'));
};
