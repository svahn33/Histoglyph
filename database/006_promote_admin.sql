-- Run this after creating your administrator in Authentication > Users.
-- Replace the email address before executing.
insert into public.admin_users(user_id, display_name)
select id, 'Histoglyph administrator'
from auth.users
where email = 'YOUR_ADMIN_EMAIL@example.com'
on conflict (user_id) do nothing;
