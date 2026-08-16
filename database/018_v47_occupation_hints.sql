-- V47: occupation hint support and persistent hint counting.

alter table public.game_session_rounds
  add column if not exists hint_used boolean not null default false;

create or replace function public.get_life_map_hint(
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
  v_counted boolean := false;
  v_occupations text[] := '{}'::text[];
begin
  select r.id, r.started_at, r.completed_at, r.hint_used, s.expires_at,
         coalesce(p.occupations, '{}'::text[]) as occupations
  into v_round
  from public.game_session_rounds r
  join public.game_sessions s on s.id = r.session_id
  join public.persons p on p.id = r.person_id
  where r.session_id = p_session_id
    and r.round_number = p_round_number
  for update of r;

  if not found or v_round.expires_at < now() then
    raise exception 'Game session or round was not found.' using errcode = 'P0001';
  end if;

  if v_round.started_at is null then
    raise exception 'The round has not started.' using errcode = 'P0001';
  end if;

  if v_round.completed_at is not null then
    raise exception 'The round is already complete.' using errcode = 'P0001';
  end if;

  v_occupations := v_round.occupations;

  if coalesce(cardinality(v_occupations), 0) = 0 then
    return jsonb_build_object(
      'available', false,
      'counted', false,
      'occupations', '[]'::jsonb
    );
  end if;

  if not v_round.hint_used then
    update public.game_session_rounds
    set hint_used = true
    where id = v_round.id;
    v_counted := true;
  end if;

  return jsonb_build_object(
    'available', true,
    'counted', v_counted,
    'occupations', to_jsonb(v_occupations)
  );
end;
$$;

revoke all on function public.get_life_map_hint(uuid,integer) from public;
grant execute on function public.get_life_map_hint(uuid,integer) to anon, authenticated;

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
    'total_points', coalesce(sum(r.points), 0),
    'hints_used', count(*) filter (where r.hint_used)
  )
  from public.game_sessions s
  join public.game_session_rounds r on r.session_id = s.id
  where s.id = p_session_id
  group by s.id;
$$;

revoke all on function public.get_life_map_summary(uuid) from public;
grant execute on function public.get_life_map_summary(uuid) to anon, authenticated;
