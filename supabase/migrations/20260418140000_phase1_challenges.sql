-- Phase 1: challenges, tasks, self-report progress, challenge completions.
-- Leaderboards land in a separate migration.
-- All user-visible tables include deleted_at from the first migration.
-- Completion is computed by a single recompute_completion() function
-- invoked from every mutation path so edits to a live challenge always
-- keep completions in sync.

----------------------------------------------------------------------
-- Enums
----------------------------------------------------------------------
create type challenge_status as enum ('draft', 'published', 'archived');
create type challenge_completion_mode as enum ('all_tasks', 'x_of_y');
create type recurrence_kind as enum ('none', 'weekly', 'monthly');

----------------------------------------------------------------------
-- Tables
----------------------------------------------------------------------
create table challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description_md text not null default '',
  completion_points int,
  completion_mode challenge_completion_mode not null default 'all_tasks',
  required_task_count int,
  publish_at timestamptz,
  starts_at timestamptz,
  ends_at timestamptz,
  recurrence recurrence_kind not null default 'none',
  parent_challenge_id uuid references challenges (id) on delete set null,
  status challenge_status not null default 'draft',
  created_by uuid references app_users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint challenges_x_of_y_needs_count check (
    completion_mode = 'all_tasks'
    or (completion_mode = 'x_of_y' and required_task_count is not null and required_task_count > 0)
  ),
  constraint challenges_end_after_start check (
    starts_at is null or ends_at is null or ends_at > starts_at
  )
);

