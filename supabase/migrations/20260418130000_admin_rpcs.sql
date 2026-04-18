-- Admin RPCs for team-creation approvals, membership approvals, promotions,
-- and invite management. All SECURITY DEFINER, callable only by authenticated
-- users, gated on super-admin or relevant team-admin role.

----------------------------------------------------------------------
-- Convert (user_id, team_id) uniqueness to partial so soft-deleted
-- rows don't block a re-application.
----------------------------------------------------------------------
alter table memberships drop constraint if exists memberships_user_id_team_id_key;
create unique index memberships_user_team_active_uniq
  on memberships (user_id, team_id)
  where deleted_at is null;

alter table profiles drop constraint if exists profiles_user_id_team_id_key;
create unique index profiles_user_team_active_uniq
  on profiles (user_id, team_id)
  where deleted_at is null;

----------------------------------------------------------------------
-- Slugify helper + unique-slug generator
----------------------------------------------------------------------
create or replace function slugify(input text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(
    lower(coalesce(input, '')),
    '[^a-z0-9]+', '-', 'g'
  ));
$$;

create or replace function generate_unique_team_slug(input text)
returns text
language plpgsql
as $$
declare
  base text := slugify(input);
  candidate text := base;
  n int := 1;
begin
  if base = '' then base := 'team'; candidate := base; end if;
  while exists (select 1 from teams where slug = candidate) loop
    n := n + 1;
    candidate := base || '-' || n::text;
  end loop;
  return candidate;
end;
$$;

create or replace function generate_invite_code()
returns text
language sql
volatile
as $$
  -- 8-char uppercase alphanumeric, base32-style (no 0/O/1/I confusion).
  select string_agg(
    substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
           1 + floor(random() * 32)::int, 1),
    ''
  )
  from generate_series(1, 8);
$$;

----------------------------------------------------------------------
-- Super-admin: approve / reject team creation requests
----------------------------------------------------------------------
create or replace function approve_team_request(p_request_id uuid)
returns uuid -- new team id
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req team_creation_requests%rowtype;
  v_team_id uuid;
  v_slug text;
  v_caller uuid := auth.uid();
begin
  if v_caller is null or not is_super_admin() then
    raise exception using errcode = '42501', message = 'Super-admin only';
  end if;

  select * into v_req from team_creation_requests
   where id = p_request_id for update;
  if not found or v_req.status <> 'pending' then
    raise exception using errcode = '22023', message = 'Request not found or not pending';
  end if;

  v_slug := generate_unique_team_slug(v_req.proposed_name);

  insert into teams (name, slug, status, created_by)
  values (v_req.proposed_name, v_slug, 'active', v_req.requested_by)
  returning id into v_team_id;

  insert into memberships (user_id, team_id, role, status, approved_by, approved_at)
  values (v_req.requested_by, v_team_id, 'team_admin', 'active', v_caller, now());

  update team_creation_requests
    set status = 'approved', reviewed_by = v_caller, reviewed_at = now()
    where id = p_request_id;

  insert into audit_log (actor_user_id, team_id, action, target_type, target_id, details)
  values (v_caller, v_team_id, 'team_request.approved', 'team_creation_request',
          p_request_id, jsonb_build_object('team_name', v_req.proposed_name, 'slug', v_slug));

  return v_team_id;
end;
$$;

