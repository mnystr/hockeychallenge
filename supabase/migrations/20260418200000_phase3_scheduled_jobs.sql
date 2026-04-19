-- Phase 3 (part 3): scheduled-job RPCs.
-- These are SECURITY DEFINER functions callable from pg_cron (in cloud
-- deployments) or manually from psql. They're intentionally idempotent
-- and safe to run every few minutes without duplicating work.
--
-- pg_cron scheduling is NOT done here because it's environment-specific
-- (Supabase cloud only). See docs/scheduled-jobs.md for the one-time
-- schedule setup SQL.

----------------------------------------------------------------------
-- archive_expired_leaderboards: active boards whose ends_at is in the
-- past get archive_leaderboard() called on them. Snapshot + status flip
-- already idempotent.
----------------------------------------------------------------------
create or replace function archive_expired_leaderboards()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_archived int := 0;
begin
  for r in
    select id from leaderboards
    where status = 'active'
      and deleted_at is null
      and ends_at is not null
      and ends_at < now()
  loop
    perform archive_leaderboard(r.id);
    v_archived := v_archived + 1;
  end loop;
  return v_archived;
end;
$$;

----------------------------------------------------------------------
-- process_recurring_challenges: finds published challenges with
-- recurrence != 'none' whose ends_at has passed and creates a clone
-- for the next period (with a fresh starts_at / ends_at and
-- parent_challenge_id pointing at the original). The original stays
-- as it was (its own window ended).
--
-- Tasks are cloned too, with their target_count, points, description,
-- and position preserved.
----------------------------------------------------------------------
create or replace function process_recurring_challenges()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  src challenges%rowtype;
  v_new_starts timestamptz;
  v_new_ends timestamptz;
  v_duration interval;
  v_new_id uuid;
  v_cloned int := 0;
begin
  for src in
    select c.*
      from challenges c
      where c.recurrence <> 'none'
        and c.status = 'published'
        and c.deleted_at is null
        and c.ends_at is not null
        and c.ends_at < now()
        -- Skip if a successor already exists (parent_challenge_id set to src.id).
        and not exists (
          select 1 from challenges c2
          where c2.parent_challenge_id = c.id
            and c2.deleted_at is null
        )
  loop
    v_duration := src.ends_at - src.starts_at;
    v_new_starts := src.ends_at;
    v_new_ends := case src.recurrence
      when 'weekly' then v_new_starts + interval '7 days'
      when 'monthly' then v_new_starts + interval '1 month'
      else v_new_starts + v_duration
    end;

    insert into challenges (
      title, description_md, completion_points, completion_mode,
      required_task_count, publish_at, starts_at, ends_at, recurrence,
      parent_challenge_id, status, created_by
    ) values (
      src.title, src.description_md, src.completion_points, src.completion_mode,
      src.required_task_count, v_new_starts, v_new_starts, v_new_ends,
      src.recurrence, src.id, 'published', src.created_by
    )
    returning id into v_new_id;

    -- Mirror audience rows.
    insert into challenge_audience (challenge_id, team_id)
      select v_new_id, team_id from challenge_audience where challenge_id = src.id;

    -- Clone tasks.
    insert into tasks (challenge_id, title, description_md, points, target_count, position)
      select v_new_id, title, description_md, points, target_count, position
        from tasks where challenge_id = src.id and deleted_at is null;

    insert into audit_log (action, target_type, target_id, details)
    values (
      'challenge.recurrence_cloned', 'challenge', v_new_id,
      jsonb_build_object(
        'parent_challenge_id', src.id,
        'starts_at', v_new_starts,
        'ends_at', v_new_ends
      )
    );

    v_cloned := v_cloned + 1;
  end loop;
  return v_cloned;
end;
$$;

revoke all on function archive_expired_leaderboards() from public;
revoke all on function process_recurring_challenges() from public;
-- These are meant to run from pg_cron (superuser context) or manual psql,
-- not from authenticated clients. No grants to `authenticated`.
