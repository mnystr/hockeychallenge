-- Team rename approvals.
-- Mirrors profile_change_requests: team-admins propose a new display name,
-- super-admins approve or reject. Slug stays stable (URLs/bookmarks
-- shouldn't break on rename). Only one pending request per team at a time.

create type team_change_status as enum ('pending', 'approved', 'rejected');

create table team_change_requests (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams (id) on delete cascade,
  requested_by uuid not null references app_users (id) on delete cascade,

  proposed_name text not null,

  status team_change_status not null default 'pending',
  reviewed_by uuid references app_users (id),
  reviewed_at timestamptz,
  review_note text,

  created_at timestamptz not null default now()
);

create index team_change_requests_team_idx
  on team_change_requests (team_id, status);

-- One pending rename per team.
create unique index team_change_requests_one_pending
  on team_change_requests (team_id)
  where status = 'pending';

----------------------------------------------------------------------
-- submit_team_change: a team-admin proposes a new name.
----------------------------------------------------------------------
create or replace function submit_team_change(
  p_team_id uuid,
  p_proposed_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_id uuid;
  v_name text := btrim(coalesce(p_proposed_name, ''));
begin
  if v_caller is null then
    raise exception using errcode = '28000', message = 'Not authenticated';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    raise exception using errcode = '22023',
      message = 'Team name must be 2–80 characters.';
  end if;
  if not (is_super_admin() or is_team_admin(p_team_id)) then
    raise exception using errcode = '42501', message = 'Team-admin only';
  end if;
  if not exists (select 1 from teams where id = p_team_id and deleted_at is null) then
    raise exception using errcode = '22023', message = 'Team not found';
  end if;

  -- Supersede any existing pending request for the same team.
  update team_change_requests
    set status = 'rejected',
        reviewed_by = v_caller,
        reviewed_at = now(),
        review_note = 'superseded'
    where team_id = p_team_id and status = 'pending';

  insert into team_change_requests (team_id, requested_by, proposed_name)
  values (p_team_id, v_caller, v_name)
  returning id into v_id;

  insert into audit_log (actor_user_id, team_id, action, target_type, target_id,
                         details)
  values (v_caller, p_team_id, 'team_change.submitted', 'team', p_team_id,
          jsonb_build_object('proposed_name', v_name));

  return v_id;
end;
$$;

----------------------------------------------------------------------
-- approve_team_change: super-admin only. Applies the new name.
----------------------------------------------------------------------
create or replace function approve_team_change(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_req team_change_requests%rowtype;
begin
  if v_caller is null then
    raise exception using errcode = '28000', message = 'Not authenticated';
  end if;
  if not is_super_admin() then
    raise exception using errcode = '42501', message = 'Super-admin only';
  end if;
  select * into v_req from team_change_requests
    where id = p_request_id for update;
  if not found or v_req.status <> 'pending' then
    raise exception using errcode = '22023', message = 'Request not pending';
  end if;

  update teams
    set name = v_req.proposed_name,
        updated_at = now()
    where id = v_req.team_id;

  update team_change_requests
    set status = 'approved',
        reviewed_by = v_caller,
        reviewed_at = now()
    where id = p_request_id;

  insert into audit_log (actor_user_id, team_id, action, target_type, target_id,
                         details)
  values (v_caller, v_req.team_id, 'team_change.approved', 'team', v_req.team_id,
          jsonb_build_object('request_id', p_request_id,
                             'new_name', v_req.proposed_name));
end;
$$;

----------------------------------------------------------------------
-- reject_team_change: super-admin only.
----------------------------------------------------------------------
create or replace function reject_team_change(p_request_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_req team_change_requests%rowtype;
begin
  if v_caller is null then
    raise exception using errcode = '28000', message = 'Not authenticated';
  end if;
  if not is_super_admin() then
    raise exception using errcode = '42501', message = 'Super-admin only';
  end if;
  select * into v_req from team_change_requests
    where id = p_request_id for update;
  if not found or v_req.status <> 'pending' then
    raise exception using errcode = '22023', message = 'Request not pending';
  end if;

  update team_change_requests
    set status = 'rejected',
        reviewed_by = v_caller,
        reviewed_at = now(),
        review_note = p_note
    where id = p_request_id;

  insert into audit_log (actor_user_id, team_id, action, target_type, target_id,
                         details)
  values (v_caller, v_req.team_id, 'team_change.rejected', 'team', v_req.team_id,
          jsonb_build_object('request_id', p_request_id, 'note', p_note));
end;
$$;

----------------------------------------------------------------------
-- RLS + grants
----------------------------------------------------------------------
alter table team_change_requests enable row level security;

create policy tcr_read on team_change_requests
  for select to authenticated
  using (
    is_super_admin()
    or is_team_admin(team_id)
  );

revoke all on function submit_team_change(uuid, text) from public;
revoke all on function approve_team_change(uuid) from public;
revoke all on function reject_team_change(uuid, text) from public;

grant execute on function submit_team_change(uuid, text) to authenticated;
grant execute on function approve_team_change(uuid) to authenticated;
grant execute on function reject_team_change(uuid, text) to authenticated;
