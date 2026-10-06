-- REPOSTA · Esquema de datos v0 (Fase 0)
-- PostgreSQL 16+ con PostGIS. Explicación detallada en docs/03-modelo-de-datos.md
-- Convención: los precios se guardan en MILÉSIMAS de euro (1,459 €/L -> 1459), igual que la precisión de la fuente.

create extension if not exists postgis;

-- ───────────────────────────── Catálogos ─────────────────────────────

create table data_source (
  id            smallint primary key,
  code          text unique not null,            -- 'miteco_rest', 'ec_weekly_oil_bulletin', 'reposta_computed', 'user'
  name          text not null,
  url           text,
  license       text,
  notes         text
);

create table fuel_type (
  id                 smallint primary key,
  code               text unique not null,       -- 'G95E5', 'G98E5', 'GOA', 'GLP', 'H2', 'ADBLUE', 'ELEC'…
  name               text not null,              -- 'Gasolina 95'
  short_name         text not null,              -- '95'
  family             text not null check (family in ('gasoline','diesel','gas','hydrogen','additive','electricity','other')),
  unit               text not null check (unit in ('L','kg','kWh')),
  miteco_product_id  smallint,                   -- IDProducto del Ministerio
  miteco_field       text,                       -- 'Precio Gasolina 95 E5'
  consumer_visible   boolean not null default true,  -- Gasóleo B (agrícola) = false
  sort_order         smallint not null default 100
);

create table brand (
  id         serial primary key,
  slug       text unique not null,
  name       text not null,
  color      text,                               -- solo para leyendas, nunca logos de terceros
  is_low_cost boolean
);

create table brand_alias (                       -- normalización del 'Rótulo' (texto libre, 3.584 variantes)
  raw_label  text primary key,
  brand_id   int references brand(id)
);

-- ───────────────────────────── Territorio ─────────────────────────────
-- Tabla única jerárquica: permite agregados uniformes (España/CCAA/Provincia/Municipio).

create type territory_level as enum ('country','community','province','municipality');

create table territory (
  id          int primary key,                   -- 0 = España; CCAA = 1000+id; provincias = 2000+id; municipios = código INE (5 dígitos)
  level       territory_level not null,
  parent_id   int references territory(id),
  ine_code    text unique,                        -- '03' (CCAA), '33' (prov), '33024' (mun)
  miteco_id   text,                               -- IDCCAA / IDProvincia / IDMunicipio (interno)
  name        text not null,
  slug        text not null,
  geom        geometry(MultiPolygon, 4326),       -- simplificada, para mapas
  centroid    geography(Point, 4326),
  unique (level, miteco_id),
  unique (level, slug)
);
create index on territory (parent_id);

create view autonomous_community as select * from territory where level = 'community';
create view province              as select * from territory where level = 'province';
create view municipality          as select * from territory where level = 'municipality';

-- ───────────────────────────── Estaciones ─────────────────────────────

create table station (
  id               int primary key,              -- IDEESS del Ministerio (estable)
  brand_id         int references brand(id),
  raw_label        text not null,                -- 'Rótulo' tal cual
  address          text,
  postal_code      text,
  locality         text,
  municipality_id  int references territory(id),
  province_id      int references territory(id),
  community_id     int references territory(id),
  location         geography(Point, 4326) not null,
  schedule_raw     text,                          -- 'L-D: 07:00-22:00'
  schedule         jsonb,                         -- parseado: [{days:[1..7], open:'07:00', close:'22:00'}]; null si no se puede
  is_24h           boolean,
  sale_type        char(1),                       -- P público / R restringido
  road_side        char(1),                       -- D / I
  first_seen       date not null,
  last_seen        date not null,
  is_active        boolean not null default true,
  updated_at       timestamptz not null default now()
);
create index station_location_gix on station using gist (location);
create index on station (municipality_id);
create index on station (province_id);

-- Combustibles que vende una estación hoy (derivado, útil para filtros en mapa)
create table station_fuel (
  station_id int references station(id),
  fuel_id    smallint references fuel_type(id),
  primary key (station_id, fuel_id)
);

-- ───────────────────────────── Ingesta ─────────────────────────────

