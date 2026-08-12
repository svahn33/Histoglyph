-- V35: reveal occupation tags in the completed-round result only.

alter table public.persons
  add column if not exists occupations text[] not null default '{}'::text[];

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
    'occupations', to_jsonb(coalesce(p.occupations, '{}'::text[])),
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

revoke all on function public.life_map_round_result_json(uuid,integer) from public;
-- This helper is called by the existing SECURITY DEFINER game RPCs; it does
-- not need to be directly exposed to anonymous clients.
