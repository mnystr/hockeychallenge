-- Local dev seed data.
-- Not run in production. Creates:
--   - 5 themes
--   - 2 super-admin auth users (admin1@example.com / admin2@example.com, password "password123")
--   - 1 demo team ("Test Squad") with an open invite code DEMO-INVITE
-- Safe to re-run: all inserts use on-conflict-do-nothing or idempotent patterns.

----------------------------------------------------------------------
-- Themes
----------------------------------------------------------------------
insert into themes (name, tokens) values
  ('Classic Ice',
   '{"palette":{"primary":"#1e3a8a","secondary":"#e5e7eb","accent":"#f59e0b","bg":"#ffffff","fg":"#0f172a"},"font":{"heading":"Inter","body":"Inter"}}'::jsonb),
  ('Midnight Rink',
   '{"palette":{"primary":"#0ea5e9","secondary":"#1e293b","accent":"#facc15","bg":"#0f172a","fg":"#f1f5f9"},"font":{"heading":"Inter","body":"Inter"}}'::jsonb),
  ('Forest Practice',
   '{"palette":{"primary":"#047857","secondary":"#d1fae5","accent":"#f97316","bg":"#ffffff","fg":"#064e3b"},"font":{"heading":"Inter","body":"Inter"}}'::jsonb),
  ('Sunset Rink',
   '{"palette":{"primary":"#b91c1c","secondary":"#fef3c7","accent":"#7c3aed","bg":"#ffffff","fg":"#1c1917"},"font":{"heading":"Inter","body":"Inter"}}'::jsonb),
  ('Royal Slapshot',
   '{"palette":{"primary":"#6d28d9","secondary":"#ede9fe","accent":"#f472b6","bg":"#ffffff","fg":"#1e1b4b"},"font":{"heading":"Inter","body":"Inter"}}'::jsonb)
on conflict (name) do nothing;

----------------------------------------------------------------------
-- Super-admin auth users
-- Using the supabase auth.users table directly so local dev has working
-- password logins without a signup flow. Passwords are bcrypt hashes of
-- "password123".
----------------------------------------------------------------------
do $$
declare
  admin1_id uuid := '00000000-0000-0000-0000-000000000001';
  admin2_id uuid := '00000000-0000-0000-0000-000000000002';
  pw text := extensions.crypt('password123', extensions.gen_salt('bf'));
begin
  -- admin1
  insert into auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    aud, role, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  )
  values (
    admin1_id, '00000000-0000-0000-0000-000000000000',
    'admin1@example.com', pw, now(),
    'authenticated', 'authenticated',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(), now()
  )
  on conflict (id) do nothing;

  -- admin2
  insert into auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    aud, role, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  )
  values (
    admin2_id, '00000000-0000-0000-0000-000000000000',
    'admin2@example.com', pw, now(),
    'authenticated', 'authenticated',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(), now()
  )
  on conflict (id) do nothing;

  -- Promote both to super-admin.
  update app_users set is_super_admin = true where id in (admin1_id, admin2_id);
end;
$$;

----------------------------------------------------------------------
-- Demo team with an open invite
----------------------------------------------------------------------
do $$
declare
  v_team_id uuid;
  v_theme_id uuid;
  admin1_id uuid := '00000000-0000-0000-0000-000000000001';
begin
  select id into v_theme_id from themes where name = 'Classic Ice';

  insert into teams (name, slug, status, theme_id, created_by)
  values ('Test Squad', 'test-squad', 'active', v_theme_id, admin1_id)
  on conflict (slug) do nothing
  returning id into v_team_id;

  if v_team_id is null then
    select id into v_team_id from teams where slug = 'test-squad';
  end if;

  -- Give admin1 a team_admin membership so the team isn't orphaned.
  insert into memberships (user_id, team_id, role, status, approved_by, approved_at)
  values (admin1_id, v_team_id, 'team_admin', 'active', admin1_id, now())
  on conflict (user_id, team_id) do nothing;

  -- Profile for admin1 on the demo team, pre-approved.
  insert into profiles (user_id, team_id, display_name, visibility, approved)
  values (admin1_id, v_team_id, 'Coach One', 'full', true)
  on conflict (user_id, team_id) do nothing;

  -- Open invite.
  insert into team_invites (team_id, code, created_by, max_uses)
  values (v_team_id, 'DEMO-INVITE', admin1_id, null)
  on conflict (code) do nothing;
end;
$$;
