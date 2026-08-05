-- Histoglyph security and Row Level Security
-- Run after 001_schema.sql.

create or replace function public.is_histoglyph_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users au
    where au.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_histoglyph_admin() from public;
grant execute on function public.is_histoglyph_admin() to authenticated;

alter table public.admin_users enable row level security;
alter table public.places enable row level security;
alter table public.persons enable row level security;
alter table public.accepted_answers enable row level security;
alter table public.tags enable row level security;
alter table public.person_tags enable row level security;
alter table public.collections enable row level security;
alter table public.collection_tags enable row level security;
alter table public.collection_persons enable row level security;
alter table public.game_sessions enable row level security;
alter table public.game_session_rounds enable row level security;

-- Remove old policies when rerunning this file.
do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'admin_users','places','persons','accepted_answers','tags','person_tags',
        'collections','collection_tags','collection_persons','game_sessions','game_session_rounds'
      )
  loop
    execute format('drop policy if exists %I on %I.%I', policy_record.policyname, policy_record.schemaname, policy_record.tablename);
  end loop;
end $$;

create policy "Admins can read their admin record"
on public.admin_users for select to authenticated
using (user_id = (select auth.uid()));

create policy "Public can read available collection metadata"
on public.collections for select to anon, authenticated
using (status in ('available','coming-soon'));

create policy "Admins manage places"
on public.places for all to authenticated
using ((select public.is_histoglyph_admin()))
with check ((select public.is_histoglyph_admin()));

create policy "Admins manage persons"
on public.persons for all to authenticated
using ((select public.is_histoglyph_admin()))
with check ((select public.is_histoglyph_admin()));

create policy "Admins manage accepted answers"
on public.accepted_answers for all to authenticated
using ((select public.is_histoglyph_admin()))
with check ((select public.is_histoglyph_admin()));

create policy "Admins manage tags"
on public.tags for all to authenticated
using ((select public.is_histoglyph_admin()))
with check ((select public.is_histoglyph_admin()));

create policy "Admins manage person tags"
on public.person_tags for all to authenticated
using ((select public.is_histoglyph_admin()))
with check ((select public.is_histoglyph_admin()));

create policy "Admins manage collections"
on public.collections for all to authenticated
using ((select public.is_histoglyph_admin()))
with check ((select public.is_histoglyph_admin()));

create policy "Admins manage collection tags"
on public.collection_tags for all to authenticated
using ((select public.is_histoglyph_admin()))
with check ((select public.is_histoglyph_admin()));

create policy "Admins manage collection persons"
on public.collection_persons for all to authenticated
using ((select public.is_histoglyph_admin()))
with check ((select public.is_histoglyph_admin()));

-- No direct client policies are created for game_sessions or game_session_rounds.
-- Public play is only available through the security-definer RPC functions.

revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;

grant select on public.collections to anon, authenticated;
grant select, insert, update, delete on
  public.admin_users,
  public.places,
  public.persons,
  public.accepted_answers,
  public.tags,
  public.person_tags,
  public.collections,
  public.collection_tags,
  public.collection_persons
  to authenticated;
grant usage, select on all sequences in schema public to authenticated;
