# Youth Hockey Challenge Platform — Plan

A website where youth hockey teams run off-season training challenges and leaderboards. Guardians sign up and manage a profile representing their kid. One-to-two teams in practice; architected so more can join later.

---

## 1. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 16 (App Router, TypeScript)** | One codebase for UI + API, server components, huge ecosystem. |
| Styling | **Tailwind CSS + shadcn/ui** | Fast, themable, accessible components out of the box. |
| Backend + Auth + DB | **Supabase** (Postgres, Auth, Storage, Realtime) | Google OAuth + email/password with zero backend code. Row-Level Security enforces roles at the DB. Free tier covers this app easily. |
| Rich text (challenge instructions) | **Markdown** (react-markdown + GFM) for MVP; revisit Tiptap later | Markdown gets us embedded images and formatting in a day. Tiptap adds an editor, sanitization, and Storage-integrated uploads — worth doing, but not worth blocking the MVP on. |
| Forms / validation | **react-hook-form + zod** | Type-safe forms shared between client and server. Also used to validate theme tokens on seed. |
| Email | **Resend** | 3k emails/month free, React email templates. |
| Scheduler (recurring challenges, digests) | **Supabase pg_cron** | Runs inside Postgres, no Vercel Hobby cron-count limit, no extra HTTP hop for DB work. |
| Hosting | **Vercel (Hobby tier)** | Git push → deployed. Zero ops. |
| Error monitoring (optional) | Sentry free tier | Nice to have. |

**Cost for MVP: $0/month.** Free tiers cover a few teams comfortably.

**Deployment flow (meets "easy to host/update"):**
1. Push to GitHub → Vercel auto-deploys preview (PR) and production (main).
2. Supabase migrations via `supabase` CLI committed to repo; applied with `supabase db push`.
3. Environment variables (Supabase URL/keys, Resend key) set once in Vercel dashboard.

**Local dev / seed:**
- `supabase start` spins up a full local stack (Postgres, Auth, Storage).
- `supabase/seed.sql` seeds themes, two super-admin accounts, a demo team, and a dummy challenge so the app is exercisable on a fresh checkout.
- `README.md` documents the six commands needed to get from clone to running app.

---

## 2. Data model

Supabase Auth owns the `auth.users` table. Everything below lives in our schema and references `auth.users.id`.

### Core identity
- **`app_users`** — extends `auth.users`. Columns: `id` (pk, fk `auth.users` **ON DELETE CASCADE**), `is_super_admin` (bool), `default_team_id` (nullable fk), `created_at`, `deleted_at`.
- **`teams`** — `id`, `name`, `slug`, `status` (`active` | `orphaned` | `archived`), `theme_id`, `logo_logo_path`, `header_image_path` (Supabase Storage paths, not URLs — URLs are derived at render time), `accent_color` (optional override), `created_by`, `created_at`, `deleted_at`. Invite-code handling moved to its own table (below).
- **`team_invites`** — `id`, `team_id`, `code` (unguessable, indexed unique), `created_by`, `expires_at` (nullable), `max_uses` (nullable), `uses_count` (default 0), `revoked_at`, `created_at`. Use attempts (success + fail) logged to `audit_log`; failures rate-limited per IP in middleware.
- **`memberships`** — many-to-many between users and teams. `id`, `user_id`, `team_id`, `role` (`team_admin` | `player`), `status` (`pending` | `active` | `removed`), `invite_id` (nullable fk, if joined via invite), `approved_by`, `approved_at`, `created_at`, `deleted_at`. Unique on (`user_id`, `team_id`).
- **`team_creation_requests`** — `id`, `requested_by`, `proposed_name`, `status`, `reviewed_by`, `reviewed_at`, `created_at`.

Super-admin is a global flag on `app_users`. Team-admin and player are roles inside `memberships`. Any user can hold memberships in multiple teams at once with any mix of roles. A DB check constraint and trigger ensures **at least two super-admins exist at all times** — demotion of the last active super-admin is rejected. Seed data creates two super-admin accounts on day zero. Documented SQL escape hatch in `docs/admin-recovery.md` shows how to re-flag a user via the Supabase SQL editor if both super-admins are ever lost.

