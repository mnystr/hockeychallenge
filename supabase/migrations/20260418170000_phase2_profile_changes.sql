-- Phase 2 (part 1): profile change requests.
-- Players self-serve edits to display_name / jersey / pronouns / visibility /
-- picture path by submitting a pending request. Team-admins review and
-- either apply the proposed values or reject with a note. Only one pending
-- request per profile at a time.

----------------------------------------------------------------------
-- Enum + table
----------------------------------------------------------------------
create type profile_change_status as enum ('pending', 'approved', 'rejected');

create table profile_change_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id) on delete cascade,
  user_id uuid not null references app_users (id) on delete cascade,
  team_id uuid not null references teams (id) on delete cascade,

  -- Proposed values (null = no change to that field).
  proposed_display_name text,
  proposed_jersey_number int,
  proposed_pronouns text,
  proposed_visibility profile_visibility,
  proposed_picture_path text,

  status profile_change_status not null default 'pending',
  reviewed_by uuid references app_users (id),
  reviewed_at timestamptz,
  review_note text,

  created_at timestamptz not null default now()
);
create index profile_change_requests_team_idx
  on profile_change_requests (team_id, status);
create index profile_change_requests_user_idx
  on profile_change_requests (user_id);

-- At most one pending request per profile.
create unique index profile_change_requests_one_pending
  on profile_change_requests (profile_id)
  where status = 'pending';

----------------------------------------------------------------------
-- submit_profile_change: player proposes edits to their own profile.
----------------------------------------------------------------------
create or replace function submit_profile_change(
  p_profile_id uuid,
  p_display_name text default null,
  p_jersey_number int default null,
  p_pronouns text default null,
  p_visibility profile_visibility default null,
  p_picture_path text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_profile profiles%rowtype;
  v_id uuid;
begin
  if v_caller is null then
    raise exception using errcode = '28000', message = 'Not authenticated';
  end if;

  select * into v_profile from profiles where id = p_profile_id;
  if not found or v_profile.deleted_at is not null then
    raise exception using errcode = '22023', message = 'Profile not found';
  end if;
  if v_profile.user_id <> v_caller then
    raise exception using errcode = '42501', message = 'Not your profile';
  end if;

  -- Drop any existing pending request for this profile so the unique
  -- index doesn't block the new submission. Older pending goes into
  -- audit history, not the active queue.
  update profile_change_requests
    set status = 'rejected',
        reviewed_by = v_caller,
        reviewed_at = now(),
        review_note = 'superseded'
    where profile_id = p_profile_id and status = 'pending';

  insert into profile_change_requests (
    profile_id, user_id, team_id,
    proposed_display_name, proposed_jersey_number, proposed_pronouns,
    proposed_visibility, proposed_picture_path
  ) values (
    p_profile_id, v_caller, v_profile.team_id,
    nullif(p_display_name, ''),
    p_jersey_number,
    nullif(p_pronouns, ''),
    p_visibility,
    nullif(p_picture_path, '')
  )
  returning id into v_id;

  insert into audit_log (actor_user_id, team_id, action, target_type, target_id)
  values (v_caller, v_profile.team_id, 'profile_change.submitted', 'profile', p_profile_id);

  return v_id;
end;
$$;

----------------------------------------------------------------------
-- approve_profile_change: team-admin applies the proposed values.
-- Fields that are null on the request are left unchanged on the profile.
----------------------------------------------------------------------
create or replace function approve_profile_change(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_req profile_change_requests%rowtype;
begin
  if v_caller is null then
    raise exception using errcode = '28000', message = 'Not authenticated';
  end if;
  select * into v_req from profile_change_requests where id = p_request_id for update;
  if not found or v_req.status <> 'pending' then
    raise exception using errcode = '22023', message = 'Request not pending';
  end if;
  if not (is_super_admin() or is_team_admin(v_req.team_id)) then
    raise exception using errcode = '42501', message = 'Team-admin only';
  end if;

  update profiles
    set
      display_name = coalesce(v_req.proposed_display_name, display_name),
      jersey_number = coalesce(v_req.proposed_jersey_number, jersey_number),
      pronouns = coalesce(v_req.proposed_pronouns, pronouns),
      visibility = coalesce(v_req.proposed_visibility, visibility),
      profile_picture_path = coalesce(v_req.proposed_picture_path, profile_picture_path),
      updated_at = now()
    where id = v_req.profile_id;

  update profile_change_requests
    set status = 'approved',
        reviewed_by = v_caller,
        reviewed_at = now()
    where id = p_request_id;

  insert into audit_log (actor_user_id, team_id, action, target_type, target_id, details)
  values (v_caller, v_req.team_id, 'profile_change.approved', 'profile', v_req.profile_id,
          jsonb_build_object('request_id', p_request_id));
end;
$$;

----------------------------------------------------------------------
-- reject_profile_change: team-admin declines the proposed values.
----------------------------------------------------------------------
create or replace function reject_profile_change(p_request_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_req profile_change_requests%rowtype;
begin
  if v_caller is null then
    raise exception using errcode = '28000', message = 'Not authenticated';
  end if;
  select * into v_req from profile_change_requests where id = p_request_id for update;
  if not found or v_req.status <> 'pending' then
    raise exception using errcode = '22023', message = 'Request not pending';
  end if;
  if not (is_super_admin() or is_team_admin(v_req.team_id)) then
    raise exception using errcode = '42501', message = 'Team-admin only';
  end if;

  update profile_change_requests
    set status = 'rejected',
        reviewed_by = v_caller,
        reviewed_at = now(),
        review_note = p_note
    where id = p_request_id;

  insert into audit_log (actor_user_id, team_id, action, target_type, target_id, details)
  values (v_caller, v_req.team_id, 'profile_change.rejected', 'profile', v_req.profile_id,
          jsonb_build_object('request_id', p_request_id, 'note', p_note));
end;
$$;

----------------------------------------------------------------------
-- RLS + grants
----------------------------------------------------------------------
alter table profile_change_requests enable row level security;

-- Player reads their own; team-admins read all for their team.
create policy pcr_self_read on profile_change_requests
  for select to authenticated
  using (
    user_id = auth.uid()
    or is_super_admin()
    or is_team_admin(team_id)
  );

-- No direct client writes. Everything goes through the SECURITY DEFINER
-- RPCs above.

revoke all on function submit_profile_change(uuid, text, int, text, profile_visibility, text) from public;
revoke all on function approve_profile_change(uuid) from public;
revoke all on function reject_profile_change(uuid, text) from public;

grant execute on function submit_profile_change(uuid, text, int, text, profile_visibility, text) to authenticated;
grant execute on function approve_profile_change(uuid) to authenticated;
grant execute on function reject_profile_change(uuid, text) to authenticated;
