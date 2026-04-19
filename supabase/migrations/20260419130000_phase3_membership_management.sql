-- Phase 3 extension: demote / remove active members.
-- Existing RPCs only handle pending (approve_membership / reject_membership).
-- We need actions on active rows too: demote a team_admin to player, or
-- remove an active member entirely. Both go through SECURITY DEFINER
-- RPCs so team-admin auth and audit-log entries are consistent with
-- the rest of the admin surface. The orphan trigger on memberships will
-- flip team.status automatically if demote/remove takes the last admin
-- out — callers don't need to guard for that here.

create or replace function demote_member(p_membership_id uuid)
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
  if v_m.deleted_at is not null then
    raise exception using errcode = '22023', message = 'Membership deleted';
  end if;
  if v_m.role <> 'team_admin' then
    raise exception using errcode = '22023', message = 'Not a team admin';
  end if;

  update memberships set role = 'player' where id = p_membership_id;

  insert into audit_log (actor_user_id, team_id, action, target_type, target_id, details)
  values (v_caller, v_m.team_id, 'membership.demoted', 'membership', p_membership_id,
          jsonb_build_object('user_id', v_m.user_id));
end;
$$;

create or replace function remove_member(p_membership_id uuid)
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
  if v_m.deleted_at is not null then
    -- Already removed — idempotent.
    return;
  end if;

  update memberships
    set deleted_at = now(), status = 'removed'
    where id = p_membership_id;
  update profiles
    set deleted_at = now()
    where user_id = v_m.user_id and team_id = v_m.team_id and deleted_at is null;

  insert into audit_log (actor_user_id, team_id, action, target_type, target_id, details)
  values (v_caller, v_m.team_id, 'membership.removed', 'membership', p_membership_id,
          jsonb_build_object('user_id', v_m.user_id));
end;
$$;

revoke all on function demote_member(uuid) from public;
revoke all on function remove_member(uuid) from public;
grant execute on function demote_member(uuid) to authenticated;
grant execute on function remove_member(uuid) to authenticated;
