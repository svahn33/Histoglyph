-- Histoglyph V22
-- Short first-name + surname answers and repeated guesses until correct/timeout/skip.
-- Admin difficulty/verification filters are frontend-only and need no schema change.

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
  v_guess_first text;
  v_guess_last text;
  v_candidate_first text;
  v_candidate_last text;
begin
  if v_guess = '' or v_candidate = '' then
    return false;
  end if;

  if v_guess = v_candidate then
    return true;
  end if;

  v_guess_parts := string_to_array(v_guess, ' ');
  v_candidate_parts := string_to_array(v_candidate, ' ');

  if cardinality(v_guess_parts) < 2 or cardinality(v_candidate_parts) < 2 then
    return false;
  end if;

  while cardinality(v_candidate_parts) > 2
    and v_candidate_parts[cardinality(v_candidate_parts)] = any (array['jr','sr','ii','iii','iv','v'])
  loop
    v_candidate_parts := v_candidate_parts[1:cardinality(v_candidate_parts)-1];
  end loop;

  v_guess_first := v_guess_parts[1];
  v_guess_last := v_guess_parts[cardinality(v_guess_parts)];
  v_candidate_first := v_candidate_parts[1];
  v_candidate_last := v_candidate_parts[cardinality(v_candidate_parts)];

  return char_length(v_guess_first) >= 3
    and char_length(v_guess_last) >= 3
    and left(v_candidate_first, char_length(v_guess_first)) = v_guess_first
    and left(v_candidate_last, char_length(v_guess_last)) = v_guess_last;
end;
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

revoke all on function public.histoglyph_answer_matches(text,text) from public;
revoke all on function public.submit_life_map_guess(uuid,integer,text) from public;
grant execute on function public.submit_life_map_guess(uuid,integer,text) to anon, authenticated;
