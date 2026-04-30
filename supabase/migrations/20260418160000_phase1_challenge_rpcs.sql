-- Minimal RPCs to support the challenge admin UI.
-- Once a draft exists (with its audience row), all subsequent edits go
-- through normal RLS-protected UPDATEs / INSERTs.

----------------------------------------------------------------------
-- create_challenge_draft(team_id): creates an empty draft challenge
-- with an audience row for the team, in a single transaction. Returns
-- the new challenge id for the UI to redirect to.
----------------------------------------------------------------------
create or replace function create_challenge_draft(p_team_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_id uuid;
begin
  if v_caller is null then
    raise exception using errcode = '28000', message = 'Not authenticated';
  end if;
  if not (is_super_admin() or is_team_admin(p_team_id)) then
    raise exception using errcode = '42501', message = 'Team-admin only';
  end if;

  insert into challenges (title, status, created_by)
  values ('Untitled challenge', 'draft', v_caller)
  returning id into v_id;

  insert into challenge_audience (challenge_id, team_id) values (v_id, p_team_id);

  insert into audit_log (actor_user_id, team_id, action, target_type, target_id)
  values (v_caller, p_team_id, 'challenge.created', 'challenge', v_id);

  return v_id;
end;
$$;

revoke all on function create_challenge_draft(uuid) from public;
grant execute on function create_challenge_draft(uuid) to authenticated;
