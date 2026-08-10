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

-- Flexible answers: full name, complete surname, particle surname (e.g. "da Vinci"),
-- or the three-letter first-name + surname shorthand from V22.
create or replace function public.histoglyph_answer_matches(p_guess text, p_candidate text)
returns boolean
language plpgsql
stable
set search_path = public, extensions
as $$
declare
  v_guess text := public.normalize_histoglyph_answer(p_guess);
  v_candidate text := public.normalize_histoglyph_answer(p_candidate);
  v_guess_parts text[];
  v_candidate_parts text[];
  v_guess_core text[];
  v_candidate_core text[];
  v_guess_suffix text[] := array[]::text[];
  v_candidate_suffix text[] := array[]::text[];
  v_guess_core_text text;
  v_candidate_core_text text;
  v_candidate_surname text;
  v_guess_first text;
  v_guess_last text;
  v_candidate_first text;
  v_candidate_last text;
  v_surname_start integer;
  v_count integer;
  v_suffixes constant text[] := array['jr','sr','ii','iii','iv','v'];
  v_particles constant text[] := array[
    'da','de','del','della','di','do','dos','du',
    'la','le','van','von','der','den','ten','ter',
    'al','el','bin','ibn','st','saint'
  ];
begin
  if v_guess = '' or v_candidate = '' then
    return false;
  end if;

  -- The full normalized name is always accepted.
  if v_guess = v_candidate then
    return true;
  end if;

  v_guess_parts := string_to_array(v_guess, ' ');
  v_candidate_parts := string_to_array(v_candidate, ' ');
  v_guess_core := v_guess_parts;
  v_candidate_core := v_candidate_parts;

  -- Separate common generational suffixes. A supplied suffix must be correct,
  -- but the player is not required to type the suffix.
  while cardinality(v_candidate_core) > 1
    and v_candidate_core[cardinality(v_candidate_core)] = any (v_suffixes)
  loop
    v_candidate_suffix := array_prepend(
      v_candidate_core[cardinality(v_candidate_core)],
      v_candidate_suffix
    );
    v_candidate_core := v_candidate_core[1:cardinality(v_candidate_core)-1];
  end loop;

  while cardinality(v_guess_core) > 1
    and v_guess_core[cardinality(v_guess_core)] = any (v_suffixes)
  loop
    v_guess_suffix := array_prepend(
      v_guess_core[cardinality(v_guess_core)],
      v_guess_suffix
    );
    v_guess_core := v_guess_core[1:cardinality(v_guess_core)-1];
  end loop;

  if cardinality(v_guess_suffix) > 0
    and array_to_string(v_guess_suffix, ' ') <> array_to_string(v_candidate_suffix, ' ')
  then
    return false;
  end if;

  v_guess_core_text := array_to_string(v_guess_core, ' ');
  v_candidate_core_text := array_to_string(v_candidate_core, ' ');

  -- Also accept the full name without a generational suffix.
  if v_guess_core_text = v_candidate_core_text then
    return true;
  end if;

  v_count := cardinality(v_candidate_core);
  if v_count = 0 then
    return false;
  end if;

  -- A one-part historical name can be answered with that one name.
  if v_count = 1 then
    return v_guess_core_text = v_candidate_core[1];
  end if;

  v_candidate_first := v_candidate_core[1];
  v_candidate_last := v_candidate_core[v_count];

  -- The complete final surname token is enough: "Hitler", "Churchill",
  -- "Roosevelt", etc. We intentionally require the complete surname here;
  -- a three-letter surname prefix on its own would be too permissive.
  if cardinality(v_guess_core) = 1 and v_guess_core[1] = v_candidate_last then
    return true;
  end if;

  -- Include common surname particles so forms such as "da Vinci", "van Gogh",
  -- "de Gaulle" and "von Bismarck" are accepted as surname-only answers.
  v_surname_start := v_count;
  while v_surname_start > 1
    and v_candidate_core[v_surname_start - 1] = any (v_particles)
  loop
    v_surname_start := v_surname_start - 1;
  end loop;
  v_candidate_surname := array_to_string(v_candidate_core[v_surname_start:v_count], ' ');

  if v_guess_core_text = v_candidate_surname then
    return true;
  end if;

  -- Keep the V22 shorthand: at least three letters from the first name and
  -- at least three from the surname, e.g. "Ado Hit" for "Adolf Hitler".
  if cardinality(v_guess_core) >= 2 then
    v_guess_first := v_guess_core[1];
    v_guess_last := v_guess_core[cardinality(v_guess_core)];

    if char_length(v_guess_first) >= 3
      and char_length(v_guess_last) >= 3
      and left(v_candidate_first, char_length(v_guess_first)) = v_guess_first
      and left(v_candidate_last, char_length(v_guess_last)) = v_guess_last
    then
      return true;
    end if;
  end if;

  return false;
