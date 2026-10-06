# 02 · Arquitectura y stack

> **Nota (octubre de 2026):** este es el plan inicial de la fase 0. Se decidió mantener REPOSTA sin base de datos ni cuentas y publicar Android como PWA con PWABuilder; el estado real está en el [README](../README.md) y en [06-fase-1-mvp.md](06-fase-1-mvp.md).

## Requisitos que condicionan la arquitectura

1. **Las apps nunca hablan con el Ministerio.** 12 MB sin comprimir cada 30 min es inviable en móvil. Nuestro backend ingiere, normaliza y sirve respuestas pequeñas («las 20 más baratas en 10 km»: unos 5 KB).
2. **Dos cargas muy distintas:**
   - *Tiempo real*: unas 11.500 estaciones × ~5 precios, consultas geoespaciales de baja latencia.
   - *Histórico*: unos 300 millones de puntos estación‑día (2007‑hoy) más agregados por territorio. Pocas escrituras y lecturas analíticas.
3. **Una sola cuenta para web y Android.**
4. **Coste bajo al empezar** y crecimiento sin reescribir.
5. **Rendimiento percibido:** la primera respuesta útil (gasolineras cercanas) en menos de 2 s en un 4G normal.

## Arquitectura propuesta

```
                      ┌─────────────────────────────┐
  MITECO REST  ──────▶│  Ingestor (Node/TS, cron)    │──▶ R2: JSON crudo comprimido (auditoría)
  (cada 30 min)       │  · normaliza · valida        │
  CartoCiudad ───────▶│  · detecta cambios           │
  Oil Bulletin ──────▶│  · recalcula agregados       │
                      └──────────────┬──────────────┘
                                     ▼
                      ┌─────────────────────────────┐
                      │  PostgreSQL + PostGIS        │  (Supabase)
                      │  · station / fuel_price_now  │
                      │  · price_month (series)      │
                      │  · territory_daily_stats     │
                      │  · users, vehicles, alerts…  │  + Auth + RLS
                      └──────────────┬──────────────┘
                                     ▼
                      ┌─────────────────────────────┐
                      │  API (Next.js Route Handlers │  caché CDN por zona/combustible
                      │  + funciones SQL)            │
                      └───────┬─────────────┬───────┘
                              ▼             ▼
                    Web (Next.js, PWA)   Android (Expo / React Native)
                              └──── paquetes compartidos: core · api-client · tokens ────┘
```

## Stack recomendado y por qué

| Capa | Elección | Motivo |
|---|---|---|
| Lenguaje | **TypeScript** en todo | Un solo lenguaje para web, Android, ingestor y tipos compartidos. |
| Monorepo | **pnpm workspaces** | Simple. Turborepo solo si los tiempos de build lo piden. |
| Web | **Next.js (App Router) + React** | SSR/ISR para páginas de datos indexables («Precio gasolina Asturias hoy»), lo que supone SEO y adquisición orgánica, y Route Handlers como API. |
| Estilos | **CSS Modules + tokens CSS propios** | El diseño no debe parecer «de Tailwind». Tokens compartidos con Android. |
| Animación | **Motion (framer-motion)** con moderación + CSS | Microinteracciones y transiciones de layout. |
| Mapa web | **MapLibre GL JS** + estilo propio sobre **OpenFreeMap** | Gratis, WebGL y 100 % personalizable. |
| Mapa Android | **MapLibre Native** (`@maplibre/maplibre-react-native`) | Misma especificación de estilo que la web. |
| Gráficos | **uPlot** (series temporales largas, canvas, ~50 KB) + **SVG a medida con d3-scale/d3-shape** (rankings, mapas coropléticos) | 7.000 puntos × N series sin bloquear; estética propia en lugar de un «tema de librería». |
| Base de datos | **PostgreSQL 16+ con PostGIS** (Supabase) | Geoespacial nativo (`ST_DWithin` + índice GiST), SQL analítico y todo en un sitio. |
| Auth | **Supabase Auth** (correo con enlace mágico + Google; Apple más adelante) | La misma cuenta en web y Android, RLS por usuario y JWT estándar. |
| Ingestor | **Node 22 + TypeScript** ejecutado por cron | Es código, no un servicio gestionado opaco. |
| Programación | **GitHub Actions (cron)** al principio → **Fly.io/Railway** cuando haga falta | 0 € al inicio. El cron de Actions puede retrasarse unos minutos, lo cual es aceptable con datos que cambian cada 30 min. |
| Almacén crudo | **Cloudflare R2** | Copia de cada JSON descargado (gzip, unos 1,5 MB) para auditar y reprocesar. Sin coste de salida. |
| Hosting web | **Vercel** | Encaja con Next.js y tiene CDN. Alternativa: Cloudflare (OpenNext). |
| Push | **Firebase Cloud Messaging** (Android) + **Web Push** (VAPID) | Estándar y gratuito. |
| Observabilidad | Sentry (errores) + registro de ingestas en la propia BD | Detecta si el Ministerio deja de publicar. |

