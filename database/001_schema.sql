-- Histoglyph / Supabase schema
-- Run this first in Supabase SQL Editor.

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
create schema if not exists extensions;
create extension if not exists unaccent with schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  name text not null,
  country text not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  precision text not null default 'locality' check (
    precision in ('exact','locality','archaeological_site','region','country','uncertain')
  ),
  verification_status text not null default 'unverified' check (
    verification_status in ('unverified','automatically_matched','manually_verified','uncertain')
  ),
  source text,
  source_id text,
  notes text,
  search_text text generated always as (
    lower(coalesce(name,'') || ' ' || coalesce(country,'') || ' ' || coalesce(legacy_id,'') || ' ' || coalesce(source_id,''))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists places_source_unique_idx
  on public.places (source, source_id)
  where source is not null and source <> '' and source_id is not null and source_id <> '';
create index if not exists places_search_idx on public.places using gin (search_text gin_trgm_ops);
create index if not exists places_verification_idx on public.places (verification_status);

create table if not exists public.persons (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  name text not null,
  period text not null,
  birth_year integer not null,
  death_year integer not null,
  birth_place_id uuid not null references public.places(id) on update cascade,
  death_place_id uuid not null references public.places(id) on update cascade,
  difficulty integer not null default 1 check (difficulty between 1 and 5),
  verification_status text not null default 'unverified' check (
    verification_status in ('unverified','automatically_matched','manually_verified','uncertain')
  ),
  published boolean not null default false,
  search_text text generated always as (
    lower(coalesce(name,'') || ' ' || coalesce(period,'') || ' ' || coalesce(legacy_id,''))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists persons_search_idx on public.persons using gin (search_text gin_trgm_ops);
create index if not exists persons_published_idx on public.persons (published);
create index if not exists persons_period_idx on public.persons (period);
create index if not exists persons_birth_place_idx on public.persons (birth_place_id);
create index if not exists persons_death_place_idx on public.persons (death_place_id);
create index if not exists persons_verification_idx on public.persons (verification_status);

create table if not exists public.accepted_answers (
  id bigint generated always as identity primary key,
  person_id uuid not null references public.persons(id) on delete cascade,
  answer text not null,
  created_at timestamptz not null default now(),
  unique (person_id, answer)
);
create index if not exists accepted_answers_person_idx on public.accepted_answers (person_id);

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug = lower(slug)),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.person_tags (
  person_id uuid not null references public.persons(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (person_id, tag_id)
);
create index if not exists person_tags_tag_idx on public.person_tags (tag_id, person_id);

create table if not exists public.collections (
  slug text primary key check (slug = lower(slug)),
  game_mode text not null default 'life-map',
  group_name text not null default 'Global',
  title text not null,
  description text not null default '',
  status text not null default 'draft' check (status in ('draft','available','coming-soon','archived')),
  default_rounds integer not null default 5 check (default_rounds between 1 and 100),
  sort_order integer not null default 0,
  include_all_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.collection_tags (
  collection_slug text not null references public.collections(slug) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (collection_slug, tag_id)
);

create table if not exists public.collection_persons (
  collection_slug text not null references public.collections(slug) on delete cascade,
  person_id uuid not null references public.persons(id) on delete cascade,
  primary key (collection_slug, person_id)
);

create table if not exists public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  collection_slug text not null references public.collections(slug),
  timed boolean not null,
  show_places_initially boolean not null,
  round_count integer not null check (round_count between 1 and 100),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

create table if not exists public.game_session_rounds (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions(id) on delete cascade,
  round_number integer not null,
  person_id uuid not null references public.persons(id),
  started_at timestamptz,
  completed_at timestamptz,
  outcome text check (outcome in ('correct','incorrect','revealed','timeout')),
  points integer not null default 0 check (points between 0 and 1000),
  unique (session_id, round_number)
);
create index if not exists game_rounds_session_idx on public.game_session_rounds (session_id, round_number);

-- Updated-at triggers
DROP TRIGGER IF EXISTS places_set_updated_at ON public.places;
create trigger places_set_updated_at before update on public.places
for each row execute function public.set_updated_at();
DROP TRIGGER IF EXISTS persons_set_updated_at ON public.persons;
create trigger persons_set_updated_at before update on public.persons
for each row execute function public.set_updated_at();
DROP TRIGGER IF EXISTS collections_set_updated_at ON public.collections;
create trigger collections_set_updated_at before update on public.collections
for each row execute function public.set_updated_at();
