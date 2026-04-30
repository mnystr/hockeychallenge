-- Phase 0 foundations: core identity, teams, invites, memberships, profiles,
-- themes, audit log. Soft-delete columns on every user-visible table.
-- Helpers + triggers: app_users provisioning, orphaned-team detection,
-- last-super-admin protection. Invite redemption RPC.

----------------------------------------------------------------------
-- Extensions
----------------------------------------------------------------------
create extension if not exists pgcrypto with schema extensions;

----------------------------------------------------------------------
-- Enums
----------------------------------------------------------------------
create type membership_role as enum ('team_admin', 'player');
create type membership_status as enum ('pending', 'active', 'removed');
create type team_status as enum ('active', 'orphaned', 'archived');
create type profile_visibility as enum ('full', 'first_name_only', 'initials');
create type team_request_status as enum ('pending', 'approved', 'rejected');

----------------------------------------------------------------------
-- Tables
----------------------------------------------------------------------

create table app_users (
  id uuid primary key references auth.users (id) on delete cascade,
  is_super_admin boolean not null default false,
  default_team_id uuid, -- fk added below once teams exists
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table themes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  preview_image_path text,
  tokens jsonb not null,
  created_at timestamptz not null default now()
);

create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status team_status not null default 'active',
  theme_id uuid references themes (id),
  logo_path text,
  header_image_path text,
  accent_color text,
  created_by uuid references app_users (id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table app_users
  add constraint app_users_default_team_fk
  foreign key (default_team_id) references teams (id) on delete set null;

create table team_invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams (id) on delete cascade,
  code text not null unique,
  created_by uuid references app_users (id),
  expires_at timestamptz,
  max_uses integer,
  uses_count integer not null default 0,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index team_invites_team_id_idx on team_invites (team_id);

create table memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users (id) on delete cascade,
  team_id uuid not null references teams (id) on delete cascade,
  role membership_role not null,
  status membership_status not null default 'pending',
  invite_id uuid references team_invites (id),
  approved_by uuid references app_users (id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, team_id)
);
create index memberships_team_id_idx on memberships (team_id);
create index memberships_user_id_idx on memberships (user_id);

create table team_creation_requests (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references app_users (id) on delete cascade,
  proposed_name text not null,
  status team_request_status not null default 'pending',
  reviewed_by uuid references app_users (id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now()
);
create index team_creation_requests_status_idx on team_creation_requests (status);

create table profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users (id) on delete cascade,
  team_id uuid not null references teams (id) on delete cascade,
  display_name text not null,
  profile_picture_path text,
  jersey_number integer,
  pronouns text,
  visibility profile_visibility not null default 'first_name_only',
  position text,
  birth_year integer,
  approved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, team_id)
);
create index profiles_team_id_idx on profiles (team_id);

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references app_users (id) on delete set null,
  team_id uuid references teams (id) on delete set null,
  action text not null,
  target_type text,
  target_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_team_id_idx on audit_log (team_id, created_at desc);
create index audit_log_actor_idx on audit_log (actor_user_id, created_at desc);

----------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER, stable) for RLS policies
----------------------------------------------------------------------

create or replace function is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_super_admin from app_users
     where id = auth.uid() and deleted_at is null),
    false
  );
$$;

create or replace function is_team_admin(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from memberships
    where user_id = auth.uid()
      and team_id = p_team_id
      and role = 'team_admin'
      and status = 'active'
      and deleted_at is null
  );
$$;

create or replace function is_team_member(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from memberships
    where user_id = auth.uid()
      and team_id = p_team_id
      and status = 'active'
      and deleted_at is null
  );
$$;

