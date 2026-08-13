-- Histoglyph V37
-- Make the American Presidents Life & Death Map collection playable.
-- Safe guard: do not enable it unless at least one published person carries
-- the american-president tag.

do $$
declare
  v_people integer;
begin
  -- Ensure the collection tag mapping exists.
  insert into public.tags(slug, name)
  values ('american-president', 'American President')
  on conflict (slug) do update set name = excluded.name;

  insert into public.collection_tags(collection_slug, tag_id)
  select 'american-presidents', t.id
  from public.tags t
  where t.slug = 'american-president'
    and exists (
      select 1 from public.collections c
      where c.slug = 'american-presidents'
    )
  on conflict do nothing;

  select count(distinct p.id)
    into v_people
  from public.persons p
  join public.person_tags pt on pt.person_id = p.id
  join public.tags t on t.id = pt.tag_id
  where p.published = true
    and t.slug = 'american-president';

  if v_people = 0 then
    raise exception 'American Presidents was not enabled: no published persons with tag american-president were found.';
  end if;

  update public.collections
  set status = 'available',
      default_rounds = 10,
      updated_at = now()
  where slug = 'american-presidents'
    and game_mode = 'life-map';

  if not found then
    raise exception 'American Presidents collection was not found.';
  end if;

  raise notice 'American Presidents is now available with % published tagged people.', v_people;
end;
$$;