### Lo que **no** proponemos y por qué

- **TimescaleDB:** encajaría, pero Supabase la marca como obsoleta en sus proyectos con Postgres 17 (hay que confirmarlo al crear el proyecto) y ata el hosting. Con particiones nativas y series empaquetadas (ver `03`) Postgres basta.
- **Microservicios / Kafka / ClickHouse:** sobredimensionado. Si el análisis crece, **DuckDB sobre Parquet en R2** es el siguiente paso natural, sin servidores.
- **Mapbox / Google Maps SDK:** coste por uso y estilo limitado.
- **Capacitor (envolver la web) para Android:** es el camino más barato, pero un mapa WebGL dentro de un WebView y la navegación por gestos quedan por debajo del listón de «app comercial». Ver la decisión de Android más abajo.

## Autenticación

- Supabase Auth: enlace mágico, Google y, cuando se publique en iOS, Apple.
- **El producto funciona sin cuenta.** Buscar, mapa, histórico y estadísticas son anónimos. Solo «Mi coche», «Repostajes», «Alertas» y «Favoritas» piden cuenta.
- Antes de registrarse, el coche y los ajustes se guardan en el dispositivo y **se migran a la cuenta al iniciar sesión**. Así se elimina la fricción de pedir registro para calcular el ahorro.
- RLS: `user_id = auth.uid()` en vehículos, repostajes, alertas y favoritas.

## Android: decisión razonada

| | PWA | Capacitor | **Expo / React Native** |
|---|---|---|---|
| Coste de desarrollo | ★★★ | ★★★ | ★★ |
| Mapa fluido (11k puntos y gestos) | ★★ | ★★ | ★★★ (MapLibre nativo) |
| Push fiable | ★★ | ★★★ | ★★★ |
| Sensación de app nativa | ★ | ★★ | ★★★ |
| Reutilización | total | total | lógica, API, tipos y tokens (no componentes) |

**Recomendación:**
1. **Desde la fase 1, la web es una PWA instalable.** Da a los usuarios de Android algo de inmediato y valida la demanda.
2. **En la fase 6, app nativa con Expo**, que comparte `packages/core` (cálculos, tipos, formato de precios), `packages/api-client` y `packages/tokens`. Las pantallas se escriben en React Native con el mismo sistema de diseño.

Para que esto salga barato, **toda la lógica de negocio (ahorro real, estadísticas personales, formateo, validaciones) vive en `packages/core` sin dependencias de DOM**. Lo garantizamos desde el día 1.

## Despliegue y costes estimados

| Etapa | Servicios | Coste mensual aprox. |
|---|---|---|
| Desarrollo / beta | Supabase Free* · Vercel Hobby · GitHub Actions · R2 (10 GB gratis) · OpenFreeMap | **0 €** |
| Lanzamiento | Supabase Pro (8 GB de disco) · Vercel Pro · R2 · dominio | **~50–60 €** |
| Con tracción | + OSRM propio (VPS) · + Fly.io para el ingestor · + disco | **~90–130 €** |

\* El histórico completo (~2–3 GB empaquetado) no cabe en el plan gratuito de 500 MB. Durante el desarrollo se carga un subconjunto (p. ej. 2023‑hoy) o Postgres en local con Docker.

## Estructura del repositorio (objetivo)

```
reposta/
├─ apps/
│  ├─ web/            Next.js (web + API)
│  └─ mobile/         Expo (fase 6)
├─ packages/
│  ├─ core/           dominio: tipos, cálculos, formatos (sin DOM)
│  ├─ api-client/     cliente tipado de la API
│  └─ tokens/         design tokens (CSS vars + objeto JS)
├─ services/
│  └─ ingest/         ingestor MITECO / CartoCiudad / WOB + backfill
├─ db/
│  ├─ schema.sql      esquema (no implementado)
│  └─ migrations/
├─ brand/             identidad visual
├─ docs/              esta documentación
└─ tools/             scripts de verificación
```