----------------------------------------------------------------------
-- Trigger: auto-provision app_users row when auth.users is inserted
----------------------------------------------------------------------
create or replace function handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into app_users (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();

----------------------------------------------------------------------
-- Trigger: last-super-admin protection
-- Block updates/deletes that would leave the system with < 2 super-admins
----------------------------------------------------------------------
create or replace function enforce_super_admin_minimum()
returns trigger
language plpgsql
as $$
declare
  remaining int;
begin
  -- Count how many super-admins would remain after this change.
  select count(*) into remaining
  from app_users
  where is_super_admin = true
    and deleted_at is null
    and id <> old.id;

  -- If the change reduces the super-admin set, require >=2 to remain.
  if (tg_op = 'DELETE' and old.is_super_admin) then
    if remaining < 2 then
      raise exception using
        errcode = '23514',
        message = 'Cannot delete: system requires at least 2 super-admins';
    end if;
  elsif (tg_op = 'UPDATE'
         and old.is_super_admin = true
         and (new.is_super_admin = false or new.deleted_at is not null)) then
    if remaining < 2 then
      raise exception using
        errcode = '23514',
        message = 'Cannot demote or delete: system requires at least 2 super-admins';
    end if;
  end if;

  return case tg_op when 'DELETE' then old else new end;
end;
$$;

create trigger enforce_super_admin_minimum_update
  before update on app_users
  for each row execute function enforce_super_admin_minimum();

create trigger enforce_super_admin_minimum_delete
  before delete on app_users
  for each row execute function enforce_super_admin_minimum();

----------------------------------------------------------------------
-- Trigger: orphaned team detection
-- After any mutation on memberships, recount active team_admins for the
-- affected team(s). If zero, mark the team orphaned and audit-log it.
----------------------------------------------------------------------
create or replace function recompute_team_orphan_status(p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_count int;
  current_status team_status;
begin
  select status into current_status from teams where id = p_team_id;
  if current_status is null or current_status = 'archived' then
    return;
  end if;

  select count(*) into admin_count
  from memberships
  where team_id = p_team_id
    and role = 'team_admin'
    and status = 'active'
    and deleted_at is null;

  if admin_count = 0 and current_status <> 'orphaned' then
    update teams set status = 'orphaned' where id = p_team_id;
    insert into audit_log (team_id, action, target_type, target_id, details)
    values (p_team_id, 'team.orphaned', 'team', p_team_id,
            jsonb_build_object('reason', 'no_active_team_admins'));
  elsif admin_count > 0 and current_status = 'orphaned' then
    update teams set status = 'active' where id = p_team_id;
    insert into audit_log (team_id, action, target_type, target_id, details)
    values (p_team_id, 'team.unorphaned', 'team', p_team_id,
            jsonb_build_object('active_admin_count', admin_count));
  end if;
end;
$$;

create or replace function handle_membership_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform recompute_team_orphan_status(new.team_id);
  elsif tg_op = 'UPDATE' then
    perform recompute_team_orphan_status(new.team_id);
    if old.team_id <> new.team_id then
      perform recompute_team_orphan_status(old.team_id);
    end if;
  elsif tg_op = 'DELETE' then
    perform recompute_team_orphan_status(old.team_id);
  end if;
  return case tg_op when 'DELETE' then old else new end;
end;
$$;

create trigger on_membership_change
  after insert or update or delete on memberships
  for each row execute function handle_membership_change();

----------------------------------------------------------------------
-- Trigger: updated_at on profiles
----------------------------------------------------------------------
create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on profiles
  for each row execute function touch_updated_at();

----------------------------------------------------------------------
-- Invite redemption RPC
-- Caller must be authenticated. Validates code, creates pending
-- membership + unapproved profile, bumps uses_count, writes audit log.
----------------------------------------------------------------------
create or replace function redeem_invite(
  p_code text,
  p_display_name text,
  p_jersey_number integer default null,
  p_pronouns text default null
)
returns uuid -- membership_id
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite team_invites%rowtype;
  v_membership_id uuid;
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception using errcode = '28000', message = 'Not authenticated';
  end if;

  select * into v_invite
  from team_invites
  where code = p_code
    and revoked_at is null
    and (expires_at is null or expires_at > now())
    and (max_uses is null or uses_count < max_uses)
  for update;

  if not found then
    insert into audit_log (actor_user_id, action, target_type, details)
    values (v_user, 'invite.redeem_failed', 'invite',
            jsonb_build_object('code_hash', encode(extensions.digest(p_code, 'sha256'), 'hex')));
    raise exception using errcode = '22023', message = 'Invalid or expired invite code';
  end if;

  if exists (select 1 from memberships
             where user_id = v_user and team_id = v_invite.team_id
               and deleted_at is null) then
    raise exception using errcode = '23505',
      message = 'You already have a membership on this team';
  end if;

  insert into memberships (user_id, team_id, role, status, invite_id)
  values (v_user, v_invite.team_id, 'player', 'pending', v_invite.id)
  returning id into v_membership_id;

  insert into profiles (user_id, team_id, display_name, jersey_number, pronouns)
  values (v_user, v_invite.team_id, p_display_name, p_jersey_number, p_pronouns);

  update team_invites set uses_count = uses_count + 1 where id = v_invite.id;

  insert into audit_log (actor_user_id, team_id, action, target_type, target_id, details)
  values (v_user, v_invite.team_id, 'invite.redeemed', 'membership', v_membership_id,
          jsonb_build_object('invite_id', v_invite.id));

  return v_membership_id;
end;
$$;

revoke all on function redeem_invite(text, text, integer, text) from public;
grant execute on function redeem_invite(text, text, integer, text) to authenticated;

----------------------------------------------------------------------
-- Row Level Security
----------------------------------------------------------------------

alter table app_users enable row level security;
alter table themes enable row level security;
alter table teams enable row level security;
alter table team_invites enable row level security;
alter table memberships enable row level security;
alter table team_creation_requests enable row level security;
alter table profiles enable row level security;
alter table audit_log enable row level security;

-- app_users: user reads own row; super-admin reads all; no one updates
-- super-admin flag directly via PostgREST (done via service role).
create policy app_users_self_read on app_users
  for select to authenticated
  using (id = auth.uid() or is_super_admin());

create policy app_users_self_update on app_users
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and is_super_admin = (select is_super_admin from app_users where id = auth.uid()));

-- themes: readable by anyone authenticated; writes via service role only.
create policy themes_read on themes
  for select to authenticated using (true);

-- teams: readable by members; super-admin reads all. Writes via service role
-- (team creation) or future team-admin policy.
create policy teams_member_read on teams
  for select to authenticated
  using (deleted_at is null and (is_team_member(id) or is_team_admin(id) or is_super_admin()));

create policy teams_admin_update on teams
  for update to authenticated
  using (is_team_admin(id) or is_super_admin())
  with check (is_team_admin(id) or is_super_admin());

-- team_invites: team-admins of the team manage; no public SELECT by code
-- (redemption goes through SECURITY DEFINER RPC above).
create policy team_invites_admin_read on team_invites
  for select to authenticated
  using (is_team_admin(team_id) or is_super_admin());

create policy team_invites_admin_write on team_invites
  for all to authenticated
  using (is_team_admin(team_id) or is_super_admin())
  with check (is_team_admin(team_id) or is_super_admin());

-- memberships: user reads own; team-admins of team read all for that team;
-- super-admin reads all. Team-admin may update status/role; user may soft-
-- delete own membership.
create policy memberships_self_read on memberships
  for select to authenticated
  using (user_id = auth.uid() or is_team_admin(team_id) or is_super_admin());

create policy memberships_admin_write on memberships
  for update to authenticated
  using (is_team_admin(team_id) or is_super_admin())
  with check (is_team_admin(team_id) or is_super_admin());

create policy memberships_self_leave on memberships
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and status = 'removed');

