# 03 · Modelo de datos y estrategia de históricos

Esquema completo y validado: [`db/schema.sql`](../db/schema.sql) (probado en PostgreSQL 17 embebido: 27 tablas, consultas de series correctas).

## Entidades

| Entidad pedida | Tabla | Notas |
|---|---|---|
| Station | `station` | `id` = `IDEESS` del Ministerio. Ubicación `geography(Point)` con índice GiST. |
| Brand | `brand` + `brand_alias` | El «Rótulo» es texto libre: 3.584 variantes. Los alias lo normalizan. |
| FuelType | `fuel_type` | Incluye `unit` (L/kg/kWh), `family` y `consumer_visible`. Preparado para AdBlue, H₂ y electricidad. |
| FuelPrice | `fuel_price` | **Precio actual**: una fila por estación y combustible. |
| HistoricalPrice | `price_month` (+ `price_change` intradía) | Ver la estrategia más abajo. |
| Location | `geography` en `station`, `territory.centroid`, `profile.home_location` | Tipo PostGIS, no una tabla aparte. |
| AutonomousCommunity / Province / Municipality | `territory` (jerárquica) + vistas `autonomous_community`, `province`, `municipality` | Una sola clave permite agregados uniformes en los 4 niveles. |
| User | `auth.users` (Supabase) + `profile` | |
| Vehicle | `vehicle` | Consumo combinado, urbano y en carretera. |
| Refueling | `refueling` | Guarda `reference_price_milli` para estimar el ahorro. `is_full_tank` sirve para el consumo real. |
| Alert | `alert` + `alert_event` + `push_subscription` | Cuatro tipos iniciales. Push desacoplado. |
| *(extra)* | `snapshot`, `data_source`, `official_series_point`, `record`, `favorite_station` | Trazabilidad, series oficiales, récords y favoritas. |

## Tres tipos de dato que nunca se mezclan

| Tipo | Dónde | Cómo se muestra |
|---|---|---|
| **Precio actual** (oficial, por estación) | `fuel_price` | «1,459 €/L · actualizado hoy 18:30 · Fuente: MITECO» |
| **Precio histórico** (oficial, por estación y día) | `price_month`, `price_change` | «Precio a las 00:00 del 12/03/2022 · Fuente: MITECO (histórico)» |
| **Media calculada por REPOSTA** | `territory_*_stats`, `record` | «Media REPOSTA · 10.900 estaciones · método v1» con enlace a la metodología |
| **Media oficial externa** | `official_series_point` | «Media oficial semanal · Comisión Europea» |

Cada precio enlaza con un `snapshot`: fuente, marca de tiempo original, hora de descarga y archivo crudo en R2. Cualquier cifra se puede **auditar** hasta el JSON original.

## Estrategia para millones de registros

**Volumen real estimado** (a partir de las instantáneas medidas):
- Pares estación‑combustible: unos 28.000 en 2007 y unos 45.000 hoy, contando solo combustibles con precio.
- Unos 7.200 días × ~36.000 de media ≈ **260 millones de puntos diarios** de 2007 a hoy.
- Crecimiento de unos 16 millones de puntos al año, más los cambios intradía.

**Problema:** 260 M filas «una fila = un precio» ocupan unos 10 GB de tabla más 6 GB de índice en Postgres. Sirve, pero es caro e innecesariamente lento.

**Solución: series mensuales empaquetadas** (`price_month`):
- Una fila = estación × combustible × mes, con un `smallint[]` de hasta 31 precios en milésimas de euro.
- **≈ 9 millones de filas, ~1–1,5 GB**, particionadas por año.
- La serie de 10 años de una estación son 120 filas. Se lee con un índice en menos de 10 ms.
- Coste: escribir un día implica actualizar el array del mes. La ingesta diaria lo hace en lote (`INSERT … ON CONFLICT DO UPDATE SET prices[d] = …`).

**Las estadísticas territoriales no se calculan en cada petición.** Se precalculan en la ingesta:
- `territory_daily_stats`: España, 19 CCAA y 52 provincias × ~8 combustibles × 7.200 días ≈ **4,2 M filas**. Un gráfico 2010‑2026 de Asturias lee unas 6.000 filas pequeñas, consulta de un solo dígito de ms.
- `territory_monthly_stats`: todos los niveles, municipios incluidos (≈ 3.500 con estaciones).
- **Diario de un municipio:** se calcula al vuelo desde `price_month` de sus estaciones (habitualmente de 1 a 30) y se cachea.

**Caché HTTP** (CDN): `/api/stats/...` con `s-maxage` hasta la siguiente ingesta. Los datos históricos son inmutables y se cachean de forma indefinida.

**Siguiente escalón** (solo si hace falta): exportar `price_month` a Parquet en R2 y lanzar consultas ad‑hoc con DuckDB. No hace falta en las fases 1 a 5.

## Pipeline de ingesta

```
cada 30 min   EstacionesTerrestres/ → R2 (gzip) → snapshot
              → upsert station (alta/baja/cambios) → diff con fuel_price
              → si cambia: price_change + actualizar fuel_price.changed_at
              → evaluar alertas station_* afectadas

cada día 03:00  EstacionesTerrestresHist/{ayer} → price_month (día d)
              → territory_daily_stats (ayer) → monthly (mes en curso)
              → record (recalcular) → evaluar alertas territory_*

lunes         Weekly Oil Bulletin → official_series_point

una vez       backfill 01/01/2007 → ayer: ~7.200 peticiones de 8–12 MB, a 1 cada 5–10 s
              (≈ 10–20 h, unos 75 GB descargados). Reanudable, idempotente y con registro en snapshot.
```

## Calidad de los datos (reglas)

1. Un precio ≤ 0 o fuera de [0,3 · mediana provincial, 3 · mediana provincial] se marca como sospechoso. **Se guarda** pero se excluye de las medias y de los récords «de mercado».
2. Las medias usan la **media recortada p2–p98** y la **mediana**. El método está versionado (`method_version`).
3. Una estación que no aparece en 7 instantáneas seguidas pasa a `is_active = false`.
4. Si la fuente publica una `Fecha` igual a la anterior, el snapshot es `duplicate` y no se procesa.
5. Si una ingesta falla, la interfaz muestra la hora real del último dato y nunca «ahora».
