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


-- Histoglyph security and Row Level Security
-- Run after 001_schema.sql.

create or replace function public.is_histoglyph_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users au
    where au.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_histoglyph_admin() from public;
grant execute on function public.is_histoglyph_admin() to authenticated;

alter table public.admin_users enable row level security;
alter table public.places enable row level security;
alter table public.persons enable row level security;
alter table public.accepted_answers enable row level security;
alter table public.tags enable row level security;
alter table public.person_tags enable row level security;
alter table public.collections enable row level security;
alter table public.collection_tags enable row level security;
alter table public.collection_persons enable row level security;
alter table public.game_sessions enable row level security;
alter table public.game_session_rounds enable row level security;

-- Remove old policies when rerunning this file.
do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'admin_users','places','persons','accepted_answers','tags','person_tags',
        'collections','collection_tags','collection_persons','game_sessions','game_session_rounds'
      )
  loop
    execute format('drop policy if exists %I on %I.%I', policy_record.policyname, policy_record.schemaname, policy_record.tablename);
  end loop;
end $$;

create policy "Admins can read their admin record"
on public.admin_users for select to authenticated
using (user_id = (select auth.uid()));

create policy "Public can read available collection metadata"
on public.collections for select to anon, authenticated
using (status in ('available','coming-soon'));

create policy "Admins manage places"
on public.places for all to authenticated
using ((select public.is_histoglyph_admin()))
with check ((select public.is_histoglyph_admin()));

create policy "Admins manage persons"
on public.persons for all to authenticated
using ((select public.is_histoglyph_admin()))
with check ((select public.is_histoglyph_admin()));

create policy "Admins manage accepted answers"
on public.accepted_answers for all to authenticated
using ((select public.is_histoglyph_admin()))
with check ((select public.is_histoglyph_admin()));

create policy "Admins manage tags"
on public.tags for all to authenticated
using ((select public.is_histoglyph_admin()))
with check ((select public.is_histoglyph_admin()));

create policy "Admins manage person tags"
on public.person_tags for all to authenticated
using ((select public.is_histoglyph_admin()))
with check ((select public.is_histoglyph_admin()));

create policy "Admins manage collections"
on public.collections for all to authenticated
using ((select public.is_histoglyph_admin()))
with check ((select public.is_histoglyph_admin()));

create policy "Admins manage collection tags"
on public.collection_tags for all to authenticated
using ((select public.is_histoglyph_admin()))
with check ((select public.is_histoglyph_admin()));

create policy "Admins manage collection persons"
on public.collection_persons for all to authenticated
using ((select public.is_histoglyph_admin()))
with check ((select public.is_histoglyph_admin()));

-- No direct client policies are created for game_sessions or game_session_rounds.
-- Public play is only available through the security-definer RPC functions.

revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;

grant select on public.collections to anon, authenticated;
grant select, insert, update, delete on
  public.admin_users,
  public.places,
  public.persons,
  public.accepted_answers,
  public.tags,
  public.person_tags,
  public.collections,
  public.collection_tags,
  public.collection_persons
  to authenticated;
grant usage, select on all sequences in schema public to authenticated;


-- Histoglyph public game RPC and admin helper RPC
-- Run after 002_security.sql.

create or replace function public.normalize_histoglyph_answer(input_text text)
returns text
language sql
stable
set search_path = public, extensions
as $$
  select trim(
    regexp_replace(
      lower(extensions.unaccent(coalesce(input_text, ''))),
      '[^[:alnum:]]+',
      ' ',
      'g'
    )
  );
$$;

