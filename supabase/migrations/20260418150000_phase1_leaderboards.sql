-- Phase 1: leaderboards. Two kinds:
--   * points: derived from challenge_completions within the
--     leaderboard's [starts_at, ends_at) window, from all challenges
--     whose audience includes the leaderboard's team.
--   * standalone: players self-report a numeric value (e.g. number of
--     practice shots taken during the summer).
--
-- Snapshot-on-archive keeps history stable even if completions are
-- later edited. Visibility (hide 0-value entries from non-owners),
-- dense rank, and a deterministic tiebreaker are enforced in the
-- ranked view leaderboard_ranked below.

----------------------------------------------------------------------
-- Enums
----------------------------------------------------------------------
create type leaderboard_kind as enum ('points', 'standalone');
create type leaderboard_sort as enum ('desc', 'asc');
create type leaderboard_status as enum ('active', 'archived');

----------------------------------------------------------------------
-- Tables
----------------------------------------------------------------------
create table leaderboards (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams (id) on delete cascade,
  name text not null,
  description text not null default '',
  kind leaderboard_kind not null,
  starts_at timestamptz,
  ends_at timestamptz,
  sort_order leaderboard_sort not null default 'desc',
  unit text,
  status leaderboard_status not null default 'active',
  archived_at timestamptz,
  created_by uuid references app_users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint leaderboards_end_after_start check (
    starts_at is null or ends_at is null or ends_at > starts_at
  )
);
create index leaderboards_team_idx on leaderboards (team_id);

create table leaderboard_entries (
  id uuid primary key default gen_random_uuid(),
  leaderboard_id uuid not null references leaderboards (id) on delete cascade,
  user_id uuid not null references app_users (id) on delete cascade,
  value numeric not null,
  updated_at timestamptz not null default now(),
  unique (leaderboard_id, user_id)
);
create index leaderboard_entries_board_idx on leaderboard_entries (leaderboard_id);

-- Immutable snapshot written at archive time.
create table leaderboard_snapshots (
  id uuid primary key default gen_random_uuid(),
  leaderboard_id uuid not null references leaderboards (id) on delete cascade,
  user_id uuid not null references app_users (id) on delete cascade,
  display_name text not null,
  value numeric not null,
  rank int not null,
  archived_at timestamptz not null default now()
);
create index leaderboard_snapshots_board_idx on leaderboard_snapshots (leaderboard_id);

create trigger leaderboards_touch_updated_at
  before update on leaderboards
  for each row execute function touch_updated_at();

create trigger leaderboard_entries_touch_updated_at
  before update on leaderboard_entries
  for each row execute function touch_updated_at();

----------------------------------------------------------------------
-- Ranked view: used by UI reads for both active points and standalone
-- leaderboards. Dense rank with deterministic tiebreaker
-- (earliest tiebreaker_at ascending, then display_name ascending).
-- Zero-value entries are visible to owners and team admins only —
-- enforced at the query layer since views don't play perfectly with
-- per-row RLS on join results.
----------------------------------------------------------------------
create or replace view leaderboard_active_standings as
with points_raw as (
  select
    l.id as leaderboard_id,
    l.team_id,
    l.sort_order,
    cc.user_id,
    sum(cc.points_awarded)::numeric as value,
    min(cc.completed_at) as tiebreaker_at
  from leaderboards l
  join challenge_audience ca on ca.team_id = l.team_id
  join challenge_completions cc on cc.challenge_id = ca.challenge_id
  where l.kind = 'points'
    and l.status = 'active'
    and l.deleted_at is null
    and (l.starts_at is null or cc.completed_at >= l.starts_at)
    and (l.ends_at is null or cc.completed_at < l.ends_at)
  group by l.id, l.team_id, l.sort_order, cc.user_id
),
standalone_raw as (
  select
    l.id as leaderboard_id,
    l.team_id,
    l.sort_order,
    le.user_id,
    le.value,
    le.updated_at as tiebreaker_at
  from leaderboards l
  join leaderboard_entries le on le.leaderboard_id = l.id
  where l.kind = 'standalone'
    and l.status = 'active'
    and l.deleted_at is null
),
unioned as (
  select * from points_raw
  union all
  select * from standalone_raw
),
with_names as (
  select
    u.leaderboard_id, u.team_id, u.sort_order, u.user_id, u.value, u.tiebreaker_at,
    p.display_name
  from unioned u
  left join profiles p
    on p.user_id = u.user_id
   and p.team_id = u.team_id
   and p.deleted_at is null
   and p.approved = true
)
select
  leaderboard_id, team_id, user_id, value, tiebreaker_at,
  coalesce(display_name, 'Pending') as display_name,
  dense_rank() over (
    partition by leaderboard_id
    order by
      case when sort_order = 'desc' then -value else value end asc
  ) as rank,
  row_number() over (
    partition by leaderboard_id
    order by
      case when sort_order = 'desc' then -value else value end asc,
      tiebreaker_at asc nulls last,
      coalesce(display_name, 'zzzz') asc
  ) as display_order
