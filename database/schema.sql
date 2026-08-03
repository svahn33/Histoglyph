-- PostgreSQL / Supabase schema for the production version.
-- The browser prototype uses IndexedDB, but the same data model is used here.

create table if not exists places (
  id text primary key,
  name text not null,
  historical_name text,
  country_code char(2),
  country text not null,

  latitude double precision not null
    check (latitude between -90 and 90),

  longitude double precision not null
    check (longitude between -180 and 180),

  -- Exact verified location on the selected static map image.
  map_x double precision not null
    check (map_x between 0 and 100),

  map_y double precision not null
    check (map_y between 0 and 100),

  precision text not null default 'locality'
    check (
      precision in (
        'exact',
        'locality',
        'archaeological_site',
        'region',
        'country',
        'uncertain'
      )
    ),

  verification_status text not null default 'unverified'
    check (
      verification_status in (
        'unverified',
        'automatically_matched',
        'manually_verified',
        'uncertain'
      )
    ),

  source text,
  source_id text,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (source, source_id)
);

create index if not exists places_name_country_idx
  on places (lower(name), lower(country));

create index if not exists places_review_queue_idx
  on places (verification_status);

create table if not exists persons (
  id text primary key,
  name text not null,
  accepted_answers text[] not null default '{}',
  period text not null,

  birth_year integer not null,
  death_year integer not null,

  birth_place_id text not null
    references places(id),

  death_place_id text not null
    references places(id),

  difficulty integer not null default 1
    check (difficulty between 1 and 5),

  published boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists persons_period_idx
  on persons (period);

create index if not exists persons_published_idx
  on persons (published);

create or replace view playable_persons as
select
  p.*,
  bp.name as birth_place_name,
  bp.map_x as birth_map_x,
  bp.map_y as birth_map_y,
  dp.name as death_place_name,
  dp.map_x as death_map_x,
  dp.map_y as death_map_y
from persons p
join places bp on bp.id = p.birth_place_id
join places dp on dp.id = p.death_place_id
where p.published = true;
