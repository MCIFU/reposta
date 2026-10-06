import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'REPOSTA: precio del combustible en España',
    short_name: 'REPOSTA',
    description: 'Precios oficiales de las gasolineras de España actualizados cada 30 minutos, si de verdad compensa ir a la más barata, histórico de precios, calculadora de viajes y alertas.',
    start_url: '/?utm_source=pwa',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    orientation: 'portrait',
    background_color: '#0a1630',
    theme_color: '#12306b',
    lang: 'es-ES',
    dir: 'ltr',
    categories: ['travel', 'navigation', 'utilities', 'finance'],
    prefer_related_applications: false,
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Precios cerca de mí', short_name: 'Precios', url: '/', icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }] },
      { name: 'Calcular un viaje', short_name: 'Viaje', url: '/viaje', icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }] },
      { name: 'Histórico de precios', short_name: 'Histórico', url: '/historico', icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }] },
    ],
    screenshots: [
      { src: '/screenshots/precios-movil.png', sizes: '1080x2340', type: 'image/png', form_factor: 'narrow', label: 'Precios de hoy en el mapa' },
      { src: '/screenshots/viaje-movil.png', sizes: '1080x2340', type: 'image/png', form_factor: 'narrow', label: 'Calculadora de viaje' },
      { src: '/screenshots/historico-movil.png', sizes: '1080x2340', type: 'image/png', form_factor: 'narrow', label: 'Histórico de precios' },
      { src: '/screenshots/precios-escritorio.png', sizes: '1920x1080', type: 'image/png', form_factor: 'wide', label: 'Precios y mapa en escritorio' },
    ],
  };
}