create table snapshot (                          -- cada descarga de la fuente
  id                bigserial primary key,
  source_id         smallint not null references data_source(id),
  kind              text not null check (kind in ('current','historical_daily','weekly_bulletin')),
  source_timestamp  timestamptz not null,         -- campo 'Fecha' de la fuente
  fetched_at        timestamptz not null default now(),
  station_count     int,
  price_count       int,
  raw_object_key    text,                         -- ruta en R2 del JSON crudo (gzip)
  sha256            text,
  status            text not null default 'ok' check (status in ('ok','partial','failed','duplicate')),
  error             text,
  unique (source_id, kind, source_timestamp)
);

-- ───────────────────────────── Precios ─────────────────────────────

-- 1) PRECIO ACTUAL: una fila por estación-combustible. Lo consultan buscador y mapa.
create table fuel_price (
  station_id     int      not null references station(id),
  fuel_id        smallint not null references fuel_type(id),
  price_milli    int      not null check (price_milli > 0),
  observed_at    timestamptz not null,            -- marca de tiempo de la fuente
  changed_at     timestamptz not null,            -- desde cuándo está vigente este precio (detectado por nosotros)
  snapshot_id    bigint not null references snapshot(id),
  primary key (fuel_id, station_id)
);

-- 2) CAMBIOS INTRADÍA (desde nuestra puesta en marcha): solo se inserta cuando el precio cambia.
create table price_change (
  station_id   int      not null,
  fuel_id      smallint not null,
  valid_from   timestamptz not null,
  price_milli  int      not null,
  snapshot_id  bigint   not null,
  primary key (station_id, fuel_id, valid_from)
) partition by range (valid_from);
-- particiones por año: create table price_change_2026 partition of price_change for values from ('2026-01-01') to ('2027-01-01');

-- 3) HISTÓRICO DIARIO EMPAQUETADO: una fila por estación-combustible-MES con un array de hasta 31 precios diarios.
--    ~300 M de puntos diarios 2007-2026 -> ~9 M filas (~1-1,5 GB). La serie de una estación se lee en pocas filas.
create table price_month (
  station_id   int      not null,
  fuel_id      smallint not null,
  month        date     not null check (extract(day from month) = 1),
  prices       smallint[] not null,               -- índice 1 = día 1; NULL = sin dato ese día. Milésimas de €. (máx 32,767 €)
  source_id    smallint not null default 1,
  primary key (station_id, fuel_id, month)
) partition by range (month);
-- particiones por año: create table price_month_2007 partition of price_month for values from ('2007-01-01') to ('2008-01-01');

-- ───────────────────────────── Agregados (calculados por REPOSTA) ─────────────────────────────

create table territory_daily_stats (              -- España, CCAA y provincias: diario. Municipios: ver monthly.
  territory_id     int      not null references territory(id),
  fuel_id          smallint not null references fuel_type(id),
  day              date     not null,
  station_count    int      not null,
  avg_milli        int      not null,             -- media recortada (p2-p98)
  median_milli     int      not null,
  p10_milli        int      not null,
  p90_milli        int      not null,
  min_milli        int      not null,
  max_milli        int      not null,
  min_station_id   int,
  max_station_id   int,
  method_version   smallint not null default 1,   -- si cambia el método, se recalcula y se versiona
  primary key (fuel_id, territory_id, day)
);

create table territory_monthly_stats (            -- todos los niveles, incluido municipio
  territory_id     int      not null references territory(id),
  fuel_id          smallint not null references fuel_type(id),
  month            date     not null,
  station_days     int      not null,
  avg_milli        int      not null,
  median_milli     int      not null,
  min_milli        int      not null,
  max_milli        int      not null,
  method_version   smallint not null default 1,
  primary key (fuel_id, territory_id, month)
);

-- Series oficiales externas (p. ej. Weekly Oil Bulletin): NUNCA se mezclan con las medias de REPOSTA.
create table official_series_point (
  source_id      smallint not null references data_source(id),
  series_code    text     not null,               -- 'ES_price_with_tax_euro95'
  territory_id   int      not null references territory(id),
  fuel_id        smallint not null references fuel_type(id),
  period_start   date     not null,
  period_type    text     not null check (period_type in ('day','week','month')),
  value_milli    int      not null,               -- €/L en milésimas (convertido desde €/1000 L)
  includes_taxes boolean  not null,
  primary key (source_id, series_code, period_start)
);

