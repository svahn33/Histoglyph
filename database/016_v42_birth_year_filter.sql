-- Histoglyph V42
-- Birth-year range filter for every Life & Death Map collection.
-- Run once in Supabase SQL Editor before publishing the V42 frontend.

alter table public.game_sessions
  add column if not exists birth_year_min integer,
  add column if not exists birth_year_max integer;

alter table public.game_sessions
  drop constraint if exists game_sessions_birth_year_range_check;

alter table public.game_sessions
  add constraint game_sessions_birth_year_range_check
  check (
    birth_year_min is null
    or birth_year_max is null
    or birth_year_min <= birth_year_max
  );

-- Returns only aggregate bounds for the selected collection. It does not expose
-- person names or other answer data before a round begins.
create or replace function public.get_life_map_birth_year_bounds(
  p_collection_slug text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_collection public.collections%rowtype;
  v_min_year integer;
  v_max_year integer;
  v_count integer;
begin
  select * into v_collection
  from public.collections
  where slug = p_collection_slug
    and game_mode = 'life-map'
    and status = 'available';

  if not found then
    raise exception 'Collection is not available.' using errcode = 'P0001';
  end if;

  select
    min(p.birth_year),
    max(p.birth_year),
    count(*)::integer
  into v_min_year, v_max_year, v_count
  from public.persons p
  where p.published
    and p.birth_year is not null
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

  if v_count = 0 or v_min_year is null or v_max_year is null then
    raise exception 'This collection has no published people with usable birth years.' using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'min_birth_year', v_min_year,
    'max_birth_year', v_max_year,
    'available_people', v_count
  );
end;
$$;

create or replace function public.start_life_map_game(
  p_collection_slug text,
  p_round_count integer,
  p_timed boolean,
  p_show_places boolean,
  p_difficulty integer,
  p_birth_year_min integer,
  p_birth_year_max integer
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
  v_difficulty integer := p_difficulty;
  v_birth_year_min integer := p_birth_year_min;
  v_birth_year_max integer := p_birth_year_max;
begin
  if v_difficulty is not null and (v_difficulty < 1 or v_difficulty > 5) then
    raise exception 'Difficulty must be between 1 and 5.' using errcode = 'P0001';
  end if;

  if v_birth_year_min is not null
     and v_birth_year_max is not null
     and v_birth_year_min > v_birth_year_max then
    raise exception 'The earliest birth year cannot be later than the latest birth year.' using errcode = 'P0001';
  end if;

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
    and p.birth_year is not null
    and (v_difficulty is null or p.difficulty = v_difficulty)
    and (v_birth_year_min is null or p.birth_year >= v_birth_year_min)
    and (v_birth_year_max is null or p.birth_year <= v_birth_year_max)
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
    raise exception 'No published people match the selected difficulty and birth-year range.' using errcode = 'P0001';
  end if;

  insert into public.game_sessions(
    collection_slug,
    timed,
    show_places_initially,
    difficulty_filter,
    birth_year_min,
    birth_year_max,
    round_count
  )
  values (
    v_collection.slug,
    coalesce(p_timed, true),
    coalesce(p_show_places, false),
    v_difficulty,
    v_birth_year_min,
    v_birth_year_max,
    v_round_count
  )
  returning id into v_session_id;

  with eligible as (
    select p.id
    from public.persons p
    where p.published
      and p.birth_year is not null
      and (v_difficulty is null or p.difficulty = v_difficulty)
      and (v_birth_year_min is null or p.birth_year >= v_birth_year_min)
      and (v_birth_year_max is null or p.birth_year <= v_birth_year_max)
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
    'difficulty_filter', v_difficulty,
    'birth_year_min', v_birth_year_min,
    'birth_year_max', v_birth_year_max,
    'eligible_people', v_eligible_count,
    'collection_slug', v_collection.slug,
    'collection_title', v_collection.title,
    'collection_description', v_collection.description
  );
end;
$$;

-- Keep V18-V41 frontends working during a staged deployment.
create or replace function public.start_life_map_game(
  p_collection_slug text,
  p_round_count integer,
  p_timed boolean,
  p_show_places boolean,
  p_difficulty integer
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.start_life_map_game(
    p_collection_slug,
    p_round_count,
    p_timed,
    p_show_places,
    p_difficulty,
    null,
    null
  );
$$;

create or replace function public.start_life_map_game(
  p_collection_slug text,
  p_round_count integer,
  p_timed boolean,
  p_show_places boolean
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.start_life_map_game(
    p_collection_slug,
    p_round_count,
    p_timed,
    p_show_places,
    null,
    null,
    null
  );
$$;

revoke all on function public.get_life_map_birth_year_bounds(text) from public;
grant execute on function public.get_life_map_birth_year_bounds(text) to anon, authenticated;

revoke all on function public.start_life_map_game(text,integer,boolean,boolean,integer,integer,integer) from public;
grant execute on function public.start_life_map_game(text,integer,boolean,boolean,integer,integer,integer)
  to anon, authenticated;
