-- Phase 3 (part 1): notifications + preferences.
-- notifications: in-app feed, one row per delivered in-app notification.
-- notification_preferences: per (user, team) opt-in/out for each
-- notification kind. A trigger copies defaults into a fresh row when a
-- user's membership becomes active.

----------------------------------------------------------------------
-- Enum + tables
----------------------------------------------------------------------
create type notification_kind as enum (
  'new_challenge',
  'leaderboard_passed',
  'approval_needed',
  'team_orphaned',
  'profile_change_reviewed'
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users (id) on delete cascade,
  team_id uuid references teams (id) on delete set null,
  kind notification_kind not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_created_idx
  on notifications (user_id, created_at desc);
create index notifications_user_unread_idx
  on notifications (user_id) where read_at is null;

create table notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users (id) on delete cascade,
  team_id uuid not null references teams (id) on delete cascade,
  email_new_challenge boolean not null default true,
  email_leaderboard_passed boolean not null default false,
  email_approval_needed boolean not null default true,
  in_app_new_challenge boolean not null default true,
  in_app_leaderboard_passed boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, team_id)
);

create trigger notification_preferences_touch_updated_at
  before update on notification_preferences
  for each row execute function touch_updated_at();

----------------------------------------------------------------------
-- Trigger: when a membership becomes active, ensure a preferences
-- row exists (copying defaults in the table definition above).
----------------------------------------------------------------------
create or replace function handle_membership_activated_prefs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'active' and (tg_op = 'INSERT' or old.status is distinct from 'active') then
    insert into notification_preferences (user_id, team_id)
    values (new.user_id, new.team_id)
    on conflict (user_id, team_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger on_membership_activated_prefs
  after insert or update on memberships
  for each row execute function handle_membership_activated_prefs();

----------------------------------------------------------------------
-- Helper: enqueue_notification — called from SECURITY DEFINER contexts
-- (never by clients). Creates an in-app notification respecting the
-- recipient's in-app preference for the kind.
----------------------------------------------------------------------
create or replace function enqueue_notification(
  p_user_id uuid,
  p_team_id uuid,
  p_kind notification_kind,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefs notification_preferences%rowtype;
  v_in_app boolean := true;
  v_id uuid;
begin
  if p_team_id is not null then
    select * into v_prefs
      from notification_preferences
      where user_id = p_user_id and team_id = p_team_id;
    if found then
      v_in_app := case p_kind
        when 'new_challenge' then v_prefs.in_app_new_challenge
        when 'leaderboard_passed' then v_prefs.in_app_leaderboard_passed
        else true
      end;
    end if;
  end if;

  if not v_in_app then return null; end if;

  insert into notifications (user_id, team_id, kind, payload)
  values (p_user_id, p_team_id, p_kind, p_payload)
  returning id into v_id;
  return v_id;
end;
$$;

----------------------------------------------------------------------
-- Wire enqueue_notification into existing events:
-- - approve_membership fires approval_needed -> new_challenge flow
--   (actually just a welcome notification)
-- - admin-published challenge fires new_challenge to audience members
-- - team_orphaned trigger notifies super-admins
-- - profile_change approved/rejected notifies the player
--
-- We keep this minimal: audit_log entries already exist for these,
-- so we just enqueue notifications alongside.
----------------------------------------------------------------------
create or replace function handle_challenge_published_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  -- Only notify on the draft->published transition.
  if tg_op = 'UPDATE' and new.status = 'published' and old.status <> 'published' then
    for r in
      select distinct m.user_id, ca.team_id
        from challenge_audience ca
        join memberships m on m.team_id = ca.team_id
        where ca.challenge_id = new.id
          and m.status = 'active'
          and m.deleted_at is null
    loop
      perform enqueue_notification(
        r.user_id, r.team_id, 'new_challenge',
        jsonb_build_object('challenge_id', new.id, 'title', new.title)
      );
    end loop;
  end if;
  return new;
end;
$$;

create trigger on_challenge_published_notify
  after update on challenges
  for each row execute function handle_challenge_published_notify();

-- Orphan notification: when recompute_team_orphan_status flips a team
-- to orphaned, notify all super-admins.
create or replace function handle_team_orphaned_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare r record;
begin
  if tg_op = 'UPDATE' and new.status = 'orphaned' and old.status <> 'orphaned' then
    for r in select id from app_users where is_super_admin = true and deleted_at is null
    loop
      perform enqueue_notification(
        r.id, new.id, 'team_orphaned',
        jsonb_build_object('team_id', new.id, 'team_name', new.name)
      );
    end loop;
  end if;
  return new;
end;
$$;

create trigger on_team_orphaned_notify
  after update on teams
  for each row execute function handle_team_orphaned_notify();

----------------------------------------------------------------------
-- RLS
----------------------------------------------------------------------
alter table notifications enable row level security;
alter table notification_preferences enable row level security;

create policy notifications_self_read on notifications
  for select to authenticated
  using (user_id = auth.uid());

create policy notifications_self_update on notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy notification_prefs_self_read on notification_preferences
  for select to authenticated
  using (user_id = auth.uid());

create policy notification_prefs_self_write on notification_preferences
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke all on function enqueue_notification(uuid, uuid, notification_kind, jsonb) from public;
-- Only triggers / SECURITY DEFINER contexts call enqueue_notification,
-- never clients.

----------------------------------------------------------------------
-- Mark-as-read RPC (batch).
----------------------------------------------------------------------
create or replace function mark_notifications_read(p_ids uuid[] default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_count int;
begin
  if v_caller is null then
    raise exception using errcode = '28000', message = 'Not authenticated';
  end if;
  if p_ids is null then
    update notifications set read_at = now()
      where user_id = v_caller and read_at is null;
  else
    update notifications set read_at = now()
      where user_id = v_caller and read_at is null and id = any(p_ids);
  end if;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function mark_notifications_read(uuid[]) to authenticated;