-- Récords: tabla materializada recalculada tras cada ingesta diaria.
create table record (
  code           text not null,                   -- 'all_time_min','all_time_max','biggest_daily_rise','biggest_daily_drop','cheapest_community_avg'…
  fuel_id        smallint not null references fuel_type(id),
  territory_id   int not null references territory(id),
  scope_period   daterange not null,              -- periodo evaluado
  value_milli    int not null,
  occurred_on    date not null,
  station_id     int,
  related_territory_id int,
  source_id      smallint not null references data_source(id),
  computed_at    timestamptz not null default now(),
  primary key (code, fuel_id, territory_id)
);

-- ───────────────────────────── Usuario ─────────────────────────────
-- user_id = auth.users.id (Supabase). RLS: user_id = auth.uid()

create table profile (
  user_id        uuid primary key,
  display_name   text,
  default_fuel_id smallint references fuel_type(id),
  home_location  geography(Point, 4326),
  value_of_time_eur_h numeric(6,2),               -- opcional: valor del tiempo para «¿Me compensa?»
  created_at     timestamptz not null default now()
);

create table vehicle (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null,
  make                   text,
  model                  text,
  year                   smallint,
  fuel_id                smallint not null references fuel_type(id),
  consumption_combined   numeric(4,1),            -- L/100 km (o kg/100 km)
  consumption_urban      numeric(4,1),
  consumption_highway    numeric(4,1),
  tank_capacity          numeric(5,1),
  is_default             boolean not null default false,
  created_at             timestamptz not null default now()
);
create index on vehicle (user_id);

create table refueling (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null,
  vehicle_id       uuid references vehicle(id) on delete set null,
  station_id       int references station(id),
  station_label    text,                           -- si la estación no está en el catálogo
  fuel_id          smallint not null references fuel_type(id),
  refueled_at      timestamptz not null,
  liters           numeric(6,2) not null check (liters > 0),
  price_milli      int not null,                   -- precio por litro pagado
  total_cents      int not null,                   -- importe total pagado
  odometer_km      int,
  trip_km          numeric(7,1),                   -- km desde el anterior repostaje (si el usuario lo indica)
  is_full_tank     boolean not null default true,  -- necesario para calcular consumo real
  reference_price_milli int,                       -- media de la provincia ese día (para «ahorro estimado»)
  notes            text,
  created_at       timestamptz not null default now()
);
create index on refueling (user_id, refueled_at desc);

create table favorite_station (
  user_id    uuid not null,
  station_id int  not null references station(id),
  created_at timestamptz not null default now(),
  primary key (user_id, station_id)
);

create type alert_kind as enum ('territory_avg_below','territory_avg_change_pct','station_near_below','station_price_below');

create table alert (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null,
  kind            alert_kind not null,
  fuel_id         smallint not null references fuel_type(id),
  territory_id    int references territory(id),
  station_id      int references station(id),
  center          geography(Point, 4326),
  radius_m        int,
  threshold_milli int,
  change_pct      numeric(5,2),
  cooldown        interval not null default '24 hours',
  is_active       boolean not null default true,
  last_triggered_at timestamptz,
  created_at      timestamptz not null default now()
);
create index on alert (fuel_id) where is_active;

create table push_subscription (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  platform    text not null check (platform in ('web','android','ios')),
  token       text not null,                       -- FCM token o endpoint Web Push (JSON)
  created_at  timestamptz not null default now(),
  unique (platform, token)
);

create table alert_event (
  id           bigserial primary key,
  alert_id     uuid not null references alert(id) on delete cascade,
  triggered_at timestamptz not null default now(),
  payload      jsonb not null,                    -- precio, estación, distancia… lo que vio el usuario
  delivered    boolean not null default false
);

-- ───────────────────────────── Consultas clave (referencia) ─────────────────────────────

-- Gasolineras más baratas en un radio:
-- select s.id, s.raw_label, p.price_milli, p.observed_at,
--        st_distance(s.location, $origin) as dist_m
-- from fuel_price p join station s on s.id = p.station_id
-- where p.fuel_id = $fuel and s.is_active
--   and st_dwithin(s.location, $origin, $radius_m)
-- order by p.price_milli, dist_m
-- limit 50;

-- Serie diaria de una estación entre dos fechas:
-- select (pm.month + (d.i - 1) * interval '1 day')::date as day, pm.prices[d.i] as price_milli
-- from price_month pm, generate_subscripts(pm.prices, 1) as d(i)
-- where pm.station_id = $1 and pm.fuel_id = $2 and pm.month between date_trunc('month', $from::date) and $to
--   and pm.prices[d.i] is not null;