create or replace function public.list_life_map_collections()
returns table (
  slug text,
  group_name text,
  title text,
  description text,
  status text,
  default_rounds integer,
  available_people bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.slug,
    c.group_name,
    c.title,
    c.description,
    c.status,
    c.default_rounds,
    case
      when c.status <> 'available' then 0::bigint
      else (
        select count(distinct p.id)
        from public.persons p
        where p.published
          and exists (select 1 from public.places bp where bp.id = p.birth_place_id)
          and exists (select 1 from public.places dp where dp.id = p.death_place_id)
          and (
            c.include_all_published
            or exists (
              select 1 from public.collection_persons cp
              where cp.collection_slug = c.slug and cp.person_id = p.id
            )
            or exists (
              select 1
              from public.person_tags pt
              join public.collection_tags ct on ct.tag_id = pt.tag_id
              where pt.person_id = p.id and ct.collection_slug = c.slug
            )
          )
      )
    end as available_people
  from public.collections c
  where c.game_mode = 'life-map'
    and c.status in ('available','coming-soon')
  order by c.sort_order, c.group_name, c.title;
$$;

create or replace function public.start_life_map_game(
  p_collection_slug text,
  p_round_count integer,
  p_timed boolean,
  p_show_places boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_round_count integer := greatest(1, least(100, coalesce(p_round_count, 5)));
  v_collection public.collections%rowtype;
  v_eligible_count integer;
begin
  select * into v_collection
  from public.collections
  where slug = p_collection_slug
    and game_mode = 'life-map'
    and status = 'available';

  if not found then
    raise exception 'Collection is not available.' using errcode = 'P0001';
  end if;

  select count(*) into v_eligible_count
  from public.persons p
  where p.published
    and exists (select 1 from public.places bp where bp.id = p.birth_place_id)
    and exists (select 1 from public.places dp where dp.id = p.death_place_id)
    and (
      v_collection.include_all_published
      or exists (
        select 1 from public.collection_persons cp
        where cp.collection_slug = v_collection.slug and cp.person_id = p.id
      )
      or exists (
        select 1
        from public.person_tags pt
        join public.collection_tags ct on ct.tag_id = pt.tag_id
        where pt.person_id = p.id and ct.collection_slug = v_collection.slug
      )
    );

  if v_eligible_count = 0 then
    raise exception 'This collection has no published people.' using errcode = 'P0001';
  end if;

  insert into public.game_sessions(collection_slug, timed, show_places_initially, round_count)
  values (v_collection.slug, coalesce(p_timed, true), coalesce(p_show_places, false), v_round_count)
  returning id into v_session_id;

  with eligible as (
    select p.id
    from public.persons p
    where p.published
      and exists (select 1 from public.places bp where bp.id = p.birth_place_id)
      and exists (select 1 from public.places dp where dp.id = p.death_place_id)
      and (
        v_collection.include_all_published
        or exists (
          select 1 from public.collection_persons cp
          where cp.collection_slug = v_collection.slug and cp.person_id = p.id
        )
        or exists (
          select 1
          from public.person_tags pt
          join public.collection_tags ct on ct.tag_id = pt.tag_id
          where pt.person_id = p.id and ct.collection_slug = v_collection.slug
        )
      )
  ),
  shuffled as (
    select id, row_number() over (order by random())::integer as rn
    from eligible
  ),
  stats as (
    select count(*)::integer as cnt from shuffled
  )
  insert into public.game_session_rounds(session_id, round_number, person_id)
  select
    v_session_id,
    gs.round_number,
    s.id
  from generate_series(1, v_round_count) as gs(round_number)
  cross join stats
  join shuffled s on s.rn = ((gs.round_number - 1) % stats.cnt) + 1;

  return jsonb_build_object(
    'session_id', v_session_id,
    'round_count', v_round_count,
    'timed', coalesce(p_timed, true),
    'show_places_initially', coalesce(p_show_places, false),
    'collection_slug', v_collection.slug,
    'collection_title', v_collection.title,
    'collection_description', v_collection.description
  );
end;
$$;

create or replace function public.get_life_map_round(
  p_session_id uuid,
  p_round_number integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_data record;
begin
  select
    s.timed,
    s.show_places_initially,
    s.round_count,
    s.expires_at,
    r.completed_at,
    p.birth_year,
    p.death_year,
    bp.id as birth_place_id,
    bp.name as birth_place_name,
    bp.country as birth_country,
    bp.latitude as birth_latitude,
    bp.longitude as birth_longitude,
    bp.verification_status as birth_verification_status,
    dp.id as death_place_id,
    dp.name as death_place_name,
    dp.country as death_country,
    dp.latitude as death_latitude,
    dp.longitude as death_longitude,
    dp.verification_status as death_verification_status
  into v_data
  from public.game_sessions s
  join public.game_session_rounds r on r.session_id = s.id
  join public.persons p on p.id = r.person_id
  join public.places bp on bp.id = p.birth_place_id
  join public.places dp on dp.id = p.death_place_id
  where s.id = p_session_id and r.round_number = p_round_number;

  if not found or v_data.expires_at < now() then
    raise exception 'Game session or round was not found.' using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'round_number', p_round_number,
    'round_count', v_data.round_count,
    'timed', v_data.timed,
    'duration_ms', 20000,
    'birth_year', v_data.birth_year,
    'death_year', v_data.death_year,
    'birth_place', jsonb_build_object(
      'id', v_data.birth_place_id,
      'name', case when v_data.show_places_initially then v_data.birth_place_name else null end,
      'country', case when v_data.show_places_initially then v_data.birth_country else null end,
      'latitude', v_data.birth_latitude,
      'longitude', v_data.birth_longitude,
      'verification_status', v_data.birth_verification_status
    ),
    'death_place', jsonb_build_object(
      'id', v_data.death_place_id,
      'name', case when v_data.show_places_initially then v_data.death_place_name else null end,
      'country', case when v_data.show_places_initially then v_data.death_country else null end,
      'latitude', v_data.death_latitude,
      'longitude', v_data.death_longitude,
      'verification_status', v_data.death_verification_status
    )
  );
end;
$$;

create or replace function public.begin_life_map_round(
  p_session_id uuid,
  p_round_number integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_started_at timestamptz;
  v_expires_at timestamptz;
begin
  select expires_at into v_expires_at from public.game_sessions where id = p_session_id;
  if not found or v_expires_at < now() then
    raise exception 'Game session was not found or has expired.' using errcode = 'P0001';
  end if;

  update public.game_session_rounds
  set started_at = coalesce(started_at, now())
  where session_id = p_session_id
    and round_number = p_round_number
    and completed_at is null
  returning started_at into v_started_at;

  if v_started_at is null then
    raise exception 'Round was not found or was already completed.' using errcode = 'P0001';
  end if;

  return jsonb_build_object('started_at', v_started_at, 'duration_ms', 20000);
end;
$$;

create or replace function public.life_map_round_result_json(
  p_session_id uuid,
  p_round_number integer
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'correct', r.outcome = 'correct',
    'outcome', r.outcome,
    'points', r.points,
    'person_name', p.name,
    'birth_place_name', bp.name,
    'birth_country', bp.country,
    'death_place_name', dp.name,
    'death_country', dp.country
  )
  from public.game_session_rounds r
  join public.persons p on p.id = r.person_id
  join public.places bp on bp.id = p.birth_place_id
  join public.places dp on dp.id = p.death_place_id
  where r.session_id = p_session_id and r.round_number = p_round_number
    and r.completed_at is not null;
$$;

create or replace function public.submit_life_map_guess(
  p_session_id uuid,
  p_round_number integer,
  p_guess text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round record;
  v_elapsed_ms numeric;
  v_correct boolean := false;
  v_outcome text;
  v_points integer := 0;
begin
  select r.*, s.timed, s.expires_at, p.name
  into v_round
  from public.game_session_rounds r
  join public.game_sessions s on s.id = r.session_id
  join public.persons p on p.id = r.person_id
  where r.session_id = p_session_id and r.round_number = p_round_number
  for update of r;

  if not found or v_round.expires_at < now() then
    raise exception 'Game session or round was not found.' using errcode = 'P0001';
  end if;

  if v_round.completed_at is not null then
    return public.life_map_round_result_json(p_session_id, p_round_number);
  end if;

  if v_round.started_at is null then
    raise exception 'The round has not started.' using errcode = 'P0001';
  end if;

  v_elapsed_ms := extract(epoch from (clock_timestamp() - v_round.started_at)) * 1000;

  if v_round.timed and v_elapsed_ms >= 20000 then
    v_outcome := 'timeout';
  else
    v_correct := public.normalize_histoglyph_answer(p_guess) = public.normalize_histoglyph_answer(v_round.name)
      or exists (
        select 1 from public.accepted_answers aa
        where aa.person_id = v_round.person_id
          and public.normalize_histoglyph_answer(aa.answer) = public.normalize_histoglyph_answer(p_guess)
      );
    v_outcome := case when v_correct then 'correct' else 'incorrect' end;
    if v_correct and v_round.timed then
      v_points := greatest(0, least(1000, round(1000 * (1 - v_elapsed_ms / 20000.0))::integer));
    end if;
  end if;

  update public.game_session_rounds
  set completed_at = now(), outcome = v_outcome, points = v_points
  where id = v_round.id;

  return public.life_map_round_result_json(p_session_id, p_round_number);
end;
$$;

create or replace function public.reveal_life_map_answer(
  p_session_id uuid,
  p_round_number integer,
  p_reason text default 'revealed'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round_id uuid;
  v_outcome text := case when p_reason = 'timeout' then 'timeout' else 'revealed' end;
begin
  select r.id into v_round_id
  from public.game_session_rounds r
  join public.game_sessions s on s.id = r.session_id
  where r.session_id = p_session_id
    and r.round_number = p_round_number
    and s.expires_at >= now()
  for update of r;

  if not found then
    raise exception 'Game session or round was not found.' using errcode = 'P0001';
  end if;

  update public.game_session_rounds
  set completed_at = coalesce(completed_at, now()),
      outcome = coalesce(outcome, v_outcome),
      points = 0
  where id = v_round_id;

  return public.life_map_round_result_json(p_session_id, p_round_number);
end;
$$;

create or replace function public.get_life_map_summary(p_session_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'round_count', s.round_count,
    'timed', s.timed,
    'completed_rounds', count(r.completed_at),
    'correct_answers', count(*) filter (where r.outcome = 'correct'),
    'total_points', coalesce(sum(r.points), 0)
  )
  from public.game_sessions s
  join public.game_session_rounds r on r.session_id = s.id
  where s.id = p_session_id
  group by s.id;
$$;

-- Admin helper: save one person and replace its answers/tags atomically.
create or replace function public.admin_upsert_person(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_person_id uuid;
  v_birth_place_id uuid;
  v_death_place_id uuid;
  v_tag text;
  v_tag_id uuid;
  v_answer text;
begin
  if coalesce((select auth.role()), '') <> 'service_role' and not public.is_histoglyph_admin() then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;

  v_birth_place_id := nullif(p_payload->>'birth_place_id','')::uuid;
  v_death_place_id := nullif(p_payload->>'death_place_id','')::uuid;

  if v_birth_place_id is null and nullif(p_payload->>'birth_place_legacy_id','') is not null then
    select id into v_birth_place_id from public.places where legacy_id = p_payload->>'birth_place_legacy_id';
  end if;
  if v_death_place_id is null and nullif(p_payload->>'death_place_legacy_id','') is not null then
    select id into v_death_place_id from public.places where legacy_id = p_payload->>'death_place_legacy_id';
  end if;
  if v_birth_place_id is null or v_death_place_id is null then
    raise exception 'Birth and death places must exist before the person is imported.' using errcode = 'P0001';
  end if;

  if nullif(p_payload->>'id','') is not null then
    v_person_id := (p_payload->>'id')::uuid;
  elsif nullif(p_payload->>'legacy_id','') is not null then
    select id into v_person_id from public.persons where legacy_id = p_payload->>'legacy_id';
  end if;

  insert into public.persons(
    id, legacy_id, name, period, birth_year, death_year,
    birth_place_id, death_place_id, difficulty,
    verification_status, published
  ) values (
    coalesce(v_person_id, gen_random_uuid()),
    nullif(p_payload->>'legacy_id',''),
    p_payload->>'name',
    p_payload->>'period',
    (p_payload->>'birth_year')::integer,
    (p_payload->>'death_year')::integer,
    v_birth_place_id,
    v_death_place_id,
    coalesce((p_payload->>'difficulty')::integer, 1),
    coalesce(nullif(p_payload->>'verification_status',''), 'unverified'),
    coalesce((p_payload->>'published')::boolean, false)
  )
  on conflict (id) do update set
    legacy_id = excluded.legacy_id,
    name = excluded.name,
    period = excluded.period,
    birth_year = excluded.birth_year,
    death_year = excluded.death_year,
    birth_place_id = excluded.birth_place_id,
    death_place_id = excluded.death_place_id,
    difficulty = excluded.difficulty,
    verification_status = excluded.verification_status,
    published = excluded.published
  returning id into v_person_id;

  delete from public.accepted_answers where person_id = v_person_id;
  for v_answer in select jsonb_array_elements_text(coalesce(p_payload->'accepted_answers','[]'::jsonb)) loop
    if trim(v_answer) <> '' then
      insert into public.accepted_answers(person_id, answer)
      values (v_person_id, trim(v_answer)) on conflict do nothing;
    end if;
  end loop;

  delete from public.person_tags where person_id = v_person_id;
  for v_tag in select jsonb_array_elements_text(coalesce(p_payload->'tags','[]'::jsonb)) loop
    v_tag := lower(trim(regexp_replace(v_tag, '[^a-zA-Z0-9]+', '-', 'g')));
    v_tag := trim(both '-' from v_tag);
    if v_tag <> '' then
      insert into public.tags(slug, name)
      values (v_tag, initcap(replace(v_tag, '-', ' ')))
      on conflict (slug) do update set name = excluded.name
      returning id into v_tag_id;
      insert into public.person_tags(person_id, tag_id)
      values (v_person_id, v_tag_id) on conflict do nothing;
    end if;
  end loop;

  return v_person_id;
end;
$$;

create or replace function public.admin_import_places(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_count integer := 0;
begin
  if coalesce((select auth.role()), '') <> 'service_role' and not public.is_histoglyph_admin() then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;

  for v_row in select value from jsonb_array_elements(p_rows) loop
    insert into public.places(
      legacy_id, name, country, latitude, longitude, precision,
      verification_status, source, source_id, notes
    ) values (
      nullif(v_row->>'id',''),
      v_row->>'name',
      v_row->>'country',
      (v_row->>'latitude')::double precision,
      (v_row->>'longitude')::double precision,
      coalesce(nullif(v_row->>'precision',''), 'locality'),
      coalesce(nullif(v_row->>'verification_status',''), 'automatically_matched'),
      nullif(v_row->>'source',''),
      nullif(v_row->>'source_id',''),
      nullif(v_row->>'notes','')
    )
    on conflict (legacy_id) do update set
      name = excluded.name,
      country = excluded.country,
      latitude = excluded.latitude,
      longitude = excluded.longitude,
      precision = excluded.precision,
      verification_status = excluded.verification_status,
      source = excluded.source,
      source_id = excluded.source_id,
      notes = excluded.notes;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function public.admin_import_people(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_payload jsonb;
  v_count integer := 0;
begin
  if coalesce((select auth.role()), '') <> 'service_role' and not public.is_histoglyph_admin() then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;

  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_payload := jsonb_build_object(
      'legacy_id', nullif(v_row->>'id',''),
      'name', v_row->>'name',
      'period', v_row->>'period',
      'birth_year', v_row->>'birth_year',
      'death_year', v_row->>'death_year',
      'birth_place_legacy_id', v_row->>'birth_place_id',
      'death_place_legacy_id', v_row->>'death_place_id',
      'difficulty', coalesce(nullif(v_row->>'difficulty',''), '1'),
      'verification_status', coalesce(nullif(v_row->>'verification_status',''), 'automatically_matched'),
      'published', coalesce(nullif(v_row->>'published',''), 'false'),
      'accepted_answers', to_jsonb(string_to_array(coalesce(v_row->>'accepted_answers',''), '|')),
      'tags', to_jsonb(string_to_array(coalesce(v_row->>'tags',''), '|'))
    );
    perform public.admin_upsert_person(v_payload);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.life_map_round_result_json(uuid,integer) from public;
revoke all on function public.list_life_map_collections() from public;
revoke all on function public.start_life_map_game(text,integer,boolean,boolean) from public;
revoke all on function public.get_life_map_round(uuid,integer) from public;
revoke all on function public.begin_life_map_round(uuid,integer) from public;
revoke all on function public.submit_life_map_guess(uuid,integer,text) from public;
revoke all on function public.reveal_life_map_answer(uuid,integer,text) from public;
revoke all on function public.get_life_map_summary(uuid) from public;
revoke all on function public.admin_upsert_person(jsonb) from public;
revoke all on function public.admin_import_places(jsonb) from public;
revoke all on function public.admin_import_people(jsonb) from public;

grant execute on function public.list_life_map_collections() to anon, authenticated;
grant execute on function public.start_life_map_game(text,integer,boolean,boolean) to anon, authenticated;
grant execute on function public.get_life_map_round(uuid,integer) to anon, authenticated;
grant execute on function public.begin_life_map_round(uuid,integer) to anon, authenticated;
grant execute on function public.submit_life_map_guess(uuid,integer,text) to anon, authenticated;
grant execute on function public.reveal_life_map_answer(uuid,integer,text) to anon, authenticated;
grant execute on function public.get_life_map_summary(uuid) to anon, authenticated;
grant execute on function public.admin_upsert_person(jsonb) to authenticated, service_role;
grant execute on function public.admin_import_places(jsonb) to authenticated, service_role;
grant execute on function public.admin_import_people(jsonb) to authenticated, service_role;


-- Initial Histoglyph collections
insert into public.collections(
  slug, game_mode, group_name, title, description, status,
  default_rounds, sort_order, include_all_published
) values
  ('world-history','life-map','Global','World History',
   'A broad selection of historical figures from different periods and parts of the world.',
   'available',5,10,true),
  ('american-presidents','life-map','North America','American Presidents',
   'Presidents of the United States, identified through their life dates and locations.',
   'coming-soon',5,20,false),
  ('north-american-figures','life-map','North America','North American Figures',
   'Political leaders, artists, scientists and other figures connected to North America.',
   'coming-soon',5,30,false),
  ('latin-american-figures','life-map','South America','Latin American Figures',
   'Historical figures connected to Latin America and the Caribbean.',
   'coming-soon',5,40,false),
  ('european-monarchs','life-map','Europe','European Monarchs',
   'Kings, queens and emperors from across European history.',
   'coming-soon',5,50,false),
  ('renaissance','life-map','Europe','The Renaissance',
   'Artists, thinkers, rulers and innovators from the Renaissance.',
   'coming-soon',5,60,false),
  ('african-history','life-map','Africa','African History',
   'Leaders, thinkers and cultural figures from across the African continent.',
   'coming-soon',5,70,false),
  ('asian-rulers','life-map','Asia','Rulers of Asia',
   'Emperors, monarchs and political leaders from Asian history.',
   'coming-soon',5,80,false)
on conflict (slug) do update set
  group_name = excluded.group_name,
  title = excluded.title,
  description = excluded.description,
  default_rounds = excluded.default_rounds,
  sort_order = excluded.sort_order,
  include_all_published = excluded.include_all_published;

insert into public.tags(slug, name) values
  ('american-president','American President'),
  ('north-america','North America'),
  ('latin-america','Latin America'),
  ('european-monarch','European Monarch'),
  ('renaissance','Renaissance'),
  ('africa','Africa'),
  ('asian-ruler','Asian Ruler')
on conflict (slug) do nothing;

insert into public.collection_tags(collection_slug, tag_id)
select mapping.collection_slug, t.id
from (values
  ('american-presidents','american-president'),
  ('north-american-figures','north-america'),
  ('latin-american-figures','latin-america'),
  ('european-monarchs','european-monarch'),
  ('renaissance','renaissance'),
  ('african-history','africa'),
  ('asian-rulers','asian-ruler')
) as mapping(collection_slug, tag_slug)
join public.tags t on t.slug = mapping.tag_slug
on conflict do nothing;


-- Optional demo data from Histoglyph V16.
-- Run after 004_collections.sql.

insert into public.places(legacy_id,name,country,latitude,longitude,precision,verification_status,source,source_id,notes) values ('place-ajaccio-fr','Ajaccio','France',41.9192,8.7386,'locality','manually_verified','Seed data',null,null) on conflict (legacy_id) do update set name=excluded.name,country=excluded.country,latitude=excluded.latitude,longitude=excluded.longitude,precision=excluded.precision,verification_status=excluded.verification_status,source=excluded.source,source_id=excluded.source_id,notes=excluded.notes;
insert into public.places(legacy_id,name,country,latitude,longitude,precision,verification_status,source,source_id,notes) values ('place-longwood-sh','Longwood','Saint Helena',-15.9507,-5.6947,'locality','manually_verified','Seed data',null,null) on conflict (legacy_id) do update set name=excluded.name,country=excluded.country,latitude=excluded.latitude,longitude=excluded.longitude,precision=excluded.precision,verification_status=excluded.verification_status,source=excluded.source,source_id=excluded.source_id,notes=excluded.notes;
insert into public.places(legacy_id,name,country,latitude,longitude,precision,verification_status,source,source_id,notes) values ('place-ulm-de','Ulm','Germany',48.4011,9.9876,'locality','manually_verified','Seed data',null,null) on conflict (legacy_id) do update set name=excluded.name,country=excluded.country,latitude=excluded.latitude,longitude=excluded.longitude,precision=excluded.precision,verification_status=excluded.verification_status,source=excluded.source,source_id=excluded.source_id,notes=excluded.notes;
insert into public.places(legacy_id,name,country,latitude,longitude,precision,verification_status,source,source_id,notes) values ('place-princeton-us','Princeton','United States',40.3573,-74.6672,'locality','manually_verified','Seed data',null,null) on conflict (legacy_id) do update set name=excluded.name,country=excluded.country,latitude=excluded.latitude,longitude=excluded.longitude,precision=excluded.precision,verification_status=excluded.verification_status,source=excluded.source,source_id=excluded.source_id,notes=excluded.notes;
insert into public.places(legacy_id,name,country,latitude,longitude,precision,verification_status,source,source_id,notes) values ('place-vinci-it','Vinci','Italy',43.7874,10.926,'locality','manually_verified','Seed data',null,null) on conflict (legacy_id) do update set name=excluded.name,country=excluded.country,latitude=excluded.latitude,longitude=excluded.longitude,precision=excluded.precision,verification_status=excluded.verification_status,source=excluded.source,source_id=excluded.source_id,notes=excluded.notes;
insert into public.places(legacy_id,name,country,latitude,longitude,precision,verification_status,source,source_id,notes) values ('place-amboise-fr','Amboise','France',47.413,0.9827,'locality','manually_verified','Seed data',null,null) on conflict (legacy_id) do update set name=excluded.name,country=excluded.country,latitude=excluded.latitude,longitude=excluded.longitude,precision=excluded.precision,verification_status=excluded.verification_status,source=excluded.source,source_id=excluded.source_id,notes=excluded.notes;
insert into public.places(legacy_id,name,country,latitude,longitude,precision,verification_status,source,source_id,notes) values ('place-warsaw-pl','Warsaw','Poland',52.2297,21.0122,'locality','manually_verified','Seed data',null,null) on conflict (legacy_id) do update set name=excluded.name,country=excluded.country,latitude=excluded.latitude,longitude=excluded.longitude,precision=excluded.precision,verification_status=excluded.verification_status,source=excluded.source,source_id=excluded.source_id,notes=excluded.notes;
insert into public.places(legacy_id,name,country,latitude,longitude,precision,verification_status,source,source_id,notes) values ('place-passy-fr','Passy','France',45.9237,6.6877,'locality','manually_verified','Seed data',null,null) on conflict (legacy_id) do update set name=excluded.name,country=excluded.country,latitude=excluded.latitude,longitude=excluded.longitude,precision=excluded.precision,verification_status=excluded.verification_status,source=excluded.source,source_id=excluded.source_id,notes=excluded.notes;
insert into public.places(legacy_id,name,country,latitude,longitude,precision,verification_status,source,source_id,notes) values ('place-pella-gr','Pella, Macedon','Greece',40.7617,22.5266,'archaeological_site','manually_verified','Seed data',null,null) on conflict (legacy_id) do update set name=excluded.name,country=excluded.country,latitude=excluded.latitude,longitude=excluded.longitude,precision=excluded.precision,verification_status=excluded.verification_status,source=excluded.source,source_id=excluded.source_id,notes=excluded.notes;
insert into public.places(legacy_id,name,country,latitude,longitude,precision,verification_status,source,source_id,notes) values ('place-babylon-iq','Babylon','Iraq',32.5364,44.4209,'archaeological_site','manually_verified','Seed data',null,null) on conflict (legacy_id) do update set name=excluded.name,country=excluded.country,latitude=excluded.latitude,longitude=excluded.longitude,precision=excluded.precision,verification_status=excluded.verification_status,source=excluded.source,source_id=excluded.source_id,notes=excluded.notes;
insert into public.places(legacy_id,name,country,latitude,longitude,precision,verification_status,source,source_id,notes) values ('place-rosario-ar','Rosario','Argentina',-32.9442,-60.6505,'locality','manually_verified','Seed data',null,null) on conflict (legacy_id) do update set name=excluded.name,country=excluded.country,latitude=excluded.latitude,longitude=excluded.longitude,precision=excluded.precision,verification_status=excluded.verification_status,source=excluded.source,source_id=excluded.source_id,notes=excluded.notes;
insert into public.places(legacy_id,name,country,latitude,longitude,precision,verification_status,source,source_id,notes) values ('place-la-higuera-bo','La Higuera','Bolivia',-18.7918,-64.2026,'locality','manually_verified','Seed data',null,null) on conflict (legacy_id) do update set name=excluded.name,country=excluded.country,latitude=excluded.latitude,longitude=excluded.longitude,precision=excluded.precision,verification_status=excluded.verification_status,source=excluded.source,source_id=excluded.source_id,notes=excluded.notes;
insert into public.places(legacy_id,name,country,latitude,longitude,precision,verification_status,source,source_id,notes) values ('place-stockholm-se','Stockholm','Sweden',59.3293,18.0686,'locality','manually_verified','Seed data',null,null) on conflict (legacy_id) do update set name=excluded.name,country=excluded.country,latitude=excluded.latitude,longitude=excluded.longitude,precision=excluded.precision,verification_status=excluded.verification_status,source=excluded.source,source_id=excluded.source_id,notes=excluded.notes;
insert into public.places(legacy_id,name,country,latitude,longitude,precision,verification_status,source,source_id,notes) values ('place-lutzen-de','Lützen','Germany',51.2567,12.1417,'locality','manually_verified','Seed data',null,null) on conflict (legacy_id) do update set name=excluded.name,country=excluded.country,latitude=excluded.latitude,longitude=excluded.longitude,precision=excluded.precision,verification_status=excluded.verification_status,source=excluded.source,source_id=excluded.source_id,notes=excluded.notes;
insert into public.places(legacy_id,name,country,latitude,longitude,precision,verification_status,source,source_id,notes) values ('place-coyoacan-mx','Coyoacán','Mexico',19.3467,-99.1617,'locality','manually_verified','Seed data',null,null) on conflict (legacy_id) do update set name=excluded.name,country=excluded.country,latitude=excluded.latitude,longitude=excluded.longitude,precision=excluded.precision,verification_status=excluded.verification_status,source=excluded.source,source_id=excluded.source_id,notes=excluded.notes;
insert into public.persons(legacy_id,name,period,birth_year,death_year,birth_place_id,death_place_id,difficulty,verification_status,published) select 'person-napoleon-bonaparte','Napoleon Bonaparte','Revolutionary and Napoleonic Era',1769,1821,bp.id,dp.id,1,'manually_verified',true from public.places bp, public.places dp where bp.legacy_id='place-ajaccio-fr' and dp.legacy_id='place-longwood-sh' on conflict (legacy_id) do update set name=excluded.name,period=excluded.period,birth_year=excluded.birth_year,death_year=excluded.death_year,birth_place_id=excluded.birth_place_id,death_place_id=excluded.death_place_id,difficulty=excluded.difficulty,verification_status=excluded.verification_status,published=excluded.published;
insert into public.accepted_answers(person_id,answer) select id,'napoleon' from public.persons where legacy_id='person-napoleon-bonaparte' on conflict do nothing;
insert into public.accepted_answers(person_id,answer) select id,'napoleon bonaparte' from public.persons where legacy_id='person-napoleon-bonaparte' on conflict do nothing;
insert into public.accepted_answers(person_id,answer) select id,'bonaparte' from public.persons where legacy_id='person-napoleon-bonaparte' on conflict do nothing;
insert into public.persons(legacy_id,name,period,birth_year,death_year,birth_place_id,death_place_id,difficulty,verification_status,published) select 'person-albert-einstein','Albert Einstein','20th Century',1879,1955,bp.id,dp.id,1,'manually_verified',true from public.places bp, public.places dp where bp.legacy_id='place-ulm-de' and dp.legacy_id='place-princeton-us' on conflict (legacy_id) do update set name=excluded.name,period=excluded.period,birth_year=excluded.birth_year,death_year=excluded.death_year,birth_place_id=excluded.birth_place_id,death_place_id=excluded.death_place_id,difficulty=excluded.difficulty,verification_status=excluded.verification_status,published=excluded.published;
insert into public.accepted_answers(person_id,answer) select id,'albert einstein' from public.persons where legacy_id='person-albert-einstein' on conflict do nothing;
insert into public.accepted_answers(person_id,answer) select id,'einstein' from public.persons where legacy_id='person-albert-einstein' on conflict do nothing;
insert into public.persons(legacy_id,name,period,birth_year,death_year,birth_place_id,death_place_id,difficulty,verification_status,published) select 'person-leonardo-da-vinci','Leonardo da Vinci','Renaissance',1452,1519,bp.id,dp.id,1,'manually_verified',true from public.places bp, public.places dp where bp.legacy_id='place-vinci-it' and dp.legacy_id='place-amboise-fr' on conflict (legacy_id) do update set name=excluded.name,period=excluded.period,birth_year=excluded.birth_year,death_year=excluded.death_year,birth_place_id=excluded.birth_place_id,death_place_id=excluded.death_place_id,difficulty=excluded.difficulty,verification_status=excluded.verification_status,published=excluded.published;
insert into public.accepted_answers(person_id,answer) select id,'leonardo da vinci' from public.persons where legacy_id='person-leonardo-da-vinci' on conflict do nothing;
insert into public.accepted_answers(person_id,answer) select id,'leonardo' from public.persons where legacy_id='person-leonardo-da-vinci' on conflict do nothing;
insert into public.accepted_answers(person_id,answer) select id,'da vinci' from public.persons where legacy_id='person-leonardo-da-vinci' on conflict do nothing;
insert into public.persons(legacy_id,name,period,birth_year,death_year,birth_place_id,death_place_id,difficulty,verification_status,published) select 'person-marie-curie','Marie Curie','19th and 20th Centuries',1867,1934,bp.id,dp.id,1,'manually_verified',true from public.places bp, public.places dp where bp.legacy_id='place-warsaw-pl' and dp.legacy_id='place-passy-fr' on conflict (legacy_id) do update set name=excluded.name,period=excluded.period,birth_year=excluded.birth_year,death_year=excluded.death_year,birth_place_id=excluded.birth_place_id,death_place_id=excluded.death_place_id,difficulty=excluded.difficulty,verification_status=excluded.verification_status,published=excluded.published;
insert into public.accepted_answers(person_id,answer) select id,'marie curie' from public.persons where legacy_id='person-marie-curie' on conflict do nothing;
insert into public.accepted_answers(person_id,answer) select id,'curie' from public.persons where legacy_id='person-marie-curie' on conflict do nothing;
insert into public.accepted_answers(person_id,answer) select id,'maria sklodowska curie' from public.persons where legacy_id='person-marie-curie' on conflict do nothing;
insert into public.accepted_answers(person_id,answer) select id,'maria skłodowska curie' from public.persons where legacy_id='person-marie-curie' on conflict do nothing;
insert into public.persons(legacy_id,name,period,birth_year,death_year,birth_place_id,death_place_id,difficulty,verification_status,published) select 'person-alexander-the-great','Alexander the Great','Antiquity',-356,-323,bp.id,dp.id,1,'manually_verified',true from public.places bp, public.places dp where bp.legacy_id='place-pella-gr' and dp.legacy_id='place-babylon-iq' on conflict (legacy_id) do update set name=excluded.name,period=excluded.period,birth_year=excluded.birth_year,death_year=excluded.death_year,birth_place_id=excluded.birth_place_id,death_place_id=excluded.death_place_id,difficulty=excluded.difficulty,verification_status=excluded.verification_status,published=excluded.published;
insert into public.accepted_answers(person_id,answer) select id,'alexander the great' from public.persons where legacy_id='person-alexander-the-great' on conflict do nothing;
insert into public.accepted_answers(person_id,answer) select id,'alexander' from public.persons where legacy_id='person-alexander-the-great' on conflict do nothing;
insert into public.accepted_answers(person_id,answer) select id,'alexander iii' from public.persons where legacy_id='person-alexander-the-great' on conflict do nothing;
insert into public.accepted_answers(person_id,answer) select id,'alexander iii of macedon' from public.persons where legacy_id='person-alexander-the-great' on conflict do nothing;
insert into public.persons(legacy_id,name,period,birth_year,death_year,birth_place_id,death_place_id,difficulty,verification_status,published) select 'person-che-guevara','Che Guevara','20th Century',1928,1967,bp.id,dp.id,1,'manually_verified',true from public.places bp, public.places dp where bp.legacy_id='place-rosario-ar' and dp.legacy_id='place-la-higuera-bo' on conflict (legacy_id) do update set name=excluded.name,period=excluded.period,birth_year=excluded.birth_year,death_year=excluded.death_year,birth_place_id=excluded.birth_place_id,death_place_id=excluded.death_place_id,difficulty=excluded.difficulty,verification_status=excluded.verification_status,published=excluded.published;
insert into public.accepted_answers(person_id,answer) select id,'che guevara' from public.persons where legacy_id='person-che-guevara' on conflict do nothing;
insert into public.accepted_answers(person_id,answer) select id,'guevara' from public.persons where legacy_id='person-che-guevara' on conflict do nothing;
insert into public.accepted_answers(person_id,answer) select id,'ernesto che guevara' from public.persons where legacy_id='person-che-guevara' on conflict do nothing;
insert into public.persons(legacy_id,name,period,birth_year,death_year,birth_place_id,death_place_id,difficulty,verification_status,published) select 'person-gustavus-adolphus','Gustavus Adolphus','Early Modern Period',1594,1632,bp.id,dp.id,1,'manually_verified',true from public.places bp, public.places dp where bp.legacy_id='place-stockholm-se' and dp.legacy_id='place-lutzen-de' on conflict (legacy_id) do update set name=excluded.name,period=excluded.period,birth_year=excluded.birth_year,death_year=excluded.death_year,birth_place_id=excluded.birth_place_id,death_place_id=excluded.death_place_id,difficulty=excluded.difficulty,verification_status=excluded.verification_status,published=excluded.published;
insert into public.accepted_answers(person_id,answer) select id,'gustavus adolphus' from public.persons where legacy_id='person-gustavus-adolphus' on conflict do nothing;
insert into public.accepted_answers(person_id,answer) select id,'gustav ii adolf' from public.persons where legacy_id='person-gustavus-adolphus' on conflict do nothing;
insert into public.accepted_answers(person_id,answer) select id,'gustav 2 adolf' from public.persons where legacy_id='person-gustavus-adolphus' on conflict do nothing;
insert into public.accepted_answers(person_id,answer) select id,'gustav adolf' from public.persons where legacy_id='person-gustavus-adolphus' on conflict do nothing;
insert into public.persons(legacy_id,name,period,birth_year,death_year,birth_place_id,death_place_id,difficulty,verification_status,published) select 'person-frida-kahlo','Frida Kahlo','20th Century',1907,1954,bp.id,dp.id,1,'manually_verified',true from public.places bp, public.places dp where bp.legacy_id='place-coyoacan-mx' and dp.legacy_id='place-coyoacan-mx' on conflict (legacy_id) do update set name=excluded.name,period=excluded.period,birth_year=excluded.birth_year,death_year=excluded.death_year,birth_place_id=excluded.birth_place_id,death_place_id=excluded.death_place_id,difficulty=excluded.difficulty,verification_status=excluded.verification_status,published=excluded.published;
insert into public.accepted_answers(person_id,answer) select id,'frida kahlo' from public.persons where legacy_id='person-frida-kahlo' on conflict do nothing;
insert into public.accepted_answers(person_id,answer) select id,'kahlo' from public.persons where legacy_id='person-frida-kahlo' on conflict do nothing;