create table challenge_audience (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references challenges (id) on delete cascade,
  team_id uuid not null references teams (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (challenge_id, team_id)
);
create index challenge_audience_team_idx on challenge_audience (team_id);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references challenges (id) on delete cascade,
  title text not null,
  description_md text not null default '',
  points int,
  target_count int not null default 1 check (target_count > 0),
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index tasks_challenge_idx on tasks (challenge_id);

create table task_progress (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks (id) on delete cascade,
  user_id uuid not null references app_users (id) on delete cascade,
  count int not null default 0 check (count >= 0),
  updated_at timestamptz not null default now(),
  unique (task_id, user_id)
);
create index task_progress_user_idx on task_progress (user_id);

create table challenge_completions (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references challenges (id) on delete cascade,
  user_id uuid not null references app_users (id) on delete cascade,
  completed_at timestamptz not null default now(),
  points_awarded int not null default 0,
  unique (challenge_id, user_id)
);
create index challenge_completions_user_idx on challenge_completions (user_id);
create index challenge_completions_completed_at_idx on challenge_completions (completed_at);

----------------------------------------------------------------------
-- updated_at touch triggers
----------------------------------------------------------------------
create trigger challenges_touch_updated_at
  before update on challenges
  for each row execute function touch_updated_at();

create trigger tasks_touch_updated_at
  before update on tasks
  for each row execute function touch_updated_at();

create trigger task_progress_touch_updated_at
  before update on task_progress
  for each row execute function touch_updated_at();

----------------------------------------------------------------------
-- Helper: is the caller a member (active) of any of this challenge's
-- audience teams? Used by RLS to gate reads.
----------------------------------------------------------------------
create or replace function is_in_challenge_audience(p_challenge_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from challenge_audience ca
    join memberships m on m.team_id = ca.team_id
    where ca.challenge_id = p_challenge_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.deleted_at is null
  );
$$;

create or replace function is_admin_of_challenge_audience(p_challenge_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from challenge_audience ca
    join memberships m on m.team_id = ca.team_id
    where ca.challenge_id = p_challenge_id
      and m.user_id = auth.uid()
      and m.role = 'team_admin'
      and m.status = 'active'
      and m.deleted_at is null
  );
$$;

----------------------------------------------------------------------
-- recompute_completion(challenge, user): the single source of truth
-- for whether a (challenge, user) pair is complete. Called from every
-- mutation path — task_progress upsert, task insert/update/delete,
-- challenge completion_mode / required_task_count change — so live
-- edits keep completions in sync.
--
-- Semantics:
--   * Counts non-deleted tasks and tasks where the user's progress
--     meets target_count.
--   * For all_tasks: complete when every task meets target.
--   * For x_of_y: complete when at least required_task_count do.
--   * Zero tasks: never complete.
--   * On first transition to complete, inserts challenge_completions
--     with points = sum of met-target task points + completion_points.
--   * On regression (task added, target raised, progress revoked),
--     deletes the completion row and audit-logs.
--   * Existing completions are NOT retroactively repriced when the
--     admin changes completion_points — this is intentional for
--     leaderboard stability. A separate bulk recalc is available via
--     the admin UI (lands in a later chunk).
----------------------------------------------------------------------
create or replace function recompute_completion(p_challenge_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ch challenges%rowtype;
  v_total_tasks int;
  v_met_tasks int;
  v_should_complete boolean;
  v_existing_id uuid;
  v_team_id uuid;
  v_points int;
begin
  select * into v_ch from challenges where id = p_challenge_id;
  if not found or v_ch.deleted_at is not null then
    -- If the challenge is gone, drop any completion row.
    delete from challenge_completions
      where challenge_id = p_challenge_id and user_id = p_user_id;
    return;
  end if;

  select count(*) into v_total_tasks
    from tasks where challenge_id = p_challenge_id and deleted_at is null;

  select count(*) into v_met_tasks
    from tasks t
    left join task_progress tp
      on tp.task_id = t.id and tp.user_id = p_user_id
    where t.challenge_id = p_challenge_id
      and t.deleted_at is null
      and coalesce(tp.count, 0) >= t.target_count;

  if v_total_tasks = 0 then
    v_should_complete := false;
  elsif v_ch.completion_mode = 'all_tasks' then
    v_should_complete := (v_met_tasks = v_total_tasks);
  else
    v_should_complete := (v_met_tasks >= coalesce(v_ch.required_task_count, 1));
  end if;

  select id into v_existing_id
    from challenge_completions
    where challenge_id = p_challenge_id and user_id = p_user_id;

  -- Grab one audience team for audit context. We log against the first
  -- one (most challenges will only have one in the current product).
  select team_id into v_team_id
    from challenge_audience where challenge_id = p_challenge_id limit 1;

  if v_should_complete and v_existing_id is null then
    select coalesce(sum(t.points), 0) into v_points
      from tasks t
      left join task_progress tp on tp.task_id = t.id and tp.user_id = p_user_id
      where t.challenge_id = p_challenge_id
        and t.deleted_at is null
        and coalesce(tp.count, 0) >= t.target_count
        and t.points is not null;
    v_points := v_points + coalesce(v_ch.completion_points, 0);

    insert into challenge_completions (challenge_id, user_id, points_awarded)
    values (p_challenge_id, p_user_id, v_points);

    insert into audit_log (actor_user_id, team_id, action, target_type, target_id, details)
    values (p_user_id, v_team_id, 'challenge.completed', 'challenge', p_challenge_id,
            jsonb_build_object('points', v_points));
  elsif not v_should_complete and v_existing_id is not null then
    delete from challenge_completions where id = v_existing_id;
    insert into audit_log (actor_user_id, team_id, action, target_type, target_id, details)
    values (p_user_id, v_team_id, 'challenge.uncompleted', 'challenge', p_challenge_id,
            jsonb_build_object('reason', 'conditions_no_longer_met'));
  end if;
end;
$$;

revoke all on function recompute_completion(uuid, uuid) from public;
-- Only triggers call this (via SECURITY DEFINER), never clients directly.

----------------------------------------------------------------------
-- Triggers wiring recompute_completion to every mutation path.
----------------------------------------------------------------------
create or replace function handle_task_progress_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_challenge_id uuid;
begin
  if tg_op = 'DELETE' then
    select challenge_id into v_challenge_id from tasks where id = old.task_id;
    if v_challenge_id is not null then
      perform recompute_completion(v_challenge_id, old.user_id);
    end if;
    return old;
  else
    select challenge_id into v_challenge_id from tasks where id = new.task_id;
    if v_challenge_id is not null then
      perform recompute_completion(v_challenge_id, new.user_id);
    end if;
    return new;
  end if;
end;
$$;

create trigger on_task_progress_change
  after insert or update or delete on task_progress
  for each row execute function handle_task_progress_change();

-- When a task is added, deleted, or its target_count changes, every user
-- with progress on the parent challenge needs recomputing.
create or replace function handle_task_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_challenge_id uuid;
  r record;
begin
  v_challenge_id := coalesce(new.challenge_id, old.challenge_id);

  -- Everyone with progress on any task in this challenge.
  for r in
    select distinct tp.user_id
      from task_progress tp
      join tasks t on t.id = tp.task_id
      where t.challenge_id = v_challenge_id
  loop
    perform recompute_completion(v_challenge_id, r.user_id);
  end loop;

  return coalesce(new, old);
end;
$$;

create trigger on_task_change
  after insert or update of target_count, deleted_at or delete on tasks
  for each row execute function handle_task_change();

-- When completion_mode or required_task_count changes on a challenge,
-- recompute everyone with progress.
create or replace function handle_challenge_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare r record;
begin
  if tg_op = 'UPDATE' then
    if new.completion_mode is distinct from old.completion_mode
       or new.required_task_count is distinct from old.required_task_count
       or new.deleted_at is distinct from old.deleted_at
    then
      for r in
        select distinct tp.user_id
          from task_progress tp
          join tasks t on t.id = tp.task_id
          where t.challenge_id = new.id
      loop
        perform recompute_completion(new.id, r.user_id);
      end loop;
    end if;
  end if;
  return new;
end;
$$;

create trigger on_challenge_change
  after update on challenges
  for each row execute function handle_challenge_change();

----------------------------------------------------------------------
-- Row Level Security
----------------------------------------------------------------------
alter table challenges enable row level security;
alter table challenge_audience enable row level security;
alter table tasks enable row level security;
alter table task_progress enable row level security;
alter table challenge_completions enable row level security;

-- challenges: members of any audience team can read (with publish_at
-- honored); team-admins of any audience team can write (including drafts).
create policy challenges_audience_read on challenges
  for select to authenticated
  using (
    deleted_at is null
    and (
      is_super_admin()
      or is_admin_of_challenge_audience(id)
      or (
        is_in_challenge_audience(id)
        and status = 'published'
        and (publish_at is null or publish_at <= now())
      )
    )
  );

create policy challenges_admin_write on challenges
  for all to authenticated
  using (is_super_admin() or is_admin_of_challenge_audience(id))
  with check (is_super_admin() or is_admin_of_challenge_audience(id));

-- challenge_audience: team-admins manage; members can read to see that
-- they're in the audience.
create policy challenge_audience_read on challenge_audience
  for select to authenticated
  using (
    is_super_admin() or is_team_member(team_id) or is_team_admin(team_id)
  );

create policy challenge_audience_admin_write on challenge_audience
  for all to authenticated
  using (is_super_admin() or is_team_admin(team_id))
  with check (is_super_admin() or is_team_admin(team_id));

-- tasks: same visibility as parent challenge.
create policy tasks_read on tasks
  for select to authenticated
  using (
    deleted_at is null
    and exists (
      select 1 from challenges c
      where c.id = tasks.challenge_id
        and c.deleted_at is null
        and (
          is_super_admin()
          or is_admin_of_challenge_audience(c.id)
          or (
            is_in_challenge_audience(c.id)
            and c.status = 'published'
            and (c.publish_at is null or c.publish_at <= now())
          )
        )
    )
  );

create policy tasks_admin_write on tasks
  for all to authenticated
  using (is_super_admin() or is_admin_of_challenge_audience(challenge_id))
  with check (is_super_admin() or is_admin_of_challenge_audience(challenge_id));

-- task_progress: user writes own rows; team-admins of audience can
-- write (for corrections) and read; super-admin reads all.
create policy task_progress_self on task_progress
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy task_progress_admin on task_progress
  for all to authenticated
  using (
    is_super_admin()
    or exists (
      select 1 from tasks t
      where t.id = task_progress.task_id
        and is_admin_of_challenge_audience(t.challenge_id)
    )
  )
  with check (
    is_super_admin()
    or exists (
      select 1 from tasks t
      where t.id = task_progress.task_id
        and is_admin_of_challenge_audience(t.challenge_id)
    )
  );

-- challenge_completions: readable by audience members; never written
-- directly (only recompute_completion writes, via SECURITY DEFINER).
create policy challenge_completions_audience_read on challenge_completions
  for select to authenticated
  using (
    is_super_admin()
    or is_admin_of_challenge_audience(challenge_id)
    or (
      is_in_challenge_audience(challenge_id)
      -- Leaderboard visibility (hide 0-point entries from non-owners)
      -- is enforced at query time, not here. Members can read completions
      -- for the audience teams they belong to.
    )
  );
