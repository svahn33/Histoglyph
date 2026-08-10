-- V26: separate occupations and historical period tags from generic tags.

alter table public.persons
  add column if not exists occupations text[] not null default '{}'::text[],
  add column if not exists historical_periods text[] not null default '{}'::text[];

create index if not exists persons_occupations_idx on public.persons using gin (occupations);
create index if not exists persons_historical_periods_idx on public.persons using gin (historical_periods);

update public.persons
set historical_periods = array[trim(both '-' from lower(regexp_replace(period, '[^a-zA-Z0-9]+', '-', 'g')))]
where coalesce(array_length(historical_periods, 1), 0) = 0
  and nullif(trim(period), '') is not null;

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
