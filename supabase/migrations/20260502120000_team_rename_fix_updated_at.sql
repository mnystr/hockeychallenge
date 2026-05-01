-- Fix: 20260501140000_team_rename_requests.sql wrote
-- `update teams set name = ..., updated_at = now()` but the teams table
-- has no updated_at column (see 20260418120000_phase0_foundations.sql).
-- Recreate approve_team_change without that assignment.

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
    set name = v_req.proposed_name
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
