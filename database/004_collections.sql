-- Initial Histoglyph collections
insert into public.collections(
  slug, game_mode, group_name, title, description, status,
  default_rounds, sort_order, include_all_published
) values
  ('world-history','life-map','Global','World History',
   'A broad selection of historical figures from different periods and parts of the world.',
   'available',5,10,true),
  ('american-presidents','life-map','North America','American Presidents',
   'Presidents of the United States, identified through their life dates and locations.',
   'coming-soon',5,20,false),
  ('north-american-figures','life-map','North America','North American Figures',
   'Political leaders, artists, scientists and other figures connected to North America.',
   'coming-soon',5,30,false),
  ('latin-american-figures','life-map','South America','Latin American Figures',
   'Historical figures connected to Latin America and the Caribbean.',
   'coming-soon',5,40,false),
  ('european-monarchs','life-map','Europe','European Monarchs',
   'Kings, queens and emperors from across European history.',
   'coming-soon',5,50,false),
  ('renaissance','life-map','Europe','The Renaissance',
   'Artists, thinkers, rulers and innovators from the Renaissance.',
   'coming-soon',5,60,false),
  ('african-history','life-map','Africa','African History',
   'Leaders, thinkers and cultural figures from across the African continent.',
   'coming-soon',5,70,false),
  ('asian-rulers','life-map','Asia','Rulers of Asia',
   'Emperors, monarchs and political leaders from Asian history.',
   'coming-soon',5,80,false)
on conflict (slug) do update set
  group_name = excluded.group_name,
  title = excluded.title,
  description = excluded.description,
  default_rounds = excluded.default_rounds,
  sort_order = excluded.sort_order,
  include_all_published = excluded.include_all_published;

insert into public.tags(slug, name) values
  ('american-president','American President'),
  ('north-america','North America'),
  ('latin-america','Latin America'),
  ('european-monarch','European Monarch'),
  ('renaissance','Renaissance'),
  ('africa','Africa'),
  ('asian-ruler','Asian Ruler')
on conflict (slug) do nothing;

insert into public.collection_tags(collection_slug, tag_id)
select mapping.collection_slug, t.id
from (values
  ('american-presidents','american-president'),
  ('north-american-figures','north-america'),
  ('latin-american-figures','latin-america'),
  ('european-monarchs','european-monarch'),
  ('renaissance','renaissance'),
  ('african-history','africa'),
  ('asian-rulers','asian-ruler')
) as mapping(collection_slug, tag_slug)
join public.tags t on t.slug = mapping.tag_slug
on conflict do nothing;
