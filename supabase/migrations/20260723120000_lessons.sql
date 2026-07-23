-- Lessons: a third content category next to challenges and leaderboards.
-- A lesson is a meatier post (Markdown body, optionally embedding YouTube
-- videos) with an "I've read this" acknowledgement at the bottom that is
-- worth points. Lessons can link related challenges / leaderboards.
--
-- Design notes:
--   * Lessons are team-scoped via a direct team_id (like leaderboards).
--   * lesson_reads is written ONLY by the mark_lesson_read RPC
--     (SECURITY DEFINER) so points are awarded server-side from the
--     lesson's read_points at the moment of reading. Like
--     challenge_completions, later edits to read_points do not rewrite
--     already-awarded points.
--   * Read points flow into active points-leaderboards by extending the
--     leaderboard_active_standings view; archive snapshots therefore
--     include them automatically.

----------------------------------------------------------------------
-- Enum + tables
----------------------------------------------------------------------
create type lesson_status as enum ('draft', 'published', 'archived');

create table lessons (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams (id) on delete cascade,
  title text not null,
  body_md text not null default '',
  read_points int not null default 0 check (read_points >= 0),
  card_theme text null,
  publish_at timestamptz,
  status lesson_status not null default 'draft',
  created_by uuid references app_users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint lessons_card_theme_valid check (
    card_theme is null
    or card_theme in (
      'aurora',
      'inferno',
      'glacier',
      'forest',
      'sunset',
      'lightning',
      'royal',
      'ocean'
    )
  )
);
create index lessons_team_idx on lessons (team_id);

create table lesson_reads (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons (id) on delete cascade,
  user_id uuid not null references app_users (id) on delete cascade,
  read_at timestamptz not null default now(),
  points_awarded int not null default 0,
  unique (lesson_id, user_id)
);
create index lesson_reads_user_idx on lesson_reads (user_id);
create index lesson_reads_read_at_idx on lesson_reads (read_at);

-- Related content shown at the bottom of a lesson. Exactly one of
-- challenge_id / leaderboard_id is set per row.
create table lesson_links (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons (id) on delete cascade,
  challenge_id uuid references challenges (id) on delete cascade,
  leaderboard_id uuid references leaderboards (id) on delete cascade,
  position int not null default 0,
  created_at timestamptz not null default now(),
  constraint lesson_links_exactly_one_target check (
    (challenge_id is null) <> (leaderboard_id is null)
  )
);
create index lesson_links_lesson_idx on lesson_links (lesson_id);
create unique index lesson_links_challenge_uniq
  on lesson_links (lesson_id, challenge_id) where challenge_id is not null;
create unique index lesson_links_leaderboard_uniq
  on lesson_links (lesson_id, leaderboard_id) where leaderboard_id is not null;

create trigger lessons_touch_updated_at
  before update on lessons
  for each row execute function touch_updated_at();

----------------------------------------------------------------------
-- RPC: create_lesson_draft(team_id) — mirrors create_challenge_draft.
----------------------------------------------------------------------
create or replace function create_lesson_draft(p_team_id uuid)
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

  insert into lessons (team_id, title, status, created_by)
  values (p_team_id, 'Untitled lesson', 'draft', v_caller)
  returning id into v_id;

  insert into audit_log (actor_user_id, team_id, action, target_type, target_id)
  values (v_caller, p_team_id, 'lesson.created', 'lesson', v_id);

  return v_id;
end;
$$;

revoke all on function create_lesson_draft(uuid) from public;
grant execute on function create_lesson_draft(uuid) to authenticated;

