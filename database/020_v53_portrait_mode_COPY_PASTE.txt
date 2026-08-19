-- Histoglyph V53 — Portrait game mode
-- Reuses existing persons, places, collections, accepted answers and portrait Storage data.
-- Default play exposes only image_path. Optional clue categories can be enabled at
-- game start or revealed individually during a round.

create table if not exists public.portrait_sessions (
  id uuid primary key default gen_random_uuid(),
  collection_slug text not null references public.collections(slug),
  difficulty_filter integer check (difficulty_filter between 1 and 5),
  birth_year_min integer,
  birth_year_max integer,
  round_count integer not null check (round_count >= 1),
  initial_years boolean not null default false,
  initial_occupation boolean not null default false,
  initial_places boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  constraint portrait_sessions_birth_year_range_check check (
    birth_year_min is null or birth_year_max is null or birth_year_min <= birth_year_max
  )
);

create table if not exists public.portrait_session_rounds (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.portrait_sessions(id) on delete cascade,
  round_number integer not null check (round_number >= 1),
  person_id uuid not null references public.persons(id),
  completed_at timestamptz,
  outcome text check (outcome in ('correct','revealed')),
  attempts integer not null default 0 check (attempts >= 0),
  hints_used text[] not null default '{}'::text[],
  unique (session_id, round_number),
  unique (session_id, person_id)
);

create index if not exists portrait_session_rounds_session_idx
  on public.portrait_session_rounds(session_id, round_number);

alter table public.portrait_sessions enable row level security;
alter table public.portrait_session_rounds enable row level security;
revoke all on table public.portrait_sessions from anon, authenticated;
revoke all on table public.portrait_session_rounds from anon, authenticated;

create or replace function public.list_portrait_collections()
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
          and p.birth_year is not null
          and nullif(trim(coalesce(p.image_path, '')), '') is not null
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
    and c.status in ('available', 'coming-soon')
  order by c.sort_order, c.group_name, c.title;
$$;

create or replace function public.get_portrait_birth_year_bounds(p_collection_slug text)
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

  select min(p.birth_year), max(p.birth_year), count(*)::integer
  into v_min_year, v_max_year, v_count
  from public.persons p
  where p.published
    and p.birth_year is not null
    and nullif(trim(coalesce(p.image_path, '')), '') is not null
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
    raise exception 'This collection has no published people with portraits.' using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'min_birth_year', v_min_year,
    'max_birth_year', v_max_year,
    'available_people', v_count
  );
end;
$$;

