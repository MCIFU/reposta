// Estilo de mapa propio: Positron (OpenFreeMap, datos © OpenStreetMap) recoloreado con la paleta REPOSTA.
import type { StyleSpecification, LayerSpecification } from 'maplibre-gl';

export type MapTheme = 'light' | 'dark';

const PALETTE = {
  light: {
    // Más contraste en móvil: agua azul nítida, tierra clara, carreteras blancas con borde y etiquetas oscuras.
    bg: '#f2f4f7', water: '#b3c8e4', park: '#dce8dc', residential: '#e8ebf0', building: '#dde2ea',
    minor: '#ffffff', major: '#ffffff', motorway: '#c5d3ef', casing: '#c3ccd9', rail: '#c3cad6',
    boundary: '#8693ab', label: '#4a5568', labelStrong: '#16233f', halo: '#f2f4f7',
  },
  dark: {
    bg: '#0a1630', water: '#060f24', park: '#0c1c35', residential: '#0c1a35', building: '#122447',
    minor: '#15284d', major: '#1a3160', motorway: '#22407a', casing: '#0a1630', rail: '#16294f',
    boundary: '#3a5182', label: '#8693ab', labelStrong: '#c3cde0', halo: '#0a1630',
  },
};

const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';
let base: Promise<StyleSpecification> | null = null;

const FALLBACK: StyleSpecification = {
  version: 8,
  name: 'reposta-fallback',
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#eef1f5' } }],
};

export function loadBaseStyle() {
  base ??= fetch(STYLE_URL).then((r) => {
    if (!r.ok) throw new Error('No se pudo cargar el mapa base');
    return r.json();
  }).catch(() => {
    // Sin mapa base (OpenFreeMap caído / sin red): la lista sigue funcionando.
    // Se invalida la caché para reintentar en la próxima carga.
    base = null;
    return FALLBACK;
  });
  return base;
}

function paint(layer: LayerSpecification, c: (typeof PALETTE)['light']): LayerSpecification | null {
  const id = layer.id;
  const L = { ...layer, paint: { ...(layer as { paint?: object }).paint } } as LayerSpecification & { paint: Record<string, unknown> };
  if (/shield|aeroway|railway_transit|ice_shelf|glacier|road_area_pier|road_pier/.test(id)) return null;
  switch (layer.type) {
    case 'background':
      L.paint['background-color'] = c.bg;
      break;
    case 'fill':
      L.paint['fill-color'] = /water/.test(id) ? c.water : /park|wood/.test(id) ? c.park : /building/.test(id) ? c.building : c.residential;
      L.paint['fill-outline-color'] = L.paint['fill-color'];
      break;
    case 'line':
      if (/water/.test(id)) L.paint['line-color'] = c.water;
      else if (/boundary/.test(id)) { L.paint['line-color'] = c.boundary; L.paint['line-opacity'] = 0.5; }
      else if (/rail/.test(id)) L.paint['line-color'] = c.rail;
      else if (/casing/.test(id)) L.paint['line-color'] = c.casing;
      else if (/motorway/.test(id)) L.paint['line-color'] = c.motorway;
      else if (/major/.test(id)) L.paint['line-color'] = c.major;
      else L.paint['line-color'] = c.minor;
      break;
    case 'symbol':
      L.paint['text-color'] = /city|town|state|country/.test(id) ? c.labelStrong : c.label;
      L.paint['text-halo-color'] = c.halo;
      L.paint['text-halo-width'] = 1.4;
      break;
  }
  return L;
}

export async function buildStyle(theme: MapTheme): Promise<StyleSpecification> {
  const s = await loadBaseStyle();
  const c = PALETTE[theme];
  return {
    ...s,
    layers: s.layers.map((l) => paint(l, c)).filter((l): l is LayerSpecification => !!l),
  };
}