----------------------------------------------------------------------
-- RPC: mark_lesson_read(lesson_id) — the only write path for
-- lesson_reads. Awards the lesson's current read_points once;
-- idempotent (re-calling returns the already-awarded points).
----------------------------------------------------------------------
create or replace function mark_lesson_read(p_lesson_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_lesson lessons%rowtype;
  v_existing lesson_reads%rowtype;
begin
  if v_caller is null then
    raise exception using errcode = '28000', message = 'Not authenticated';
  end if;

  select * into v_lesson from lessons where id = p_lesson_id;
  if not found
     or v_lesson.deleted_at is not null
     or v_lesson.status <> 'published'
     or (v_lesson.publish_at is not null and v_lesson.publish_at > now())
  then
    raise exception using errcode = '22023', message = 'Lesson not found';
  end if;

  if not (is_team_member(v_lesson.team_id) or is_team_admin(v_lesson.team_id)) then
    raise exception using errcode = '42501', message = 'Team members only';
  end if;

  select * into v_existing
    from lesson_reads
    where lesson_id = p_lesson_id and user_id = v_caller;
  if found then
    return v_existing.points_awarded;
  end if;

  insert into lesson_reads (lesson_id, user_id, points_awarded)
  values (p_lesson_id, v_caller, v_lesson.read_points);

  insert into audit_log (actor_user_id, team_id, action, target_type, target_id, details)
  values (v_caller, v_lesson.team_id, 'lesson.read', 'lesson', p_lesson_id,
          jsonb_build_object('points', v_lesson.read_points));

  return v_lesson.read_points;
end;
$$;

revoke all on function mark_lesson_read(uuid) from public;
grant execute on function mark_lesson_read(uuid) to authenticated;

----------------------------------------------------------------------
-- Points integration: rebuild leaderboard_active_standings so active
-- points-leaderboards sum challenge completions AND lesson reads in
-- their window. Output columns are unchanged, so archive_leaderboard
-- and all existing readers keep working (snapshots now include lesson
-- points automatically).
----------------------------------------------------------------------
create or replace view leaderboard_active_standings as
with points_events as (
  select
    l.id as leaderboard_id,
    l.team_id,
    l.sort_order,
    cc.user_id,
    cc.points_awarded::numeric as points,
    cc.completed_at as happened_at
  from leaderboards l
  join challenge_audience ca on ca.team_id = l.team_id
  join challenge_completions cc on cc.challenge_id = ca.challenge_id
  where l.kind = 'points'
    and l.status = 'active'
    and l.deleted_at is null
    and (l.starts_at is null or cc.completed_at >= l.starts_at)
    and (l.ends_at is null or cc.completed_at < l.ends_at)
  union all
  select
    l.id as leaderboard_id,
    l.team_id,
    l.sort_order,
    lr.user_id,
    lr.points_awarded::numeric as points,
    lr.read_at as happened_at
  from leaderboards l
  join lessons le on le.team_id = l.team_id
  join lesson_reads lr on lr.lesson_id = le.id
  where l.kind = 'points'
    and l.status = 'active'
    and l.deleted_at is null
    and le.deleted_at is null
    and (l.starts_at is null or lr.read_at >= l.starts_at)
    and (l.ends_at is null or lr.read_at < l.ends_at)
),
points_raw as (
  select
    leaderboard_id,
    team_id,
    sort_order,
    user_id,
    sum(points)::numeric as value,
    min(happened_at) as tiebreaker_at
  from points_events
  group by leaderboard_id, team_id, sort_order, user_id
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
-- Notifications: new_lesson kind + per-team preferences + publish
-- fan-out trigger, mirroring new_challenge.
-- (The new enum value is only *used* at runtime, never inside this
-- migration's transaction, so ADD VALUE here is safe.)
----------------------------------------------------------------------
alter type notification_kind add value if not exists 'new_lesson';

alter table notification_preferences
  add column if not exists in_app_new_lesson boolean not null default true,
  add column if not exists email_new_lesson boolean not null default true;

create or replace function enqueue_notification(
  p_user_id uuid,
  p_team_id uuid,
  p_kind notification_kind,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefs notification_preferences%rowtype;
  v_in_app boolean := true;
  v_id uuid;
begin
  if p_team_id is not null then
    select * into v_prefs
      from notification_preferences
      where user_id = p_user_id and team_id = p_team_id;
    if found then
      v_in_app := case p_kind
        when 'new_challenge' then v_prefs.in_app_new_challenge
        when 'new_lesson' then v_prefs.in_app_new_lesson
        when 'leaderboard_passed' then v_prefs.in_app_leaderboard_passed
        else true
      end;
    end if;
  end if;

  if not v_in_app then return null; end if;

  insert into notifications (user_id, team_id, kind, payload)
  values (p_user_id, p_team_id, p_kind, p_payload)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function handle_lesson_published_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  -- Only notify on the draft/archived -> published transition.
  if tg_op = 'UPDATE' and new.status = 'published' and old.status <> 'published' then
    for r in
      select m.user_id
        from memberships m
        where m.team_id = new.team_id
          and m.status = 'active'
          and m.deleted_at is null
    loop
      perform enqueue_notification(
        r.user_id, new.team_id, 'new_lesson',
        jsonb_build_object('lesson_id', new.id, 'title', new.title)
      );
    end loop;
  end if;
  return new;
end;
$$;

create trigger on_lesson_published_notify
  after update on lessons
  for each row execute function handle_lesson_published_notify();

----------------------------------------------------------------------
-- Row Level Security
----------------------------------------------------------------------
alter table lessons enable row level security;
alter table lesson_reads enable row level security;
alter table lesson_links enable row level security;

-- lessons: team members read published (publish_at honored); team-admins
-- read/write everything including drafts.
create policy lessons_team_read on lessons
  for select to authenticated
  using (
    deleted_at is null
    and (
      is_super_admin()
      or is_team_admin(team_id)
      or (
        is_team_member(team_id)
        and status = 'published'
        and (publish_at is null or publish_at <= now())
      )
    )
  );

create policy lessons_admin_write on lessons
  for all to authenticated
  using (is_super_admin() or is_team_admin(team_id))
  with check (is_super_admin() or is_team_admin(team_id));

-- lesson_reads: readable by team members (needed for read badges and by
-- admins for overview). Inserts happen only via mark_lesson_read
-- (SECURITY DEFINER) — no client insert/update policy. Team-admins may
-- delete a read to correct mistakes (points then leave the live
-- leaderboard on the next view read; archived snapshots stay stable).
create policy lesson_reads_team_read on lesson_reads
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from lessons l
      where l.id = lesson_reads.lesson_id
        and (is_super_admin() or is_team_admin(l.team_id) or is_team_member(l.team_id))
    )
  );

create policy lesson_reads_admin_delete on lesson_reads
  for delete to authenticated
  using (
    exists (
      select 1 from lessons l
      where l.id = lesson_reads.lesson_id
        and (is_super_admin() or is_team_admin(l.team_id))
    )
  );

-- lesson_links: same visibility as the parent lesson; team-admins write.
create policy lesson_links_team_read on lesson_links
  for select to authenticated
  using (
    exists (
      select 1 from lessons l
      where l.id = lesson_links.lesson_id
        and l.deleted_at is null
        and (
          is_super_admin()
          or is_team_admin(l.team_id)
          or (
            is_team_member(l.team_id)
            and l.status = 'published'
            and (l.publish_at is null or l.publish_at <= now())
          )
        )
    )
  );

create policy lesson_links_admin_write on lesson_links
  for all to authenticated
  using (
    exists (
      select 1 from lessons l
      where l.id = lesson_links.lesson_id
        and (is_super_admin() or is_team_admin(l.team_id))
    )
  )
  with check (
    exists (
      select 1 from lessons l
      where l.id = lesson_links.lesson_id
        and (is_super_admin() or is_team_admin(l.team_id))
    )
  );