end;
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
  p_show_places boolean,
  p_difficulty integer
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
begin
  if v_difficulty is not null and (v_difficulty < 1 or v_difficulty > 5) then
    raise exception 'Difficulty must be between 1 and 5.' using errcode = 'P0001';
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
    and (v_difficulty is null or p.difficulty = v_difficulty)
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
    raise exception 'This collection has no published people for the selected difficulty.' using errcode = 'P0001';
  end if;

  insert into public.game_sessions(
    collection_slug, timed, show_places_initially, difficulty_filter, round_count
  )
  values (
    v_collection.slug,
    coalesce(p_timed, true),
    coalesce(p_show_places, false),
    v_difficulty,
    v_round_count
  )
  returning id into v_session_id;

  with eligible as (
    select p.id
    from public.persons p
    where p.published
      and (v_difficulty is null or p.difficulty = v_difficulty)
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
    'collection_slug', v_collection.slug,
    'collection_title', v_collection.title,
    'collection_description', v_collection.description
  );
end;
$$;

-- Backward-compatible wrapper for older deployed frontends.
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
    null
  );
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
    'death_country', dp.country,
    'image_path', p.image_path,
    'image_credit', p.image_credit,
    'image_source_url', p.image_source_url,
    'image_license', p.image_license
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
    update public.game_session_rounds
    set completed_at = now(), outcome = 'timeout', points = 0
    where id = v_round.id;
    return public.life_map_round_result_json(p_session_id, p_round_number);
  end if;

  v_correct := public.histoglyph_answer_matches(p_guess, v_round.name)
    or exists (
      select 1 from public.accepted_answers aa
      where aa.person_id = v_round.person_id
        and public.histoglyph_answer_matches(p_guess, aa.answer)
    );

  if not v_correct then
    -- Do not complete the round and do not reveal any answer data.
    return jsonb_build_object(
      'correct', false,
      'outcome', 'try_again',
      'round_complete', false
    );
  end if;

  if v_round.timed then
    v_points := greatest(0, least(1000, round(1000 * (1 - v_elapsed_ms / 20000.0))::integer));
  end if;

  update public.game_session_rounds
  set completed_at = now(), outcome = 'correct', points = v_points
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
    id, legacy_id, name, period, occupations, historical_periods, birth_year, death_year,
    birth_place_id, death_place_id, difficulty,
    verification_status, published,
    image_path, image_credit, image_source_url, image_license
  ) values (
    coalesce(v_person_id, gen_random_uuid()),
    nullif(p_payload->>'legacy_id',''),
    p_payload->>'name',
    p_payload->>'period',
    coalesce(array(
      select distinct trim(both '-' from lower(regexp_replace(trim(value), '[^a-zA-Z0-9]+', '-', 'g')))
      from jsonb_array_elements_text(coalesce(p_payload->'occupations','[]'::jsonb)) as value
      where trim(value) <> ''
    ), '{}'::text[]),
    coalesce(array(
      select distinct trim(both '-' from lower(regexp_replace(trim(value), '[^a-zA-Z0-9]+', '-', 'g')))
      from jsonb_array_elements_text(coalesce(p_payload->'historical_periods','[]'::jsonb)) as value
      where trim(value) <> ''
    ), '{}'::text[]),
    (p_payload->>'birth_year')::integer,
    (p_payload->>'death_year')::integer,
    v_birth_place_id,
    v_death_place_id,
    coalesce((p_payload->>'difficulty')::integer, 1),
    coalesce(nullif(p_payload->>'verification_status',''), 'unverified'),
    coalesce((p_payload->>'published')::boolean, false),
    nullif(p_payload->>'image_path',''),
    nullif(p_payload->>'image_credit',''),
    nullif(p_payload->>'image_source_url',''),
    nullif(p_payload->>'image_license','')
  )
  on conflict (id) do update set
    legacy_id = excluded.legacy_id,
    name = excluded.name,
    period = excluded.period,
    occupations = excluded.occupations,
    historical_periods = excluded.historical_periods,
    birth_year = excluded.birth_year,
    death_year = excluded.death_year,
    birth_place_id = excluded.birth_place_id,
    death_place_id = excluded.death_place_id,
    difficulty = excluded.difficulty,
    verification_status = excluded.verification_status,
    published = excluded.published,
    image_path = case when p_payload ? 'image_path' then excluded.image_path else persons.image_path end,
    image_credit = case when p_payload ? 'image_credit' then excluded.image_credit else persons.image_credit end,
    image_source_url = case when p_payload ? 'image_source_url' then excluded.image_source_url else persons.image_source_url end,
    image_license = case when p_payload ? 'image_license' then excluded.image_license else persons.image_license end
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
      'occupations', to_jsonb(string_to_array(coalesce(v_row->>'occupations',''), '|')),
      'historical_periods', to_jsonb(string_to_array(coalesce(v_row->>'historical_periods',''), '|')),
      'birth_year', v_row->>'birth_year',
      'death_year', v_row->>'death_year',
      'birth_place_legacy_id', v_row->>'birth_place_id',
      'death_place_legacy_id', v_row->>'death_place_id',
      'difficulty', coalesce(nullif(v_row->>'difficulty',''), '1'),
      'verification_status', coalesce(nullif(v_row->>'verification_status',''), 'automatically_matched'),
      'published', coalesce(nullif(v_row->>'published',''), 'false'),
      'accepted_answers', to_jsonb(string_to_array(coalesce(v_row->>'accepted_answers',''), '|')),
      'tags', to_jsonb(string_to_array(coalesce(v_row->>'tags',''), '|')),
      'image_path', nullif(v_row->>'image_path',''),
      'image_credit', nullif(v_row->>'image_credit',''),
      'image_source_url', nullif(v_row->>'image_source_url',''),
      'image_license', nullif(v_row->>'image_license','')
    );
    perform public.admin_upsert_person(v_payload);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.histoglyph_answer_matches(text,text) from public;
revoke all on function public.life_map_round_result_json(uuid,integer) from public;
revoke all on function public.list_life_map_collections() from public;
revoke all on function public.start_life_map_game(text,integer,boolean,boolean) from public;
revoke all on function public.start_life_map_game(text,integer,boolean,boolean,integer) from public;
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
grant execute on function public.start_life_map_game(text,integer,boolean,boolean,integer) to anon, authenticated;
grant execute on function public.get_life_map_round(uuid,integer) to anon, authenticated;
grant execute on function public.begin_life_map_round(uuid,integer) to anon, authenticated;
grant execute on function public.submit_life_map_guess(uuid,integer,text) to anon, authenticated;
grant execute on function public.reveal_life_map_answer(uuid,integer,text) to anon, authenticated;
grant execute on function public.get_life_map_summary(uuid) to anon, authenticated;
grant execute on function public.admin_upsert_person(jsonb) to authenticated, service_role;
grant execute on function public.admin_import_places(jsonb) to authenticated, service_role;
grant execute on function public.admin_import_people(jsonb) to authenticated, service_role;