create or replace function public.start_portrait_game(
  p_collection_slug text,
  p_round_count integer,
  p_difficulty integer,
  p_birth_year_min integer,
  p_birth_year_max integer,
  p_include_all boolean,
  p_initial_years boolean,
  p_initial_occupation boolean,
  p_initial_places boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_collection public.collections%rowtype;
  v_requested_count integer := greatest(1, least(100, coalesce(p_round_count, 10)));
  v_round_count integer;
  v_eligible_count integer;
  v_difficulty integer := p_difficulty;
  v_birth_year_min integer := p_birth_year_min;
  v_birth_year_max integer := p_birth_year_max;
  v_include_all boolean := coalesce(p_include_all, false);
begin
  if v_difficulty is not null and (v_difficulty < 1 or v_difficulty > 5) then
    raise exception 'Difficulty must be between 1 and 5.' using errcode = 'P0001';
  end if;

  if v_birth_year_min is not null and v_birth_year_max is not null
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
    and nullif(trim(coalesce(p.image_path, '')), '') is not null
    and (v_difficulty is null or p.difficulty = v_difficulty)
    and (v_birth_year_min is null or p.birth_year >= v_birth_year_min)
    and (v_birth_year_max is null or p.birth_year <= v_birth_year_max)
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
    raise exception 'No published people with portraits match the selected filters.' using errcode = 'P0001';
  end if;

  v_round_count := case
    when v_include_all then v_eligible_count
    else least(v_requested_count, v_eligible_count)
  end;

  insert into public.portrait_sessions(
    collection_slug, difficulty_filter, birth_year_min, birth_year_max, round_count,
    initial_years, initial_occupation, initial_places
  ) values (
    v_collection.slug, v_difficulty, v_birth_year_min, v_birth_year_max, v_round_count,
    coalesce(p_initial_years, false), coalesce(p_initial_occupation, false), coalesce(p_initial_places, false)
  ) returning id into v_session_id;

  with eligible as (
    select p.id
    from public.persons p
    where p.published
      and p.birth_year is not null
      and nullif(trim(coalesce(p.image_path, '')), '') is not null
      and (v_difficulty is null or p.difficulty = v_difficulty)
      and (v_birth_year_min is null or p.birth_year >= v_birth_year_min)
      and (v_birth_year_max is null or p.birth_year <= v_birth_year_max)
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
  ), chosen as (
    select id from eligible order by random() limit v_round_count
  ), numbered as (
    select id, row_number() over (order by random())::integer as round_number
    from chosen
  )
  insert into public.portrait_session_rounds(session_id, round_number, person_id)
  select v_session_id, round_number, id from numbered;

  return jsonb_build_object(
    'session_id', v_session_id,
    'collection_slug', v_collection.slug,
    'collection_title', v_collection.title,
    'round_count', v_round_count,
    'eligible_people', v_eligible_count,
    'difficulty_filter', v_difficulty,
    'birth_year_min', v_birth_year_min,
    'birth_year_max', v_birth_year_max,
    'include_all', v_include_all,
    'initial_years', coalesce(p_initial_years, false),
    'initial_occupation', coalesce(p_initial_occupation, false),
    'initial_places', coalesce(p_initial_places, false)
  );
end;
$$;

create or replace function public.get_portrait_round(p_session_id uuid, p_round_number integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_round record;
begin
  select
    s.round_count, s.initial_years, s.initial_occupation, s.initial_places, s.expires_at,
    r.round_number, r.completed_at, r.hints_used,
    p.image_path, p.birth_year, p.death_year, p.occupations,
    bp.name as birth_place_name, bp.country as birth_country,
    dp.name as death_place_name, dp.country as death_country
  into v_round
  from public.portrait_session_rounds r
  join public.portrait_sessions s on s.id = r.session_id
  join public.persons p on p.id = r.person_id
  join public.places bp on bp.id = p.birth_place_id
  join public.places dp on dp.id = p.death_place_id
  where r.session_id = p_session_id and r.round_number = p_round_number;

  if not found or v_round.expires_at < now() then
    raise exception 'Portrait session or round was not found.' using errcode = 'P0001';
  end if;
  if v_round.completed_at is not null then
    raise exception 'The round is already complete.' using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'round_number', v_round.round_number,
    'round_count', v_round.round_count,
    'image_path', v_round.image_path,
    'initial_clues', jsonb_build_object(
      'years', case when v_round.initial_years then jsonb_build_object('birth_year', v_round.birth_year, 'death_year', v_round.death_year) else null end,
      'occupation', case when v_round.initial_occupation then to_jsonb(coalesce(v_round.occupations, '{}'::text[])) else null end,
      'places', case when v_round.initial_places then jsonb_build_object(
        'birth_place_name', v_round.birth_place_name, 'birth_country', v_round.birth_country,
        'death_place_name', v_round.death_place_name, 'death_country', v_round.death_country
      ) else null end
    ),
    'revealed_hints', to_jsonb(coalesce(v_round.hints_used, '{}'::text[]))
  );
end;
$$;

create or replace function public.get_portrait_hint(
  p_session_id uuid,
  p_round_number integer,
  p_hint_type text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round record;
  v_hint_type text := lower(trim(coalesce(p_hint_type, '')));
  v_already_visible boolean := false;
  v_available boolean := true;
  v_payload jsonb;
begin
  if v_hint_type not in ('years','occupation','places') then
    raise exception 'Unknown hint type.' using errcode = 'P0001';
  end if;

  select
    r.id, r.completed_at, r.hints_used, s.expires_at,
    s.initial_years, s.initial_occupation, s.initial_places,
    p.birth_year, p.death_year, coalesce(p.occupations, '{}'::text[]) as occupations,
    bp.name as birth_place_name, bp.country as birth_country,
    dp.name as death_place_name, dp.country as death_country
  into v_round
  from public.portrait_session_rounds r
  join public.portrait_sessions s on s.id = r.session_id
  join public.persons p on p.id = r.person_id
  join public.places bp on bp.id = p.birth_place_id
  join public.places dp on dp.id = p.death_place_id
  where r.session_id = p_session_id and r.round_number = p_round_number
  for update of r;

  if not found or v_round.expires_at < now() then
    raise exception 'Portrait session or round was not found.' using errcode = 'P0001';
  end if;
  if v_round.completed_at is not null then
    raise exception 'The round is already complete.' using errcode = 'P0001';
  end if;

  v_already_visible := case v_hint_type
    when 'years' then v_round.initial_years or v_hint_type = any(v_round.hints_used)
    when 'occupation' then v_round.initial_occupation or v_hint_type = any(v_round.hints_used)
    when 'places' then v_round.initial_places or v_hint_type = any(v_round.hints_used)
  end;

  if v_hint_type = 'occupation' and cardinality(v_round.occupations) = 0 then
    v_available := false;
  end if;

  if v_available and not v_already_visible then
    update public.portrait_session_rounds
    set hints_used = array_append(hints_used, v_hint_type)
    where id = v_round.id;
  end if;

  v_payload := case v_hint_type
    when 'years' then jsonb_build_object('birth_year', v_round.birth_year, 'death_year', v_round.death_year)
    when 'occupation' then to_jsonb(v_round.occupations)
    when 'places' then jsonb_build_object(
      'birth_place_name', v_round.birth_place_name, 'birth_country', v_round.birth_country,
      'death_place_name', v_round.death_place_name, 'death_country', v_round.death_country
    )
  end;

  return jsonb_build_object(
    'available', v_available,
    'counted', v_available and not v_already_visible,
    'hint_type', v_hint_type,
    'clue', case when v_available then v_payload else null end
  );
end;
$$;

create or replace function public.submit_portrait_guess(
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
  v_correct boolean := false;
  v_attempts integer;
begin
  if trim(coalesce(p_guess, '')) = '' then
    raise exception 'Enter a guess first.' using errcode = 'P0001';
  end if;

  select
    r.id, r.completed_at, s.expires_at,
    p.id as person_id, p.name, p.birth_year, p.death_year, p.occupations,
    p.image_path, p.image_credit, p.image_source_url, p.image_license,
    bp.name as birth_place_name, bp.country as birth_country,
    dp.name as death_place_name, dp.country as death_country
  into v_round
  from public.portrait_session_rounds r
  join public.portrait_sessions s on s.id = r.session_id
  join public.persons p on p.id = r.person_id
  join public.places bp on bp.id = p.birth_place_id
  join public.places dp on dp.id = p.death_place_id
  where r.session_id = p_session_id and r.round_number = p_round_number
  for update of r;

  if not found or v_round.expires_at < now() then
    raise exception 'Portrait session or round was not found.' using errcode = 'P0001';
  end if;
  if v_round.completed_at is not null then
    raise exception 'The round is already complete.' using errcode = 'P0001';
  end if;

  v_correct := public.histoglyph_answer_matches(p_guess, v_round.name)
    or exists (
      select 1 from public.accepted_answers aa
      where aa.person_id = v_round.person_id
        and public.histoglyph_answer_matches(p_guess, aa.answer)
    );

  update public.portrait_session_rounds
  set attempts = attempts + 1,
      completed_at = case when v_correct then now() else completed_at end,
      outcome = case when v_correct then 'correct' else outcome end
  where id = v_round.id
  returning attempts into v_attempts;

  if not v_correct then
    return jsonb_build_object('correct', false, 'attempts', v_attempts);
  end if;

  return jsonb_build_object(
    'correct', true,
    'outcome', 'correct',
    'attempts', v_attempts,
    'person_name', v_round.name,
    'birth_year', v_round.birth_year,
    'death_year', v_round.death_year,
    'occupations', to_jsonb(coalesce(v_round.occupations, '{}'::text[])),
    'birth_place_name', v_round.birth_place_name,
    'birth_country', v_round.birth_country,
    'death_place_name', v_round.death_place_name,
    'death_country', v_round.death_country,
    'image_path', v_round.image_path,
    'image_credit', v_round.image_credit,
    'image_source_url', v_round.image_source_url,
    'image_license', v_round.image_license
  );
end;
$$;

create or replace function public.reveal_portrait_answer(
  p_session_id uuid,
  p_round_number integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round record;
begin
  select
    r.id, r.completed_at, s.expires_at,
    p.name, p.birth_year, p.death_year, p.occupations,
    p.image_path, p.image_credit, p.image_source_url, p.image_license,
    bp.name as birth_place_name, bp.country as birth_country,
    dp.name as death_place_name, dp.country as death_country
  into v_round
  from public.portrait_session_rounds r
  join public.portrait_sessions s on s.id = r.session_id
  join public.persons p on p.id = r.person_id
  join public.places bp on bp.id = p.birth_place_id
  join public.places dp on dp.id = p.death_place_id
  where r.session_id = p_session_id and r.round_number = p_round_number
  for update of r;

  if not found or v_round.expires_at < now() then
    raise exception 'Portrait session or round was not found.' using errcode = 'P0001';
  end if;
  if v_round.completed_at is not null then
    raise exception 'The round is already complete.' using errcode = 'P0001';
  end if;

  update public.portrait_session_rounds
  set completed_at = now(), outcome = 'revealed'
  where id = v_round.id;

  return jsonb_build_object(
    'correct', false,
    'outcome', 'revealed',
    'person_name', v_round.name,
    'birth_year', v_round.birth_year,
    'death_year', v_round.death_year,
    'occupations', to_jsonb(coalesce(v_round.occupations, '{}'::text[])),
    'birth_place_name', v_round.birth_place_name,
    'birth_country', v_round.birth_country,
    'death_place_name', v_round.death_place_name,
    'death_country', v_round.death_country,
    'image_path', v_round.image_path,
    'image_credit', v_round.image_credit,
    'image_source_url', v_round.image_source_url,
    'image_license', v_round.image_license
  );
end;
$$;

create or replace function public.get_portrait_summary(p_session_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'round_count', s.round_count,
    'completed_rounds', count(*) filter (where r.completed_at is not null),
    'correct_answers', count(*) filter (where r.outcome = 'correct'),
    'revealed_answers', count(*) filter (where r.outcome = 'revealed'),
    'total_attempts', coalesce(sum(r.attempts), 0),
    'hints_used', coalesce(sum(cardinality(r.hints_used)), 0),
    'accuracy', case when s.round_count = 0 then 0 else round(100.0 * count(*) filter (where r.outcome = 'correct') / s.round_count)::integer end
  )
  from public.portrait_sessions s
  join public.portrait_session_rounds r on r.session_id = s.id
  where s.id = p_session_id
  group by s.id;
$$;

revoke all on function public.list_portrait_collections() from public;
revoke all on function public.get_portrait_birth_year_bounds(text) from public;
revoke all on function public.start_portrait_game(text,integer,integer,integer,integer,boolean,boolean,boolean,boolean) from public;
revoke all on function public.get_portrait_round(uuid,integer) from public;
revoke all on function public.get_portrait_hint(uuid,integer,text) from public;
revoke all on function public.submit_portrait_guess(uuid,integer,text) from public;
revoke all on function public.reveal_portrait_answer(uuid,integer) from public;
revoke all on function public.get_portrait_summary(uuid) from public;

grant execute on function public.list_portrait_collections() to anon, authenticated;
grant execute on function public.get_portrait_birth_year_bounds(text) to anon, authenticated;
grant execute on function public.start_portrait_game(text,integer,integer,integer,integer,boolean,boolean,boolean,boolean) to anon, authenticated;
grant execute on function public.get_portrait_round(uuid,integer) to anon, authenticated;
grant execute on function public.get_portrait_hint(uuid,integer,text) to anon, authenticated;
grant execute on function public.submit_portrait_guess(uuid,integer,text) to anon, authenticated;
grant execute on function public.reveal_portrait_answer(uuid,integer) to anon, authenticated;
grant execute on function public.get_portrait_summary(uuid) to anon, authenticated;
