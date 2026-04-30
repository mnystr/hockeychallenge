-- Phase 3 (part 2): data rights — account deletion.
-- Users can request soft-delete of their account. We flip deleted_at on:
--   * app_users
--   * every membership of theirs
--   * every profile of theirs
-- Per-row artifacts (task_progress, challenge_completions, leaderboard_entries,
-- notifications) stay intact so leaderboards don't shuffle mid-period for
-- other players. A future cron job can hard-delete those after a grace
-- window; for now the soft-delete is the user-facing promise.
--
-- Export is read-only and handled in a Next.js route handler, no SQL
-- needed beyond normal RLS.

create or replace function request_account_deletion()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is null then
    raise exception using errcode = '28000', message = 'Not authenticated';
  end if;

  -- Block if this is one of the last two super-admins.
  -- (The app_users trigger enforces the floor on UPDATE, but we want a
  -- clearer user-facing error here.)
  if exists (select 1 from app_users where id = v_caller and is_super_admin = true) then
    declare
      remaining int;
    begin
      select count(*) into remaining from app_users
        where is_super_admin = true and deleted_at is null and id <> v_caller;
      if remaining < 2 then
        raise exception using errcode = '23514',
          message = 'Cannot delete: would leave fewer than 2 super-admins. Ask another super-admin to promote a replacement first.';
      end if;
    end;
  end if;

  update memberships set deleted_at = now() where user_id = v_caller and deleted_at is null;
  update profiles set deleted_at = now() where user_id = v_caller and deleted_at is null;
  update app_users set deleted_at = now() where id = v_caller and deleted_at is null;

  insert into audit_log (actor_user_id, action, target_type, target_id)
  values (v_caller, 'account.deletion_requested', 'user', v_caller);
end;
$$;

revoke all on function request_account_deletion() from public;
grant execute on function request_account_deletion() to authenticated;
