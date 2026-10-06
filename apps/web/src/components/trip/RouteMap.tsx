'use client';
import { useEffect, useRef, useState } from 'react';
import type { Map as MlMap, GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { buildStyle, type MapTheme } from '../map/style';
import { installPinFactory } from '../map/pins';
import styles from './RouteMap.module.css';

export interface RouteMapProps {
  points: Array<{ lat: number; lng: number }>;
  geometry: Array<[number, number]> | null;
  stations: Array<{ id: number; lat: number; lng: number; priceMilli: number }>;
  onStation?: (id: number) => void;
}

const theme = (): MapTheme => {
  const t = document.documentElement.getAttribute('data-theme');
  if (t === 'dark' || t === 'light') return t;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};
const LETTERS = 'ABCDEFGHIJ';

export default function RouteMap({ points, geometry, stations, onStation }: RouteMapProps) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const themeRef = useRef<MapTheme>('light');
  const latest = useRef({ points, geometry, stations, onStation });
  latest.current = { points, geometry, stations, onStation };
  const [ready, setReady] = useState(false);

  function overlay(map: MlMap) {
    if (map.getSource('route')) return;
    const dark = themeRef.current === 'dark';
    map.addSource('route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addSource('stops', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addSource('cheap', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({ id: 'route-casing', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': dark ? '#0a1630' : '#ffffff', 'line-width': 8 } });
    map.addLayer({ id: 'route-line', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': dark ? '#8fb0ff' : '#12306b', 'line-width': 4.5 } });
    map.addLayer({ id: 'stops-dot', type: 'circle', source: 'stops', paint: { 'circle-radius': 12, 'circle-color': dark ? '#8fb0ff' : '#12306b', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2.5 } });
    map.addLayer({
      id: 'stops-label', type: 'symbol', source: 'stops',
      layout: { 'text-field': ['get', 'l'], 'text-font': ['Noto Sans Bold'], 'text-size': 12, 'text-allow-overlap': true },
      paint: { 'text-color': dark ? '#0a1630' : '#ffffff' },
    });
    // Las 5 más baratas: pocas y siempre visibles, por encima de las paradas (la más barata, arriba del todo).
    map.addLayer({
      id: 'cheap', type: 'symbol', source: 'cheap',
      layout: { 'icon-image': ['concat', 'pin|', ['to-string', ['get', 'p']], '|0|', themeRef.current], 'icon-anchor': 'bottom', 'icon-offset': [0, -4], 'icon-allow-overlap': true, 'symbol-sort-key': ['-', 0, ['get', 'p']] },
    });
  }

  function push(map: MlMap, fit: boolean) {
    const { points: pts, geometry: g, stations: st } = latest.current;
    if (!map.getSource('route')) return;
    (map.getSource('route') as GeoJSONSource).setData({ type: 'FeatureCollection', features: g ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: g } }] : [] });
    (map.getSource('stops') as GeoJSONSource).setData({ type: 'FeatureCollection', features: pts.map((p, i) => ({ type: 'Feature', properties: { l: LETTERS[i] }, geometry: { type: 'Point', coordinates: [p.lng, p.lat] } })) });
    (map.getSource('cheap') as GeoJSONSource).setData({ type: 'FeatureCollection', features: st.map((s) => ({ type: 'Feature', properties: { id: s.id, p: s.priceMilli }, geometry: { type: 'Point', coordinates: [s.lng, s.lat] } })) });
    const coords = g ?? pts.map((p) => [p.lng, p.lat] as [number, number]);
    if (fit && coords.length) {
      const lngs = coords.map((c) => c[0]), lats = coords.map((c) => c[1]);
      const b: [[number, number], [number, number]] = [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]];
      if (coords.length === 1) map.easeTo({ center: coords[0], zoom: 11, duration: 0 });
      else map.fitBounds(b, { padding: 48, duration: 500, maxZoom: 13 });
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mod = await import('maplibre-gl');
      const maplibre = ((mod as unknown as { default?: typeof mod }).default ?? mod);
      maplibre.setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
      themeRef.current = theme();
      const style = await buildStyle(themeRef.current);
      if (cancelled || !el.current) return;
      const map = new maplibre.Map({
        container: el.current, style, center: [-3.7, 40.1], zoom: 4.8, attributionControl: { compact: true },
        dragRotate: false, pitchWithRotate: false, cooperativeGestures: matchMedia('(max-width: 959px) and (pointer: coarse)').matches,
        locale: { 'CooperativeGesturesHandler.MobileHelpText': 'Usa dos dedos para mover el mapa', 'CooperativeGesturesHandler.WindowsHelpText': 'Usa Ctrl + rueda para hacer zoom', 'CooperativeGesturesHandler.MacHelpText': 'Usa ⌘ + rueda para hacer zoom' },
      });
      map.touchZoomRotate.disableRotation();
      map.addControl(new maplibre.NavigationControl({ showCompass: false }), 'bottom-right');
      installPinFactory(map);
      mapRef.current = map;
      if (process.env.NODE_ENV !== 'production') (window as unknown as { __rpRouteMap?: MlMap }).__rpRouteMap = map;
      map.on('style.load', () => { overlay(map); push(map, true); });
      map.on('load', () => setReady(true));
      map.on('click', 'cheap', (e) => { const id = Number(e.features?.[0]?.properties?.id); if (id) latest.current.onStation?.(id); });
      map.on('mouseenter', 'cheap', () => (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', 'cheap', () => (map.getCanvas().style.cursor = ''));
    })();
    const onTheme = async () => {
      const m = mapRef.current;
      const t = theme();
      if (!m || t === themeRef.current) return;
      themeRef.current = t;
      m.setStyle(await buildStyle(t), { diff: false });
    };
    window.addEventListener('rp-theme', onTheme);
    return () => { cancelled = true; window.removeEventListener('rp-theme', onTheme); mapRef.current?.remove(); mapRef.current = null; };
  }, []);

  const key = JSON.stringify([points, geometry?.length, geometry?.[0], stations.map((s) => s.id)]);
  useEffect(() => {
    if (mapRef.current && ready) push(mapRef.current, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready]);

  return (
    <div className={styles.wrap}>
      <div ref={el} className={styles.map} role="region" aria-label="Mapa del viaje" />
      {!ready && <div className={styles.veil}>Cargando mapa…</div>}
    </div>
  );
}