-- team_creation_requests: user reads own; super-admin reads all.
create policy tcr_self_read on team_creation_requests
  for select to authenticated
  using (requested_by = auth.uid() or is_super_admin());

create policy tcr_self_insert on team_creation_requests
  for insert to authenticated
  with check (requested_by = auth.uid());

create policy tcr_super_update on team_creation_requests
  for update to authenticated
  using (is_super_admin())
  with check (is_super_admin());

-- profiles: user reads own in any team; active team-members read approved
-- profiles of teammates (respect visibility at the view layer, not here —
-- the column is exposed and the app renders the right name form); team-
-- admins read full rows (approved or pending) for their team.
create policy profiles_self_read on profiles
  for select to authenticated
  using (
    user_id = auth.uid()
    or is_team_admin(team_id)
    or is_super_admin()
    or (approved = true and is_team_member(team_id) and deleted_at is null)
  );

create policy profiles_self_update on profiles
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy profiles_admin_write on profiles
  for update to authenticated
  using (is_team_admin(team_id) or is_super_admin())
  with check (is_team_admin(team_id) or is_super_admin());

-- audit_log: team-admins read their team's entries; super-admin reads all;
-- no public writes (everything is written from SECURITY DEFINER functions).
create policy audit_log_team_read on audit_log
  for select to authenticated
  using (
    (team_id is not null and is_team_admin(team_id))
    or is_super_admin()
  );
