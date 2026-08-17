-- Histoglyph V50 — Timeline game mode (first playable version)
-- Reuses the existing Histoglyph collections and person/place data from Life & Death Map.
-- Timeline cards expose portrait/name/birth place before placement, while birth year is
-- only revealed for people already placed on the timeline.

create table if not exists public.timeline_sessions (
  id uuid primary key default gen_random_uuid(),
  collection_slug text not null references public.collections(slug),
  difficulty_filter integer check (difficulty_filter between 1 and 5),
  birth_year_min integer,
  birth_year_max integer,
  people_count integer not null check (people_count >= 2),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  constraint timeline_sessions_birth_year_range_check check (
    birth_year_min is null or birth_year_max is null or birth_year_min <= birth_year_max
  )
);

create table if not exists public.timeline_session_people (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.timeline_sessions(id) on delete cascade,
  sequence_number integer not null check (sequence_number >= 1),
  person_id uuid not null references public.persons(id),
  placed_at timestamptz,
  attempts integer not null default 0 check (attempts >= 0),
  unique (session_id, sequence_number),
  unique (session_id, person_id)
);

create index if not exists timeline_session_people_session_idx
  on public.timeline_session_people(session_id, sequence_number);

alter table public.timeline_sessions enable row level security;
alter table public.timeline_session_people enable row level security;
revoke all on table public.timeline_sessions from anon, authenticated;
revoke all on table public.timeline_session_people from anon, authenticated;

