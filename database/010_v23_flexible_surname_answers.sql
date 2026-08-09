-- Histoglyph V23
-- More flexible answer matching.
--
-- Accepted examples:
--   Adolf Hitler       -> Hitler, Ado Hit, Adolf Hitler
--   Leonardo da Vinci  -> Vinci, da Vinci, Leo Vin, Leonardo da Vinci
--   Vincent van Gogh   -> Gogh, van Gogh, Vin Gog
--   Martin Luther King Jr. -> King, King Jr, Mar Kin
--
-- Existing accepted_answers are still checked by submit_life_map_guess.

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

revoke all on function public.histoglyph_answer_matches(text,text) from public;
-- The matcher is called internally by the security-definer game RPC.
