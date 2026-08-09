-- Histoglyph V21 migration: person portraits with Supabase Storage
-- Run this once in Supabase SQL Editor.
-- Before using portrait uploads, create a PUBLIC Storage bucket named: person-images

alter table public.persons
  add column if not exists image_path text,
  add column if not exists image_credit text,
  add column if not exists image_source_url text,
  add column if not exists image_license text;

-- Portrait metadata is only returned after the round has been completed.
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

-- Admin helper: save a person and atomically replace answers/tags.
-- Image fields are preserved when an older caller omits them from the JSON payload.
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
    verification_status, published,
    image_path, image_credit, image_source_url, image_license
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

-- Storage API operations remain protected even though the bucket itself is public.
-- The bucket is public only so completed-round portraits can be served efficiently.
drop policy if exists "Histoglyph admins can inspect portrait objects" on storage.objects;
drop policy if exists "Histoglyph admins can upload portraits" on storage.objects;
drop policy if exists "Histoglyph admins can update portraits" on storage.objects;
drop policy if exists "Histoglyph admins can delete portraits" on storage.objects;

create policy "Histoglyph admins can inspect portrait objects"
on storage.objects for select to authenticated
using (bucket_id = 'person-images' and public.is_histoglyph_admin());

create policy "Histoglyph admins can upload portraits"
on storage.objects for insert to authenticated
with check (bucket_id = 'person-images' and public.is_histoglyph_admin());

create policy "Histoglyph admins can update portraits"
on storage.objects for update to authenticated
using (bucket_id = 'person-images' and public.is_histoglyph_admin())
with check (bucket_id = 'person-images' and public.is_histoglyph_admin());

create policy "Histoglyph admins can delete portraits"
on storage.objects for delete to authenticated
using (bucket_id = 'person-images' and public.is_histoglyph_admin());

revoke all on function public.life_map_round_result_json(uuid,integer) from public;
revoke all on function public.admin_upsert_person(jsonb) from public;
revoke all on function public.admin_import_people(jsonb) from public;

grant execute on function public.admin_upsert_person(jsonb) to authenticated, service_role;
grant execute on function public.admin_import_people(jsonb) to authenticated, service_role;