create or replace function reject_team_request(p_request_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is null or not is_super_admin() then
    raise exception using errcode = '42501', message = 'Super-admin only';
  end if;

  update team_creation_requests
    set status = 'rejected', reviewed_by = v_caller, reviewed_at = now(),
        review_note = p_note
    where id = p_request_id and status = 'pending';
  if not found then
    raise exception using errcode = '22023', message = 'Request not found or not pending';
  end if;

  insert into audit_log (actor_user_id, action, target_type, target_id, details)
  values (v_caller, 'team_request.rejected', 'team_creation_request', p_request_id,
          jsonb_build_object('note', p_note));
end;
$$;

----------------------------------------------------------------------
-- Team-admin: approve / reject memberships (and the attached profile)
----------------------------------------------------------------------
create or replace function approve_membership(p_membership_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_m memberships%rowtype;
  v_caller uuid := auth.uid();
begin
  if v_caller is null then
    raise exception using errcode = '28000', message = 'Not authenticated';
  end if;

  select * into v_m from memberships where id = p_membership_id for update;
  if not found then
    raise exception using errcode = '22023', message = 'Membership not found';
  end if;
  if not (is_super_admin() or is_team_admin(v_m.team_id)) then
    raise exception using errcode = '42501', message = 'Team-admin only';
  end if;
  if v_m.status <> 'pending' then
    raise exception using errcode = '22023', message = 'Membership not pending';
  end if;

  update memberships
    set status = 'active', approved_by = v_caller, approved_at = now()
    where id = p_membership_id;

  update profiles
    set approved = true, updated_at = now()
    where user_id = v_m.user_id and team_id = v_m.team_id and deleted_at is null;

  insert into audit_log (actor_user_id, team_id, action, target_type, target_id, details)
  values (v_caller, v_m.team_id, 'membership.approved', 'membership', p_membership_id,
          jsonb_build_object('user_id', v_m.user_id));
end;
$$;

create or replace function reject_membership(p_membership_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_m memberships%rowtype;
  v_caller uuid := auth.uid();
begin
  if v_caller is null then
    raise exception using errcode = '28000', message = 'Not authenticated';
  end if;

  select * into v_m from memberships where id = p_membership_id for update;
  if not found then
    raise exception using errcode = '22023', message = 'Membership not found';
  end if;
  if not (is_super_admin() or is_team_admin(v_m.team_id)) then
    raise exception using errcode = '42501', message = 'Team-admin only';
  end if;

  update memberships set deleted_at = now() where id = p_membership_id;
  update profiles
    set deleted_at = now()
    where user_id = v_m.user_id and team_id = v_m.team_id and deleted_at is null;

  insert into audit_log (actor_user_id, team_id, action, target_type, target_id, details)
  values (v_caller, v_m.team_id, 'membership.rejected', 'membership', p_membership_id,
          jsonb_build_object('user_id', v_m.user_id, 'note', p_note));
end;
$$;

----------------------------------------------------------------------
-- Promote a team member to team_admin. Super-admin or team-admin of
-- that team may call. Useful for un-orphaning.
----------------------------------------------------------------------
create or replace function promote_member_to_admin(p_membership_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_m memberships%rowtype;
  v_caller uuid := auth.uid();
begin
  if v_caller is null then
    raise exception using errcode = '28000', message = 'Not authenticated';
  end if;
  select * into v_m from memberships where id = p_membership_id for update;
  if not found or v_m.deleted_at is not null then
    raise exception using errcode = '22023', message = 'Membership not found';
  end if;
  if not (is_super_admin() or is_team_admin(v_m.team_id)) then
    raise exception using errcode = '42501', message = 'Not authorized';
  end if;
  if v_m.status <> 'active' then
    raise exception using errcode = '22023', message = 'Member is not active';
  end if;

  update memberships set role = 'team_admin' where id = p_membership_id;

  insert into audit_log (actor_user_id, team_id, action, target_type, target_id, details)
  values (v_caller, v_m.team_id, 'membership.promoted_to_admin', 'membership',
          p_membership_id, jsonb_build_object('user_id', v_m.user_id));
end;
$$;

----------------------------------------------------------------------
-- Invite management
----------------------------------------------------------------------
create or replace function create_invite(
  p_team_id uuid,
  p_code text default null,
  p_expires_at timestamptz default null,
  p_max_uses integer default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_id uuid;
  v_code text;
begin
  if v_caller is null then
    raise exception using errcode = '28000', message = 'Not authenticated';
  end if;
  if not (is_super_admin() or is_team_admin(p_team_id)) then
    raise exception using errcode = '42501', message = 'Team-admin only';
  end if;

  v_code := coalesce(nullif(trim(p_code), ''), generate_invite_code());
  -- Retry a handful of times if the auto-code collides.
  for i in 1..5 loop
    begin
      insert into team_invites (team_id, code, created_by, expires_at, max_uses)
      values (p_team_id, v_code, v_caller, p_expires_at, p_max_uses)
      returning id into v_id;
      exit;
    exception when unique_violation then
      if p_code is not null then raise; end if;
      v_code := generate_invite_code();
    end;
  end loop;
  if v_id is null then
    raise exception using message = 'Could not generate a unique invite code';
  end if;

  insert into audit_log (actor_user_id, team_id, action, target_type, target_id, details)
  values (v_caller, p_team_id, 'invite.created', 'invite', v_id,
          jsonb_build_object('expires_at', p_expires_at, 'max_uses', p_max_uses));
  return v_id;
end;
$$;

create or replace function revoke_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite team_invites%rowtype;
  v_caller uuid := auth.uid();
begin
  if v_caller is null then
    raise exception using errcode = '28000', message = 'Not authenticated';
  end if;
  select * into v_invite from team_invites where id = p_invite_id for update;
  if not found then
    raise exception using errcode = '22023', message = 'Invite not found';
  end if;
  if not (is_super_admin() or is_team_admin(v_invite.team_id)) then
    raise exception using errcode = '42501', message = 'Team-admin only';
  end if;
  if v_invite.revoked_at is not null then return; end if;

  update team_invites set revoked_at = now() where id = p_invite_id;
  insert into audit_log (actor_user_id, team_id, action, target_type, target_id)
  values (v_caller, v_invite.team_id, 'invite.revoked', 'invite', p_invite_id);
end;
$$;

----------------------------------------------------------------------
-- Grant execute to authenticated. RLS + role checks inside each
-- function handle authorization.
----------------------------------------------------------------------
revoke all on function approve_team_request(uuid) from public;
revoke all on function reject_team_request(uuid, text) from public;
revoke all on function approve_membership(uuid) from public;
revoke all on function reject_membership(uuid, text) from public;
revoke all on function promote_member_to_admin(uuid) from public;
revoke all on function create_invite(uuid, text, timestamptz, integer) from public;
revoke all on function revoke_invite(uuid) from public;

grant execute on function approve_team_request(uuid) to authenticated;
grant execute on function reject_team_request(uuid, text) to authenticated;
grant execute on function approve_membership(uuid) to authenticated;
grant execute on function reject_membership(uuid, text) to authenticated;
grant execute on function promote_member_to_admin(uuid) to authenticated;
grant execute on function create_invite(uuid, text, timestamptz, integer) to authenticated;
grant execute on function revoke_invite(uuid) to authenticated;
