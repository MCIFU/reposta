'use client';
import { useEffect, useRef, useState } from 'react';
import type { Map as MlMap, GeoJSONSource, ExpressionSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { haversineKm, type LatLng } from '@reposta/core';
import { buildStyle, type MapTheme } from './style';
import { installPinFactory } from './pins';
import styles from './MapView.module.css';

export interface MapViewProps {
  fuel: string;
  origin: LatLng | null;
  radiusKm: number;
  selectedId: number | null;
  /** La más barata del radio: siempre etiquetada y marcada. */
  bestId?: number | null;
  onSelect: (id: number) => void;
  onSearchHere: (center: LatLng) => void;
  /** Cambia cuando hay nuevos resultados: el mapa encuadra el radio. */
  fitKey: string;
}

type Point = [number, number, number, number];
const SPAIN: [number, number] = [-3.7, 40.1];

function currentTheme(): MapTheme {
  const t = document.documentElement.getAttribute('data-theme');
  if (t === 'dark' || t === 'light') return t;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function circle(c: LatLng, rKm: number, steps = 96) {
  const coords: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    const dLat = (rKm / 111.32) * Math.sin(a);
    const dLng = (rKm / (111.32 * Math.cos((c.lat * Math.PI) / 180))) * Math.cos(a);
    coords.push([c.lng + dLng, c.lat + dLat]);
  }
  return { type: 'Feature' as const, properties: {}, geometry: { type: 'Polygon' as const, coordinates: [coords] } };
}

type Bounds = [[number, number], [number, number]];
const radiusBounds = (c: LatLng, rKm: number): Bounds => {
  const dLat = rKm / 111.32, dLng = rKm / (111.32 * Math.cos((c.lat * Math.PI) / 180));
  return [[c.lng - dLng, c.lat - dLat], [c.lng + dLng, c.lat + dLat]];
};
const FIT = { padding: 32 };

const quant = (s: number[], p: number) => s[Math.min(s.length - 1, Math.max(0, Math.round((s.length - 1) * p)))];

export default function MapView({ fuel, origin, radiusKm, selectedId, bestId = null, onSelect, onSearchHere, fitKey }: MapViewProps) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const pointsRef = useRef<Point[]>([]);
  const fuelRef = useRef(fuel);
  fuelRef.current = fuel;
  const loadedUrl = useRef<string | null>(null);
  const themeRef = useRef<MapTheme>('light');
  const cuts = useRef<[number, number]>([0, 0]);
  const clusterCuts = useRef<[number, number]>([0, 0]);
  // Encuadre «vivo»: se reaplica si el contenedor cambia de tamaño, hasta que el usuario mueve el mapa a mano.
  const fitTarget = useRef<Bounds | null>(null);
  const userMoved = useRef(false);
  const props = useRef({ onSelect, onSearchHere, selectedId, bestId, origin, radiusKm });
  props.current = { onSelect, onSearchHere, selectedId, bestId, origin, radiusKm };
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [showSearchHere, setShowSearchHere] = useState(false);
  const [pointsError, setPointsError] = useState(false);
  const [retry, setRetry] = useState(0);

  // Umbrales estrictamente crecientes (requisito de «step»): ≤ lo barato, ≥ hi caro.
  const pinExpr = (sel = false): ExpressionSpecification => [
    'concat', 'pin|', ['to-string', ['get', 'p']], '|',
    ['step', ['get', 'p'], '0', cuts.current[0] + 1, '1', Math.max(cuts.current[1], cuts.current[0] + 2), '2'],
    '|', themeRef.current, sel ? '|s' : '',
  ];

  const clusterExpr = (): ExpressionSpecification => [
    'concat', 'cl|', ['to-string', ['get', 'min']], '|', ['to-string', ['get', 'point_count']], '|', themeRef.current, '|',
    ['step', ['get', 'min'], '0', clusterCuts.current[0] + 1, '1', Math.max(clusterCuts.current[1], clusterCuts.current[0] + 2), '2'],
  ];
  /** Una sola capa de etiquetas (grupos + estaciones) con una única prioridad: el precio más bajo se coloca primero. */
  const labelExpr = (): ExpressionSpecification => ['case', ['has', 'point_count'], clusterExpr(), pinExpr()];
  const DOT = { light: ['#0f8a6c', '#8a93a3', '#c9472e', '#12306b'], dark: ['#20a885', '#6d7fa6', '#e0603f', '#5b7fd1'] };
  const dotExpr = (): ExpressionSpecification => {
    const c = DOT[themeRef.current];
    return ['step', ['get', 'p'], c[0], cuts.current[0] + 1, c[1], Math.max(cuts.current[1], cuts.current[0] + 2), c[2]];
  };

  function addOverlay(map: MlMap) {
    if (map.getSource('stations')) return;
    loadedUrl.current = null;
    map.addSource('stations', {
      type: 'geojson', data: { type: 'FeatureCollection', features: [] },
      cluster: true, clusterMaxZoom: 11, clusterRadius: 48,
      clusterProperties: { min: ['min', ['get', 'p']] },
    });
    // Seleccionada y más barata en una fuente sin agrupar: visibles aunque su zona esté agrupada.
    map.addSource('marked', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addSource('origin', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addSource('radius', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    const dark = themeRef.current === 'dark';
    map.addLayer({ id: 'radius-fill', type: 'fill', source: 'radius', paint: { 'fill-color': dark ? '#8fb0ff' : '#12306b', 'fill-opacity': 0.05 } });
    map.addLayer({ id: 'radius-line', type: 'line', source: 'radius', paint: { 'line-color': dark ? '#8fb0ff' : '#12306b', 'line-opacity': 0.35, 'line-width': 1.2, 'line-dasharray': [2, 2] } });
    // Nivel 1: puntos. Siempre visibles (ninguna estación desaparece del mapa).
    map.addLayer({
      id: 'cluster-dots', type: 'circle', source: 'stations', filter: ['has', 'point_count'],
      paint: {
        'circle-color': DOT[themeRef.current][3], 'circle-opacity': 0.9,
        'circle-radius': ['interpolate', ['linear'], ['get', 'point_count'], 2, 5, 20, 8, 100, 11],
        'circle-stroke-color': dark ? '#0a1630' : '#ffffff', 'circle-stroke-width': 2,
      },
    });
    map.addLayer({
      id: 'pin-dots', type: 'circle', source: 'stations', filter: ['!', ['has', 'point_count']],
      paint: { 'circle-color': dotExpr(), 'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 3, 14, 5], 'circle-stroke-color': dark ? '#0a1630' : '#ffffff', 'circle-stroke-width': 1.5 },
    });
    // Nivel 2: etiquetas con precio. Colisionan entre sí; se colocan primero las más baratas.
    map.addLayer({
      id: 'labels', type: 'symbol', source: 'stations',
      layout: {
        'icon-image': labelExpr(),
        'icon-anchor': 'bottom', 'icon-offset': ['case', ['has', 'point_count'], ['literal', [0, -7]], ['literal', [0, -4]]],
        'icon-allow-overlap': false, 'icon-padding': 1.5,
        'symbol-sort-key': ['coalesce', ['get', 'min'], ['get', 'p']],
      },
    });
    // Seleccionada y más barata: siempre visibles, con el anillo ámbar de marca.
    map.addLayer({
      id: 'pin-selected', type: 'symbol', source: 'marked',
      layout: { 'icon-image': pinExpr(true), 'icon-anchor': 'bottom', 'icon-offset': [0, -4], 'icon-allow-overlap': true, 'icon-ignore-placement': false },
    });
    map.addLayer({ id: 'origin-halo', type: 'circle', source: 'origin', paint: { 'circle-radius': 16, 'circle-color': dark ? '#8fb0ff' : '#12306b', 'circle-opacity': 0.16 } });
    map.addLayer({ id: 'origin-dot', type: 'circle', source: 'origin', paint: { 'circle-radius': 7, 'circle-color': dark ? '#8fb0ff' : '#12306b', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 3 } });
  }

  function pushData(map: MlMap) {
    const src = map.getSource('stations') as GeoJSONSource | undefined;
    if (!src) return;
    // Las 11.000 estaciones las descarga el worker del mapa por URL (una vez por combustible); aquí solo
    // se actualizan origen, radio y marcadas, que son baratos.
    const url = `/api/map/points?fuel=${fuelRef.current}&format=geojson`;
    if (loadedUrl.current !== url) { src.setData(url); loadedUrl.current = url; }
    const { origin: o, radiusKm: r } = props.current;
    (map.getSource('origin') as GeoJSONSource).setData({ type: 'FeatureCollection', features: o ? [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [o.lng, o.lat] } }] : [] });
    (map.getSource('radius') as GeoJSONSource).setData({ type: 'FeatureCollection', features: o ? [circle(o, r)] : [] });
    const ids = new Set([props.current.selectedId, props.current.bestId].filter((x): x is number => x != null));
    (map.getSource('marked') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: pointsRef.current.filter((pt) => ids.has(pt[0])).map(([id, lat, lng, p]) => ({ type: 'Feature', properties: { id, p }, geometry: { type: 'Point', coordinates: [lng, lat] } })),
    });
  }

  function recut(map: MlMap) {
    const b = map.getBounds();
    const vis = pointsRef.current.filter(([, lat, lng]) => b.contains([lng, lat])).map((p) => p[3]).sort((a, z) => a - z);
    if (vis.length < 3) return;
    // Mismo criterio que la lista (Results.band + core/stats): barato <= p10, caro >= p90 de lo visible.
    const next: [number, number] = [quant(vis, 0.1), quant(vis, 0.9)];
    if (next[0] === cuts.current[0] && next[1] === cuts.current[1]) return;
    cuts.current = next;
    if (map.getLayer('labels')) {
      map.setLayoutProperty('labels', 'icon-image', labelExpr());
      map.setLayoutProperty('pin-selected', 'icon-image', pinExpr(true));
      map.setPaintProperty('pin-dots', 'circle-color', dotExpr());
    }
  }

  /** Los grupos se comparan entre sí (sus mínimos), no con estaciones sueltas. */
  function recutClusters(map: MlMap) {
    if (!map.getLayer('cluster-dots')) return;
    const mins = map.queryRenderedFeatures({ layers: ['cluster-dots'] }).map((f) => Number(f.properties.min)).sort((a, z) => a - z);
    const next: [number, number] = mins.length >= 3 ? [quant(mins, 0.1), quant(mins, 0.9)] : [cuts.current[0], cuts.current[1]];
    if (next[0] === clusterCuts.current[0] && next[1] === clusterCuts.current[1]) return;
    clusterCuts.current = next;
    map.setLayoutProperty('labels', 'icon-image', labelExpr());
  }

  // Inicialización
  useEffect(() => {
    let cancelled = false;
    let map: MlMap;
    (async () => {
      try {
        const mod = await import('maplibre-gl');
        const maplibre = ((mod as unknown as { default?: typeof mod }).default ?? mod);
        maplibre.setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
        themeRef.current = currentTheme();
        const style = await buildStyle(themeRef.current);
        if (cancelled || !el.current) return;
        const o = props.current.origin;
        if (o) fitTarget.current = radiusBounds(o, props.current.radiusKm);
        map = new maplibre.Map({
          container: el.current, style,
          ...(o ? { bounds: fitTarget.current!, fitBoundsOptions: FIT } : { center: SPAIN, zoom: 5.2 }),
          attributionControl: { compact: true }, minZoom: 4, maxZoom: 18, dragRotate: false, pitchWithRotate: false,
          // En móvil el mapa está entre la búsqueda y la lista: con dos dedos se mueve el mapa y con uno se desplaza la página.
          cooperativeGestures: matchMedia('(max-width: 959px) and (pointer: coarse)').matches,
          locale: {
            'CooperativeGesturesHandler.WindowsHelpText': 'Usa Ctrl + rueda para hacer zoom',
            'CooperativeGesturesHandler.MacHelpText': 'Usa ⌘ + rueda para hacer zoom',
            'CooperativeGesturesHandler.MobileHelpText': 'Usa dos dedos para mover el mapa',
            'NavigationControl.ZoomIn': 'Acercar', 'NavigationControl.ZoomOut': 'Alejar',
          },
        });
        map.touchZoomRotate.disableRotation();
        map.addControl(new maplibre.NavigationControl({ showCompass: false }), 'bottom-right');
        mapRef.current = map;
        if (process.env.NODE_ENV !== 'production') (window as unknown as { __rpMap?: MlMap }).__rpMap = map;
        installPinFactory(map);
        map.on('style.load', () => {
          addOverlay(map);
          pushData(map);
          recut(map);
        });
        map.on('load', () => setStatus('ready'));
        // Errores de ejecución (una tesela, un glifo): no bloquean el mapa; solo se registran.
        map.on('error', (e) => console.warn('[mapa]', e?.error?.message ?? e));
        map.on('idle', () => recutClusters(map));
        // Un cambio de tamaño cancela las animaciones de cámara: se reencuadra sin animación.
        map.on('movestart', (e) => { if ((e as { originalEvent?: Event }).originalEvent) userMoved.current = true; });
        map.on('resize', () => { if (fitTarget.current && !userMoved.current) map.fitBounds(fitTarget.current, { ...FIT, duration: 0 }); });
        map.on('moveend', () => {
          recut(map);
          const o2 = props.current.origin;
          const c = map.getCenter();
          setShowSearchHere(map.getZoom() >= 9.5 && (!o2 || haversineKm(o2, { lat: c.lat, lng: c.lng }) > Math.max(1.5, props.current.radiusKm * 0.5)));
        });
        const pick = (e: { features?: Array<{ properties: Record<string, unknown> }> }) => {
          const id = Number(e.features?.[0]?.properties?.id);
          if (id) props.current.onSelect(id);
        };
        map.on('click', 'pin-selected', pick);
        const zoomCluster = async (e: { features?: Array<{ properties: Record<string, unknown>; geometry: unknown }> }) => {
          const f = e.features?.[0];
          if (!f) return;
          const src = map.getSource('stations') as GeoJSONSource;
          const zoom = await src.getClusterExpansionZoom(f.properties.cluster_id as number);
          userMoved.current = true;
          map.easeTo({ center: (f.geometry as GeoJSON.Point).coordinates as [number, number], zoom: zoom + 0.3 });
        };
        map.on('click', 'labels', (e) => (e.features?.[0]?.properties?.cluster ? zoomCluster(e) : pick(e)));
        map.on('click', 'cluster-dots', zoomCluster);
        map.on('click', 'pin-dots', pick);
        for (const l of ['labels', 'pin-selected', 'pin-dots', 'cluster-dots']) {
          map.on('mouseenter', l, () => (map.getCanvas().style.cursor = 'pointer'));
          map.on('mouseleave', l, () => (map.getCanvas().style.cursor = ''));
        }
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    const onTheme = async () => {
      const m = mapRef.current;
      const next = currentTheme();
      if (!m || next === themeRef.current) return;
      themeRef.current = next;
      m.setStyle(await buildStyle(next), { diff: false });
    };
    window.addEventListener('rp-theme', onTheme);
    const mq = matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', onTheme);
    return () => {
      cancelled = true;
      window.removeEventListener('rp-theme', onTheme);
      mq.removeEventListener('change', onTheme);
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Datos del combustible
  useEffect(() => {
    let alive = true;
    fetch(`/api/map/points?fuel=${fuel}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { points: Point[] }) => {
        if (!alive) return;
        pointsRef.current = d.points;
        setPointsError(false);
        const m = mapRef.current;
        if (m?.getSource('stations')) { pushData(m); cuts.current = [0, 0]; recut(m); }
      })
      .catch(() => alive && setPointsError(true));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fuel, status, retry]);

  // Origen / radio / selección
  useEffect(() => {
    const m = mapRef.current;
    if (m?.getSource('stations')) pushData(m);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin?.lat, origin?.lng, radiusKm, selectedId, bestId]);

  // Encuadre al llegar resultados nuevos
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !origin || status !== 'ready') return;
    const first = fitTarget.current == null;
    fitTarget.current = radiusBounds(origin, radiusKm);
    userMoved.current = false;
    m.fitBounds(fitTarget.current, { ...FIT, duration: first ? 0 : 600 });
    setShowSearchHere(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, status]);

  // Centrar en la seleccionada si queda fuera de vista
  useEffect(() => {
    const m = mapRef.current;
    if (!m || selectedId == null) return;
    const p = pointsRef.current.find((x) => x[0] === selectedId);
    if (p && !m.getBounds().contains([p[2], p[1]])) { userMoved.current = true; m.easeTo({ center: [p[2], p[1]], duration: 500 }); }
  }, [selectedId]);

  return (
    <div className={styles.wrap}>
      <div ref={el} className={styles.map} role="region" aria-label="Mapa de gasolineras con su precio" />
      {status === 'loading' && <div className={styles.veil} aria-live="polite">Cargando mapa…</div>}
      {status === 'error' && (
        <div className={styles.veil} role="alert">No se pudo cargar el mapa. La lista sigue funcionando.</div>
      )}
      {pointsError && status === 'ready' && (
        <div className={styles.banner} role="alert">
          No se pudieron cargar los precios en el mapa. <button type="button" onClick={() => setRetry((n) => n + 1)}>Reintentar</button>
        </div>
      )}
      {showSearchHere && status === 'ready' && (
        <button
          type="button"
          className={styles.searchHere}
          onClick={() => {
            const c = mapRef.current!.getCenter();
            setShowSearchHere(false);
            props.current.onSearchHere({ lat: c.lat, lng: c.lng });
          }}
        >
          Buscar en esta zona
        </button>
      )}
    </div>
  );
}