-- Timeline deliberately reuses the same collection records as Life & Death Map.
-- This means World History / American Presidents etc. remain a single editorial
-- collection rather than duplicating the same membership for every game mode.
create or replace function public.list_timeline_collections()
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
    greatest(2, c.default_rounds) as default_rounds,
    case
      when c.status <> 'available' then 0::bigint
      else (
        select count(distinct p.id)
        from public.persons p
        where p.published
          and p.birth_year is not null
          and exists (select 1 from public.places bp where bp.id = p.birth_place_id)
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

create or replace function public.get_timeline_birth_year_bounds(p_collection_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.get_life_map_birth_year_bounds(p_collection_slug);
$$;

create or replace function public.start_timeline_game(
  p_collection_slug text,
  p_people_count integer,
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
  v_collection public.collections%rowtype;
  v_requested_count integer := greatest(2, least(100, coalesce(p_people_count, 10)));
  v_people_count integer;
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

  if v_eligible_count < 2 then
    raise exception 'At least two published people must match the selected filters.' using errcode = 'P0001';
  end if;

  v_people_count := case
    when v_include_all then v_eligible_count
    else least(v_requested_count, v_eligible_count)
  end;

  insert into public.timeline_sessions(
    collection_slug, difficulty_filter, birth_year_min, birth_year_max, people_count
  ) values (
    v_collection.slug, v_difficulty, v_birth_year_min, v_birth_year_max, v_people_count
  ) returning id into v_session_id;

  with eligible as (
    select p.id
    from public.persons p
    where p.published
      and p.birth_year is not null
      and (v_difficulty is null or p.difficulty = v_difficulty)
      and (v_birth_year_min is null or p.birth_year >= v_birth_year_min)
      and (v_birth_year_max is null or p.birth_year <= v_birth_year_max)
      and exists (select 1 from public.places bp where bp.id = p.birth_place_id)
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
  chosen as (
    select id from eligible order by random() limit v_people_count
  ),
  numbered as (
    select id, row_number() over (order by random())::integer as sequence_number
    from chosen
  )
  insert into public.timeline_session_people(session_id, sequence_number, person_id)
  select v_session_id, sequence_number, id
  from numbered;

  update public.timeline_session_people
  set placed_at = now()
  where session_id = v_session_id and sequence_number = 1;

  return jsonb_build_object(
    'session_id', v_session_id,
    'collection_slug', v_collection.slug,
    'collection_title', v_collection.title,
    'people_count', v_people_count,
    'placement_rounds', v_people_count - 1,
    'eligible_people', v_eligible_count,
    'difficulty_filter', v_difficulty,
    'birth_year_min', v_birth_year_min,
    'birth_year_max', v_birth_year_max,
    'include_all', v_include_all
  );
end;
$$;

create or replace function public.get_timeline_state(p_session_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_session record;
  v_current record;
  v_completed boolean := false;
  v_timeline jsonb := '[]'::jsonb;
begin
  select s.*, c.title as collection_title
  into v_session
  from public.timeline_sessions s
  join public.collections c on c.slug = s.collection_slug
  where s.id = p_session_id;

  if not found then
    raise exception 'Timeline session was not found or has expired.' using errcode = 'P0001';
  end if;
  if v_session.expires_at < now() then
    raise exception 'Timeline session was not found or has expired.' using errcode = 'P0001';
  end if;

  select
    tsp.sequence_number,
    tsp.attempts,
    p.id as person_id,
    p.name,
    p.image_path,
    p.image_credit,
    p.image_source_url,
    p.image_license,
    bp.name as birth_place_name,
    bp.country as birth_country
  into v_current
  from public.timeline_session_people tsp
  join public.persons p on p.id = tsp.person_id
  join public.places bp on bp.id = p.birth_place_id
  where tsp.session_id = p_session_id
    and tsp.sequence_number >= 2
    and tsp.placed_at is null
  order by tsp.sequence_number
  limit 1;

  v_completed := not found;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'person_id', p.id,
        'name', p.name,
        'birth_year', p.birth_year,
        'image_path', p.image_path
      )
      order by p.birth_year, p.name, p.id
    ),
    '[]'::jsonb
  )
  into v_timeline
  from public.timeline_session_people tsp
  join public.persons p on p.id = tsp.person_id
  where tsp.session_id = p_session_id
    and tsp.placed_at is not null;

  return jsonb_build_object(
    'session_id', v_session.id,
    'collection_slug', v_session.collection_slug,
    'collection_title', v_session.collection_title,
    'people_count', v_session.people_count,
    'placement_rounds', v_session.people_count - 1,
    'completed', v_completed,
    'current_round', case when v_completed then v_session.people_count - 1 else v_current.sequence_number - 1 end,
    'timeline', v_timeline,
    'current_card', case
      when v_completed then null
      else jsonb_build_object(
        'person_id', v_current.person_id,
        'name', v_current.name,
        'birth_place', jsonb_build_object(
          'name', v_current.birth_place_name,
          'country', v_current.birth_country
        ),
        'image_path', v_current.image_path,
        'image_credit', v_current.image_credit,
        'image_source_url', v_current.image_source_url,
        'image_license', v_current.image_license,
        'attempts', v_current.attempts
      )
    end
  );
end;
$$;

create or replace function public.submit_timeline_placement(
  p_session_id uuid,
  p_position_index integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session record;
  v_current record;
  v_placed_count integer;
  v_prev_year integer;
  v_next_year integer;
  v_correct boolean;
  v_attempts integer;
  v_complete boolean;
begin
  select * into v_session
  from public.timeline_sessions
  where id = p_session_id;

  if not found then
    raise exception 'Timeline session was not found or has expired.' using errcode = 'P0001';
  end if;
  if v_session.expires_at < now() then
    raise exception 'Timeline session was not found or has expired.' using errcode = 'P0001';
  end if;

  select tsp.id, tsp.sequence_number, tsp.attempts, p.id as person_id, p.name, p.birth_year
  into v_current
  from public.timeline_session_people tsp
  join public.persons p on p.id = tsp.person_id
  where tsp.session_id = p_session_id
    and tsp.sequence_number >= 2
    and tsp.placed_at is null
  order by tsp.sequence_number
  limit 1
  for update of tsp;

  if not found then
    raise exception 'The timeline is already complete.' using errcode = 'P0001';
  end if;

  select count(*)::integer into v_placed_count
  from public.timeline_session_people
  where session_id = p_session_id and placed_at is not null;

  if p_position_index is null or p_position_index < 0 or p_position_index > v_placed_count then
    raise exception 'Placement position is outside the timeline.' using errcode = 'P0001';
  end if;

  if p_position_index > 0 then
    select x.birth_year into v_prev_year
    from (
      select p.birth_year
      from public.timeline_session_people tsp
      join public.persons p on p.id = tsp.person_id
      where tsp.session_id = p_session_id and tsp.placed_at is not null
      order by p.birth_year, p.name, p.id
      offset (p_position_index - 1) limit 1
    ) x;
  end if;

  if p_position_index < v_placed_count then
    select x.birth_year into v_next_year
    from (
      select p.birth_year
      from public.timeline_session_people tsp
      join public.persons p on p.id = tsp.person_id
      where tsp.session_id = p_session_id and tsp.placed_at is not null
      order by p.birth_year, p.name, p.id
      offset p_position_index limit 1
    ) x;
  end if;

  v_correct := (v_prev_year is null or v_current.birth_year >= v_prev_year)
               and (v_next_year is null or v_current.birth_year <= v_next_year);

  update public.timeline_session_people
  set attempts = attempts + 1,
      placed_at = case when v_correct then now() else placed_at end
  where id = v_current.id
  returning attempts into v_attempts;

  select not exists (
    select 1 from public.timeline_session_people
    where session_id = p_session_id and sequence_number >= 2 and placed_at is null
  ) into v_complete;

  return jsonb_build_object(
    'correct', v_correct,
    'attempts', v_attempts,
    'person_name', v_current.name,
    'birth_year', case when v_correct then v_current.birth_year else null end,
    'game_complete', v_complete
  );
end;
$$;

create or replace function public.get_timeline_summary(p_session_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'people_count', s.people_count,
    'placement_rounds', greatest(0, s.people_count - 1),
    'completed_placements', count(*) filter (where tsp.sequence_number >= 2 and tsp.placed_at is not null),
    'first_try_placements', count(*) filter (where tsp.sequence_number >= 2 and tsp.placed_at is not null and tsp.attempts = 1),
    'mistakes', coalesce(sum(greatest(tsp.attempts - 1, 0)) filter (where tsp.sequence_number >= 2), 0),
    'total_attempts', coalesce(sum(tsp.attempts) filter (where tsp.sequence_number >= 2), 0),
    'first_try_accuracy', case
      when s.people_count <= 1 then 0
      else round(
        100.0 * count(*) filter (where tsp.sequence_number >= 2 and tsp.placed_at is not null and tsp.attempts = 1)
        / (s.people_count - 1)
      )::integer
    end
  )
  from public.timeline_sessions s
  join public.timeline_session_people tsp on tsp.session_id = s.id
  where s.id = p_session_id
  group by s.id;
$$;

revoke all on function public.list_timeline_collections() from public;
revoke all on function public.get_timeline_birth_year_bounds(text) from public;
revoke all on function public.start_timeline_game(text,integer,integer,integer,integer,boolean) from public;
revoke all on function public.get_timeline_state(uuid) from public;
revoke all on function public.submit_timeline_placement(uuid,integer) from public;
revoke all on function public.get_timeline_summary(uuid) from public;

grant execute on function public.list_timeline_collections() to anon, authenticated;
grant execute on function public.get_timeline_birth_year_bounds(text) to anon, authenticated;
grant execute on function public.start_timeline_game(text,integer,integer,integer,integer,boolean) to anon, authenticated;
grant execute on function public.get_timeline_state(uuid) to anon, authenticated;
grant execute on function public.submit_timeline_placement(uuid,integer) to anon, authenticated;
grant execute on function public.get_timeline_summary(uuid) to anon, authenticated;
