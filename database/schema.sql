-- PostgreSQL / Supabase schema for the MapLibre version.
-- Geographic positions are stored once in the places table as latitude/longitude.

create table if not exists places (
  id text primary key,
  name text not null,
  country text not null,

  latitude double precision not null
    check (latitude between -90 and 90),

  longitude double precision not null
    check (longitude between -180 and 180),

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
  tags text[] not null default '{}',
  period text not null,
  birth_year integer not null,
  death_year integer not null,

  birth_place_id text not null references places(id),
  death_place_id text not null references places(id),

  difficulty integer not null default 1
    check (difficulty between 1 and 5),

  published boolean not null default false,
  image_path text,
  image_credit text,
  image_source_url text,
  image_license text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists persons_period_idx on persons (period);
create index if not exists persons_published_idx on persons (published);
