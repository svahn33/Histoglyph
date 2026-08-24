-- Histoglyph V60: make the World War II collection playable
-- Run once in Supabase SQL Editor. Safe to run more than once.

insert into public.collections(
  slug, game_mode, group_name, title, description, status,
  default_rounds, sort_order, include_all_published
) values (
  'world-war-two',
  'life-map',
  'Global',
  'World War II',
  'Political leaders, commanders, resistance figures, scientists and others connected to the Second World War.',
  'available',
  10,
  25,
  false
)
on conflict (slug) do update set
  game_mode = excluded.game_mode,
  group_name = excluded.group_name,
  title = excluded.title,
  description = excluded.description,
  status = 'available',
  default_rounds = excluded.default_rounds,
  sort_order = excluded.sort_order,
  include_all_published = false;

insert into public.tags(slug, name)
values ('world-war-two', 'World War II')
on conflict (slug) do update set name = excluded.name;

insert into public.collection_tags(collection_slug, tag_id)
select 'world-war-two', id
from public.tags
where slug = 'world-war-two'
on conflict do nothing;

-- Safety check: the collection should only be useful if imported people actually carry the tag.
do $$
declare
  v_count integer;
begin
  select count(distinct p.id) into v_count
  from public.persons p
  join public.person_tags pt on pt.person_id = p.id
  join public.tags t on t.id = pt.tag_id
  where p.published = true
    and t.slug = 'world-war-two';

  if v_count = 0 then
    raise warning 'World War II collection is available, but no published people with tag world-war-two were found.';
  else
    raise notice 'World War II collection enabled with % published tagged people.', v_count;
  end if;
end $$;
