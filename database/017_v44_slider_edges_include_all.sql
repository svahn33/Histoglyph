-- Histoglyph V44
-- 1) Let the dual birth-year slider reach the true visual endpoints (frontend).
-- 2) Add "Include all" support for round count. Manual round counts remain capped
--    at 100; include-all is derived server-side from the eligible collection size.

-- Include-all games can legitimately contain more than 100 people. The public
-- RPC still caps manually supplied round counts at 100, so callers cannot use
-- p_round_count to bypass the normal limit.
alter table public.game_sessions
  drop constraint if exists game_sessions_round_count_check;

alter table public.game_sessions
  add constraint game_sessions_round_count_check
  check (round_count >= 1);

create or replace function public.start_life_map_game(
  p_collection_slug text,
  p_round_count integer,
  p_timed boolean,
  p_show_places boolean,
  p_difficulty integer,
  p_birth_year_min integer,
  p_birth_year_max integer,
  p_include_all boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_requested_round_count integer := greatest(1, least(100, coalesce(p_round_count, 5)));
  v_round_count integer;
  v_collection public.collections%rowtype;
  v_eligible_count integer;
  v_difficulty integer := p_difficulty;
  v_birth_year_min integer := p_birth_year_min;
  v_birth_year_max integer := p_birth_year_max;
  v_include_all boolean := coalesce(p_include_all, false);
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

  select count(*)::integer into v_eligible_count
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

  v_round_count := case
    when v_include_all then v_eligible_count
    else v_requested_round_count
  end;

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
    'include_all', v_include_all,
    'eligible_people', v_eligible_count,
    'collection_slug', v_collection.slug,
    'collection_title', v_collection.title,
    'collection_description', v_collection.description
  );
end;
$$;

-- Keep V42/V43 clients working while V44 is deployed.
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
    p_birth_year_min,
    p_birth_year_max,
    false
  );
$$;

revoke all on function public.start_life_map_game(text,integer,boolean,boolean,integer,integer,integer,boolean) from public;
grant execute on function public.start_life_map_game(text,integer,boolean,boolean,integer,integer,integer,boolean)
  to anon, authenticated;
