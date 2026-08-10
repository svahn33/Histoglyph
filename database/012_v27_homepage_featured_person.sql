-- V27: expose only the small, safe subset needed for the homepage example card.
-- The person must be published. Accepted answers and other private game data are not returned.

create or replace function public.get_homepage_featured_person(p_name text default 'Albert Einstein')
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'name', p.name,
    'birth_year', p.birth_year,
    'death_year', p.death_year,
    'birth_place_name', bp.name,
    'birth_latitude', bp.latitude,
    'birth_longitude', bp.longitude,
    'death_place_name', dp.name,
    'death_latitude', dp.latitude,
    'death_longitude', dp.longitude,
    'image_path', p.image_path,
    'image_credit', p.image_credit,
    'image_license', p.image_license
  )
  from public.persons p
  join public.places bp on bp.id = p.birth_place_id
  join public.places dp on dp.id = p.death_place_id
  where p.published = true
    and lower(p.name) = lower(trim(p_name))
  order by p.updated_at desc
  limit 1;
$$;

revoke all on function public.get_homepage_featured_person(text) from public;
grant execute on function public.get_homepage_featured_person(text) to anon, authenticated;