### Profiles (per team)
- **`profiles`** — `id`, `user_id`, `team_id`, `display_name`, `profile_picture_path` (Storage path, not URL; nullable and defaults to null), `jersey_number`, `pronouns` (nullable), `visibility` (`full` | `first_name_only` | `initials`, default `first_name_only`), plus room-to-grow fields (`position`, `birth_year`). `approved` (bool), `created_at`, `updated_at`, `deleted_at`. Unique on (`user_id`, `team_id`).
- **`profile_change_requests`** — holds the proposed new values while waiting for team-admin approval. First-time setup is submitted with the membership application and approved together.

**Privacy defaults for a youth context:** profile pictures are **off by default** (null) — guardian must explicitly upload. Display name defaults to `visibility='first_name_only'`, rendered as e.g. `"Alex N."` on leaderboards and rosters. Guardian can opt up to `full` or down to `initials`. Team-admins always see the full display name internally (for approval and contact). Visibility changes also go through the approval flow so team-admins notice if a kid's name is changed to something inappropriate.

### Challenges
- **`challenges`** — `id`, `title`, `description_md` (Markdown; images referenced by Storage path), `completion_points` (nullable), `completion_mode` (`all_tasks` | `x_of_y`), `required_task_count` (int, used for `x_of_y`), `publish_at` (nullable — appears to players at this time; distinct from `starts_at`), `starts_at` (nullable — progress can't be logged before this), `ends_at` (nullable), `recurrence` (`none` | `weekly` | `monthly`), `parent_challenge_id` (nullable — set on cloned recurrence instances for audit), `status` (`draft` | `published` | `archived`), `created_by`, `created_at`, `updated_at`, `deleted_at`. **No `team_id` column** — audience lives in `challenge_audience` to avoid a schema rewrite when cross-team challenges arrive.
- **`challenge_audience`** — `id`, `challenge_id`, `team_id`. In MVP every challenge has exactly one row; a future global challenge has many. RLS reads go through `is_team_member_of_any(challenge_audience.team_id)`.
- **`tasks`** — `id`, `challenge_id`, `title`, `description_md`, `points` (nullable), `target_count` (default 1, used for partial-progress tasks like "do 100 shots"), `position`, `deleted_at`.
- **`task_progress`** — `id`, `task_id`, `user_id`, `count` (int), `updated_at`. Unique on (`task_id`, `user_id`). Completion is computed in queries (`count >= target_count`) or by the recompute function below — not stored as a column, since `target_count` lives on `tasks` and would desync. Players self-report; team-admins can edit.
- **`challenge_completions`** — written/updated by the `recompute_completion(challenge_id, user_id)` function, **not** by a single insert trigger. `id`, `challenge_id`, `user_id`, `completed_at`, `points_awarded`. Unique on (`challenge_id`, `user_id`). The recompute function is called after every mutation that can affect completion state: `task_progress` upsert, `tasks` insert/update/delete, `challenges.completion_mode` or `required_task_count` change. On first transition to complete it inserts; on regression (admin edited tasks, player no longer qualifies) it deletes and writes an audit-log entry.

Markdown bodies allow inline images and links via Supabase Storage; we'll render with `react-markdown` + `remark-gfm` and run DOMPurify on the output. If we later adopt Tiptap for WYSIWYG, we can migrate by converting Markdown → Tiptap JSON without a schema change (add a parallel column, migrate rows, drop the old one).

### Leaderboards
- **`leaderboards`** — `id`, `team_id`, `name`, `description`, `kind` (`points` | `standalone`), `starts_at` (nullable), `ends_at` (nullable), `sort_order` (`desc` default; `asc` for things like fastest time), `unit` (string for standalone, e.g. `"shots"`), `status` (`active` | `archived`), `archived_at` (nullable), `deleted_at`.
- **`leaderboard_entries`** — for standalone leaderboards only. `id`, `leaderboard_id`, `user_id`, `value` (numeric), `updated_at`. Unique on (`leaderboard_id`, `user_id`).
- **`leaderboard_snapshots`** — `id`, `leaderboard_id`, `user_id`, `value` (numeric), `rank` (int), `archived_at`. Written when a points-leaderboard is archived (either manually by an admin or by cron when `ends_at` passes). After archival, leaderboard views read from snapshots — later edits to historical `challenge_completions` do not retroactively rewrite history.
- Points leaderboards are **derived** from `challenge_completions` while active: we filter on `completed_at BETWEEN leaderboard.starts_at AND COALESCE(leaderboard.ends_at, now())`. After archival the snapshot is the source of truth.
- **Late-arriving completions:** if a player's `challenge_completions` row is created after the period's `ends_at` (e.g. admin corrected a mistake), it's still counted in the next active period whose range covers `completed_at`, and logged for admin visibility. A daily job reconciles stragglers.
- Visibility rule: entries with `value = 0` are hidden from everyone except the entry's owner and team admins. Ties share rank (dense rank). Display order for ties is deterministic: earliest `updated_at` / `completed_at`, then `display_name` ascending as a final tiebreaker.
- Archived past-period leaderboards stay readable in a "history" section via their snapshots.

### Themes & customization
- **`themes`** — seeded table: `id`, `name`, `preview_image_path`, `tokens` (jsonb: palette + font pairing). Token shape is defined by a zod schema (`lib/themes/schema.ts`); `supabase/seed.sql` inserts are validated by a Node script before commit. Client code reads tokens through the same zod schema so missing keys surface as build/test failures, not runtime crashes.
- Team settings store `theme_id`, `logo_path`, `header_image_path`, optional `accent_color` override.
- Start with ~5 curated themes. No free-form color pickers.

### Notifications & audit
- **`notification_preferences`** — one row per (`user_id`, `team_id`). Columns: `email_new_challenge` (default on), `email_leaderboard_passed` (default off), `push_*` equivalents. A team-specific row is created by trigger when a user's membership becomes `active`, copying the current global defaults. This avoids CASE-expression "team override → global fallback → default" lookups on every send; each notification send just reads the one relevant row.
- **`notifications`** — in-app notification feed: `id`, `user_id`, `kind`, `payload` (jsonb), `read_at`, `created_at`.
- **`audit_log`** — `id`, `actor_user_id`, `team_id` (nullable), `action`, `target_type`, `target_id`, `details` (jsonb), `created_at`. Written on every approval, edit, deletion, role change, invite rotation, invite use (success + fail), roster export, and completion recompute that changes state. Append-only (no update/delete policy).

### Soft deletes — applied from day zero
Every user-visible table in this schema has a `deleted_at timestamptz null` column from the first migration. Default queries filter on `deleted_at is null`; admin views can include deleted rows. This is a Phase 0 chore baked into the migration and into a small `softDelete()` / `withDeleted()` helper — retrofitting later would mean auditing every query and every RLS policy.

---

## 3. Row-Level Security (the short version)

RLS is enforced in Postgres, so even a compromised client can't bypass it.

- `app_users`: user reads own row; super-admin reads all.
- `memberships`: user reads their own; team-admins read their teams'; super-admin reads all.
- `team_invites`: team-admins of the team read/write; anyone can `select` a single invite by code (via RPC) without enumerating — the RPC is rate-limited and logs failed attempts.
- `profiles`: user reads their own; team members read approved profiles in teams they belong to, respecting `visibility` (non-admins see the name form dictated by `visibility`); team-admins read full data (incl. pending) in their teams.
- `challenges` / `tasks` / `challenge_audience`: active members of any audience team read; team-admins of any audience team write. Reads use `is_team_member_of_any(challenge_id)` helper.
- `task_progress`: user writes own row; team-admins of any audience team can update any.
- `challenge_completions`: readable by team members via audience join; writes are restricted to the `recompute_completion` function (SECURITY DEFINER).
- `leaderboards` / `leaderboard_entries` / `leaderboard_snapshots`: active members read; `value = 0` entries filtered unless owner or team-admin; team-admins write. Snapshots are written only by the archive job and are immutable to clients.
- `audit_log`: team-admins read their team's entries; super-admin reads all; nobody updates/deletes (no `UPDATE`/`DELETE` policies at all).

Supabase helper functions `is_team_admin(team_id)`, `is_team_member(team_id)`, and `is_team_member_of_any(challenge_id)` keep policies short.

---

## 4. Key flows

### Sign-up / onboarding
1. New user logs in with Google or email/password → Supabase creates `auth.users` row → trigger inserts `app_users` row.
2. User has no memberships → lands on `/onboarding` with two choices:
   - **Join a team** — enter invite code + display name (+ optional jersey #, pronouns, picture). Code is resolved via a rate-limited RPC that checks `expires_at`, `max_uses`, and `revoked_at`; failures log to `audit_log`. On success, creates `memberships` (status=pending, `invite_id` set) and `profiles` (approved=false). Team-admins notified.
   - **Request a team** — enter proposed team name. Creates `team_creation_requests`. Super-admin notified.
3. Team-admin approves membership → `memberships.status=active`, `profiles.approved=true`, `team_invites.uses_count += 1` in a single transaction. Audit-log entry written. User receives notification.
4. Super-admin approves team request → creates `teams` row, makes requester a `team_admin` member (status=active, profile flow still applies).

### Orphaned teams
- Trigger on `memberships` fires `AFTER INSERT OR UPDATE OR DELETE`. It re-counts active team_admin rows for the affected team — it does NOT look only at the row being changed. If count = 0, `teams.status = 'orphaned'` and all super-admins are notified.
- Admin `status='pending'` does not count as active for this check (new team creation: requester gets status=active on team creation; profile approval is independent and doesn't block orphan math).
- Super-admin UI shows a list of orphaned teams with "promote an existing active player to team-admin" and "assign myself as team-admin" actions.

### Super-admin recovery
- Seed creates two super-admin accounts on day zero. `docs/admin-recovery.md` documents the SQL to re-flag a user (run via Supabase dashboard SQL editor) if both are ever lost.
- A DB trigger prevents demoting the last active super-admin; a matching trigger prevents soft-deletion of the last active super-admin's `app_users` row.
- A weekly cron job emails super-admins "you are still a super-admin on <site>" so dormant accounts don't silently go stale.

### Invites
- Invites live in `team_invites`. Team-admins create any number of codes, each with optional `expires_at` and `max_uses`. Default for UI: 7-day expiry, 1 use (can be overridden).
- Revoking an invite sets `revoked_at`; active code lookups filter on `revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now()) AND (max_uses IS NULL OR uses_count < max_uses)`.
- Every use attempt (success + fail) writes to `audit_log` with IP and user-agent hash. Sustained failures from one IP are rate-limited in middleware.

### Profile edits
- Player edits profile → writes `profile_change_requests`. Profile continues showing approved values. Admin queue shows diff. On approve → apply to `profiles`, audit log. On reject → discard with optional note.

### Challenge self-report
- Task page shows progress bar and +/- controls (or a "mark complete" button for target_count=1).
- Player submits count → `task_progress` upserted.
- `recompute_completion(challenge_id, user_id)` runs: it walks the challenge's (non-deleted) tasks, checks the `completion_mode` + `required_task_count`, and upserts or deletes the `challenge_completions` row accordingly. Running the same function for **every** mutation path means editing a live challenge (adding a task, changing `required_task_count`, deleting a task) correctly recomputes every affected player — no drift.
- `challenge_completions.points_awarded` is set on insert from the current `completion_points` + sum of completed task points; if the admin later changes `completion_points`, existing completions are re-evaluated only on the next state-changing event for that player (we choose this over retroactive rewrites so leaderboards feel stable). The admin UI surfaces "this edit will not change existing completions — click 'recalculate' to rewrite" for explicit bulk recompute.
- Points flow automatically into any overlapping *active* points-leaderboard (archived ones are read from snapshots).

### Recurring challenges
- A daily pg_cron job looks at challenges with `recurrence != 'none'` and clones them at period boundaries (new `starts_at`/`ends_at`, `parent_challenge_id` set, `status='published'`). Completions and progress are scoped per instance, so leaderboards reset correctly each period.

### Leaderboard archival
- pg_cron job runs daily: for every leaderboard with `ends_at < now()` and `status='active'`, compute final ranked standings (with the deterministic tiebreaker) and write them to `leaderboard_snapshots`, then set `status='archived'` and `archived_at=now()`. After this, leaderboard views read snapshots, not live completions. A manual "archive now" button is available to team-admins.
- Late completions that arrive after archival are logged to `audit_log` with a surfaced admin notification but do not mutate snapshots.

### Notifications
- "New challenge published" → email + in-app (on by default).
- "Someone passed you on a leaderboard" → in-app always; email opt-in only.
- "Approval needed" → in-app to all team-admins of the team, plus email to any admin with that pref on.

### Default team
- If user has ≥1 active membership, root route redirects to `/t/<default_team_slug>`.
- Profile settings page lets user change `app_users.default_team_id`.

---

## 5. Pages

Public / auth:
- `/` — marketing-ish landing + login buttons
- `/login`, `/signup`, `/auth/callback`

Onboarding:
- `/onboarding` — join-with-code OR request-team
- `/onboarding/pending` — shown while membership/team request is pending

Team scope (`/t/:slug/...`):
- `/t/:slug` — team home (themed, shows latest challenges, leaderboard snippets)
- `/t/:slug/challenges` — list
- `/t/:slug/challenges/:id` — rich-text instructions + task list + progress controls
- `/t/:slug/leaderboards` — list
- `/t/:slug/leaderboards/:id` — full leaderboard + history
- `/t/:slug/members` — roster (team-admin sees all + pending; players see active)

Team-admin tools:
- `/t/:slug/admin/challenges` — CRUD
- `/t/:slug/admin/leaderboards` — CRUD
- `/t/:slug/admin/approvals` — membership + profile change queue
- `/t/:slug/admin/settings` — theme, logo, header, invite code rotation
- `/t/:slug/admin/audit` — audit log

User scope:
- `/profile` — profile per team + default team selector
- `/settings/notifications` — notification prefs
- `/settings/data` — export / delete my data (if we add it — see phasing)

Super-admin:
- `/admin` — overview
- `/admin/teams` — all teams, including orphaned
- `/admin/team-requests` — pending team creation requests
- `/admin/users` — user lookup

---

## 6. Phased build order

### Phase 0 — Foundations (~1.5 weeks)
- Next.js + Tailwind + shadcn/ui scaffold
- Supabase project; Google OAuth + email/password enabled
- Base schema + RLS: `app_users`, `teams`, `team_invites`, `memberships`, `team_creation_requests`, `profiles` (with `visibility` + `pronouns`), `audit_log`. **All tables include `deleted_at` from the first migration.**
- Two super-admin seed accounts + last-super-admin protection trigger
- Sign-up / login / logout
- Onboarding: join with invite code (expiring / max-use invites), request team
- Super-admin approval UI for team requests; orphaned-teams list
- Team-admin approval UI for memberships + first-time profile; invite management (create/revoke)
- Minimal team landing page (unthemed)
- One Playwright happy-path test covering: signup → apply via invite → admin approve → land on team page
- Deployed to Vercel behind a simple domain (Vercel's free `.vercel.app` is fine for now)

**Exit criteria:** You can create an invite, a guardian uses it, you approve, they see a team page. An expired or revoked invite is rejected. Orphaning a team notifies super-admins.

### Phase 1 — Challenges & Leaderboards (~2 weeks)
- `challenges`, `challenge_audience`, `tasks`, `task_progress`, `challenge_completions`, `leaderboards`, `leaderboard_entries`, `leaderboard_snapshots` schemas + RLS
- Challenge CRUD (team-admin) with **Markdown** body (react-markdown + GFM + DOMPurify) and image upload to Supabase Storage
- Task CRUD with target counts and optional points
- `recompute_completion()` function wired to every mutation path; regression-deletes and audit entries on edits
- Player self-report UI (progress counter)
- Standalone leaderboard CRUD + player value entry
- Points leaderboard (derived view while active)
- Archive snapshot job + manual archive button
- Visibility rule (>0 to appear; owner and admins always see themselves), dense rank for ties, deterministic tiebreaker display order
- Start/end dates honored in leaderboard filtering; `publish_at` honored for challenges
- Playwright happy-path: admin creates challenge → player logs progress → challenge completes → points appear on leaderboard → admin archives → snapshot persists

**Exit criteria:** A team-admin can publish a challenge and a standalone leaderboard, a player can self-report and see points show up. Editing a live challenge's tasks updates completions without desync.

### Phase 2 — Profiles, themes, mobile polish (~1 week)
- Jersey number and extra fields already in schema; add UI + profile change request flow (edits)
- 5 seeded themes validated by zod schema + theme picker, logo + header upload
- Visibility changes surfaced in the same approval queue as name/picture
- Default team selection, sidebar team switcher
- Mobile-first pass on every page
- PWA manifest + service worker so it installs on phones and feels native
- Playwright happy-path: edit profile → admin approves → new name/picture visible; swap themes

**Exit criteria:** Page is themed, installable as a PWA, and comfortable to use on a phone. Profile edits require approval; visibility respected on rosters and leaderboards.

### Phase 3 — Notifications, audit UI, recurring, data rights (~1.5 weeks)
- `notification_preferences` per (user, team) — trigger-populated on membership activation
- Email templates via Resend (new challenge, approval needed, leaderboard passed opt-in, orphaned team, weekly super-admin still-alive ping)
- In-app notification feed
- Audit log UI for team-admins; immutable view only
- Recurring challenge scheduler (pg_cron) with `parent_challenge_id` link visible in admin UI
- Leaderboard archive cron + late-completion admin notifications
- Soft-delete undelete UI in admin (column is already there from Phase 0)
- `/settings/data`: guardian-initiated "download my kid's data" (JSON) and "delete my kid's data" (soft-delete + queue hard-delete after 30-day grace)
- Playwright happy-path: opt into leaderboard-passed email → another player overtakes → email delivered; export data

**Exit criteria:** Team runs mostly on autopilot; admins get notified when they need to act; guardians can self-serve export/delete; nothing is unrecoverable within grace period.

### Phase 4 — Later / nice-to-haves
- Tiptap WYSIWYG editor (migrate Markdown → Tiptap JSON with parallel column)
- Global / cross-team challenges + leaderboards (no schema rewrite — `challenge_audience` is already in place from Phase 1)
- Apple / Microsoft / other logins
- Parental consent flow (only needed if opened beyond teams you personally coach and minors self-register)
- Native app via Capacitor wrapping the PWA (only if PWA proves insufficient)

---

## 7. Open questions / decisions to revisit later

1. **Age handling:** since guardians sign up and manage the profile, we sidestep COPPA/GDPR-K for now. Revisit if we ever let kids sign up directly.
2. **Moderation on embedded media:** team-admins approve profiles but challenge content is authored by team-admins themselves. If we ever let players post content, we'll need a review flow there too.
3. **Image uploads size/format:** plan to auto-resize on upload (sharp in a Next.js route handler) — avoids 20MB phone photos for avatars. Profile pictures are also scanned for obviously-inappropriate content via a cheap filter before admin approval (stretch; manual approval is the primary control).
4. **Roster export auditing:** any team-admin CSV export of the roster writes an `audit_log` entry (who, when). Decide later whether to notify guardians on export.
5. **Backup/export of the DB:** Supabase has daily backups on paid plans; on free tier we should take a weekly `pg_dump` into a private bucket for safety.
6. **Analytics:** Vercel Analytics free tier is enough if you want to see how the site is used; skip otherwise.
7. **When to adopt Tiptap:** Markdown is sufficient for MVP. If coaches struggle writing Markdown (surveys after Phase 1), move Tiptap up the priority list.

---

## 8. Summary

The stack is Next.js + Supabase + Vercel, deployed straight from GitHub, costing $0/month for the foreseeable future. The data model keeps users, teams, and memberships separate so any user can play any role in any team; `challenge_audience` keeps cross-team challenges a layer-on rather than a rewrite. Super-admin is one global flag, with at-least-two enforcement and a documented recovery path. Challenges and tasks support partial progress, optional points, two completion modes, `publish_at`, start/end dates, and recurrence — all driven by a single `recompute_completion()` function so edits never desync. Leaderboards come in two flavors, hide zero-scorers, share rank on ties with deterministic display order, and snapshot on archive so history stays stable. Profiles are per-team, default to first-name-only with no picture, and require admin approval for changes. Invites are per-team rows with expiry + max-uses + revocation. Themes are curated, zod-validated, not free-form. Notifications are per-team rows populated on activation. Audit log is append-only. Soft deletes exist from day zero.

Build plan is four phases; the first two get you to a usable MVP (auth → onboarding → challenges → leaderboards). Phase 3 rounds out autopilot and data rights. Everything in Phase 4 is additive, not a rewrite.
