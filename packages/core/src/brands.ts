// Normalización del «Rótulo» (texto libre en MITECO). Se conserva siempre el original.

const ALIASES: Array<[RegExp, string]> = [
  [/\brepsol\b/i, 'Repsol'],
  [/\bmoeve\b/i, 'Moeve'],
  [/\bcepsa\b/i, 'Cepsa'],
  [/\bgalp\b/i, 'Galp'],
  [/\bballenoil\b/i, 'Ballenoil'],
  [/\bplenergy\b/i, 'Plenergy'],
  [/\bshell\b/i, 'Shell'],
  [/\bpetroprix\b/i, 'Petroprix'],
  [/\bpetronor\b/i, 'Petronor'],
  [/\bcarrefour\b/i, 'Carrefour'],
  [/^bp\b|\bbp\b/i, 'BP'],
  [/\bavia\b/i, 'Avia'],
  [/\balcampo\b/i, 'Alcampo'],
  [/\beroski\b/i, 'Eroski'],
  [/\bbonarea\b|\bbon ?àrea\b/i, 'bonÀrea'],
  [/\bpetrocat\b/i, 'Petrocat'],
  [/\bmeroil\b/i, 'Meroil'],
  [/\beasygas\b/i, 'Easygas'],
  [/\bgasexpress\b/i, 'GasExpress'],
  [/\bcampsa\b/i, 'Campsa'],
  [/\bdisa\b/i, 'Disa'],
  [/\btexaco\b/i, 'Texaco'],
  [/\besclatoil\b/i, 'Esclatoil'],
  [/\bpcan\b/i, 'PCAN'],
];

const SMALL = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'e']);

export function titleCase(s: string) {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => (i > 0 && SMALL.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

/** Devuelve el nombre comercial para mostrar. «Nº 10.935» y similares (sin marca) -> «Sin marca». */
export function normalizeBrand(raw: string): { name: string; known: boolean } {
  const label = raw.trim();
  for (const [re, name] of ALIASES) if (re.test(label)) return { name, known: true };
  if (!label || /^(n[ºo°]\s*[\d.]+|s\/?n|sin r[oó]tulo|-+)$/i.test(label)) return { name: 'Sin marca', known: false };
  return { name: titleCase(label), known: false };
}

/** Título legible para direcciones en mayúsculas: «AVENIDA DE LOS CAMPONES, 2» -> «Avenida de los Campones, 2». */
export const prettyAddress = (raw: string) =>
  titleCase(raw.trim())
    .replace(/\bCr\b/g, 'Carretera')
    .replace(/\bCl\b/g, 'Calle')
    .replace(/\bAv\b|\bAvda\b/g, 'Avenida')
    .replace(/\bKm\b\.?/g, 'km')
    // Denominaciones de carretera: «As -2», «Cm-332», «N-634» -> «AS-2», «CM-332», «N-634»
    .replace(/\b([A-Z][a-z]{0,2})\s*-\s*(\d+)\b/g, (_m, p, n) => `${p.toUpperCase()}-${n}`)
    .replace(/\s*\((?:gasolinera|estaci[oó]n de servicio|e\.?s\.?)\)\s*/gi, ' ')
    .replace(/\s+,/g, ',')
    .replace(/,\s*,/g, ',')
    .replace(/\s{2,}/g, ' ')
    .replace(/,\s*$/, '');