from with_names;

grant select on leaderboard_active_standings to authenticated;

----------------------------------------------------------------------
-- Archive RPC: snapshots final standings and flips status.
-- Safe to call idempotently — running on an already-archived board
-- is a no-op.
----------------------------------------------------------------------
create or replace function archive_leaderboard(p_leaderboard_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lb leaderboards%rowtype;
  v_caller uuid := auth.uid();
begin
  if v_caller is null then
    raise exception using errcode = '28000', message = 'Not authenticated';
  end if;
  select * into v_lb from leaderboards where id = p_leaderboard_id;
  if not found or v_lb.deleted_at is not null then
    raise exception using errcode = '22023', message = 'Leaderboard not found';
  end if;
  if not (is_super_admin() or is_team_admin(v_lb.team_id)) then
    raise exception using errcode = '42501', message = 'Team-admin only';
  end if;
  if v_lb.status = 'archived' then return; end if;

  insert into leaderboard_snapshots (leaderboard_id, user_id, display_name, value, rank, archived_at)
  select leaderboard_id, user_id, display_name, value, rank, now()
    from leaderboard_active_standings
    where leaderboard_id = p_leaderboard_id;

  update leaderboards
    set status = 'archived', archived_at = now()
    where id = p_leaderboard_id;

  insert into audit_log (actor_user_id, team_id, action, target_type, target_id, details)
  values (v_caller, v_lb.team_id, 'leaderboard.archived', 'leaderboard', p_leaderboard_id,
          jsonb_build_object(
            'row_count',
            (select count(*) from leaderboard_snapshots where leaderboard_id = p_leaderboard_id)
          ));
end;
$$;

revoke all on function archive_leaderboard(uuid) from public;
grant execute on function archive_leaderboard(uuid) to authenticated;

----------------------------------------------------------------------
-- Row Level Security
----------------------------------------------------------------------
alter table leaderboards enable row level security;
alter table leaderboard_entries enable row level security;
alter table leaderboard_snapshots enable row level security;

-- leaderboards: team members and admins read; team-admins + super-admin
-- write.
create policy leaderboards_team_read on leaderboards
  for select to authenticated
  using (
    deleted_at is null and (
      is_super_admin() or is_team_member(team_id) or is_team_admin(team_id)
    )
  );

create policy leaderboards_admin_write on leaderboards
  for all to authenticated
  using (is_super_admin() or is_team_admin(team_id))
  with check (is_super_admin() or is_team_admin(team_id));

-- leaderboard_entries: owner writes own; team-admins read/write for
-- corrections; team members read (to see each other's values). Zero-
-- value visibility is a query-time filter.
create policy leaderboard_entries_self on leaderboard_entries
  for all to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from leaderboards l
      where l.id = leaderboard_entries.leaderboard_id
        and (is_super_admin() or is_team_admin(l.team_id))
    )
  )
  with check (
    user_id = auth.uid()
    or exists (
      select 1 from leaderboards l
      where l.id = leaderboard_entries.leaderboard_id
        and (is_super_admin() or is_team_admin(l.team_id))
    )
  );

create policy leaderboard_entries_team_read on leaderboard_entries
  for select to authenticated
  using (
    exists (
      select 1 from leaderboards l
      where l.id = leaderboard_entries.leaderboard_id
        and l.deleted_at is null
        and (is_team_member(l.team_id) or is_team_admin(l.team_id) or is_super_admin())
    )
  );

-- leaderboard_snapshots: readable by team members; written only by
-- archive_leaderboard (SECURITY DEFINER, bypasses RLS). No update /
-- delete policies at all.
create policy leaderboard_snapshots_team_read on leaderboard_snapshots
  for select to authenticated
  using (
    exists (
      select 1 from leaderboards l
      where l.id = leaderboard_snapshots.leaderboard_id
        and (is_team_member(l.team_id) or is_team_admin(l.team_id) or is_super_admin())
    )
  );
