# Youth Hockey Challenge Platform — Plan

A website where youth hockey teams run off-season training challenges and leaderboards. Guardians sign up and manage a profile representing their kid. One-to-two teams in practice; architected so more can join later.

---

## 1. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 15 (App Router, TypeScript)** | One codebase for UI + API, server components, huge ecosystem. |
| Styling | **Tailwind CSS + shadcn/ui** | Fast, themable, accessible components out of the box. |
| Backend + Auth + DB | **Supabase** (Postgres, Auth, Storage, Realtime) | Google OAuth + email/password with zero backend code. Row-Level Security enforces roles at the DB. Free tier covers this app easily. |
| Rich text (challenge instructions) | **Tiptap** | Clean editor, supports embedded images/videos, outputs JSON we store in Postgres. |
| Forms / validation | **react-hook-form + zod** | Type-safe forms shared between client and server. |
| Email | **Resend** | 3k emails/month free, React email templates. |
| Scheduler (recurring challenges) | **Vercel Cron** or **Supabase pg_cron** | Either works; Vercel Cron is simpler. |
| Hosting | **Vercel (Hobby tier)** | Git push → deployed. Zero ops. |
| Error monitoring (optional) | Sentry free tier | Nice to have. |

**Cost for MVP: $0/month.** Free tiers cover a few teams comfortably.

**Deployment flow (meets "easy to host/update"):**
1. Push to GitHub → Vercel auto-deploys preview (PR) and production (main).
2. Supabase migrations via `supabase` CLI committed to repo; applied with `supabase db push`.
3. Environment variables (Supabase URL/keys, Resend key) set once in Vercel dashboard.

---

## 2. Data model

Supabase Auth owns the `auth.users` table. Everything below lives in our schema and references `auth.users.id`.

### Core identity
- **`app_users`** — extends `auth.users`. Columns: `id` (pk, fk auth.users), `is_super_admin` (bool), `default_team_id` (nullable fk), `created_at`.
- **`teams`** — `id`, `name`, `slug`, `invite_code` (rotatable), `status` (`active` | `orphaned` | `archived`), `theme_id`, `logo_url`, `header_image_url`, `accent_color` (optional override), `created_by`, `created_at`, `deleted_at`.
- **`memberships`** — many-to-many between users and teams. `id`, `user_id`, `team_id`, `role` (`team_admin` | `player`), `status` (`pending` | `active` | `removed`), `approved_by`, `approved_at`, `created_at`. Unique on (`user_id`, `team_id`).
- **`team_creation_requests`** — `id`, `requested_by`, `proposed_name`, `status`, `reviewed_by`, `reviewed_at`, `created_at`.

Super-admin is a global flag on `app_users`. Team-admin and player are roles inside `memberships`. Any user can hold memberships in multiple teams at once with any mix of roles.

### Profiles (per team)
- **`profiles`** — `id`, `user_id`, `team_id`, `display_name`, `profile_picture_url`, `jersey_number`, plus room-to-grow fields (`position`, `birth_year`). `approved` (bool), `created_at`, `updated_at`. Unique on (`user_id`, `team_id`).
- **`profile_change_requests`** — holds the proposed new values while waiting for team-admin approval. First-time setup is submitted with the membership application and approved together.

### Challenges
- **`challenges`** — `id`, `team_id`, `title`, `description_json` (Tiptap rich text), `completion_points` (nullable), `completion_mode` (`all_tasks` | `x_of_y`), `required_task_count` (int, used for `x_of_y`), `starts_at` (nullable), `ends_at` (nullable), `recurrence` (`none` | `weekly` | `monthly`), `status` (`draft` | `published` | `archived`), `created_by`, `created_at`, `updated_at`, `deleted_at`.
- **`tasks`** — `id`, `challenge_id`, `title`, `description_json`, `points` (nullable), `target_count` (default 1, used for partial-progress tasks like "do 100 shots"), `position`, `deleted_at`.
- **`task_progress`** — `id`, `task_id`, `user_id`, `count` (int), `completed` (derived: `count >= target_count`), `updated_at`. Unique on (`task_id`, `user_id`). Players self-report; team-admins can edit.
- **`challenge_completions`** — written when a player hits the completion condition. `id`, `challenge_id`, `user_id`, `completed_at`, `points_awarded`. Unique on (`challenge_id`, `user_id`).

Rich-text `description_json` allows embedded images and videos uploaded to Supabase Storage — this gives the blog-like instruction pages you wanted without a separate CMS.

### Leaderboards
- **`leaderboards`** — `id`, `team_id`, `name`, `description`, `kind` (`points` | `standalone`), `starts_at` (nullable), `ends_at` (nullable), `sort_order` (`desc` default; `asc` for things like fastest time), `unit` (string for standalone, e.g. `"shots"`), `status` (`active` | `archived`), `deleted_at`.
- **`leaderboard_entries`** — for standalone leaderboards only. `id`, `leaderboard_id`, `user_id`, `value` (numeric), `updated_at`. Unique on (`leaderboard_id`, `user_id`).
- Points leaderboards are **derived** from `challenge_completions` filtered by the leaderboard's date range — no duplicated storage.
- Visibility rule: entries with `value = 0` are hidden from everyone except the entry's owner and team admins. Ties share rank (dense rank).
- Archived past-period leaderboards stay readable in a "history" section.

### Themes & customization
- **`themes`** — seeded table: `id`, `name`, `preview_image_url`, `tokens` (jsonb: palette + font pairing).
- Team settings store `theme_id`, `logo_url`, `header_image_url`, optional `accent_color` override.
- Start with ~5 curated themes. No free-form color pickers.

### Notifications & audit
- **`notification_preferences`** — `user_id`, `team_id` (nullable → global), `email_new_challenge` (default on), `email_leaderboard_passed` (default off, opt-in), `push_*` equivalents.
- **`notifications`** — in-app notification feed: `id`, `user_id`, `kind`, `payload` (jsonb), `read_at`, `created_at`.
- **`audit_log`** — `id`, `actor_user_id`, `team_id` (nullable), `action`, `target_type`, `target_id`, `details` (jsonb), `created_at`. Written whenever approvals, edits, deletions, role changes, or invite-code rotations happen.

### Soft deletes
Every user-visible table gets a `deleted_at timestamp null` column. Queries filter on `deleted_at is null` by default; admin views can include deleted rows.

---

## 3. Row-Level Security (the short version)

RLS is enforced in Postgres, so even a compromised client can't bypass it.

- `app_users`: user reads own row; super-admin reads all.
- `memberships`: user reads their own; team-admins read their teams'; super-admin reads all.
- `profiles`: user reads their own; team members read approved profiles in teams they belong to; team-admins read all (incl. pending) in their teams.
- `challenges` / `tasks`: active members of the team read; team-admins write.
- `task_progress`: user writes own row; team-admins of the challenge's team can update any.
- `challenge_completions`: readable by team members; written by trigger when conditions met.
- `leaderboards` / `leaderboard_entries`: active members read; `value = 0` entries filtered unless owner or team-admin; team-admins write.
- `audit_log`: team-admins read their team's entries; super-admin reads all; nobody updates/deletes.

Supabase helper functions like `is_team_admin(team_id)` and `is_team_member(team_id)` keep policies short.

---

## 4. Key flows

### Sign-up / onboarding
1. New user logs in with Google or email/password → Supabase creates `auth.users` row → trigger inserts `app_users` row.
2. User has no memberships → lands on `/onboarding` with two choices:
   - **Join a team** — enter invite code + display name (+ optional jersey #, picture). Creates `memberships` (status=pending) and `profiles` (approved=false). Team-admins notified.
   - **Request a team** — enter proposed team name. Creates `team_creation_requests`. Super-admin notified.
3. Team-admin approves membership → `memberships.status=active`, `profiles.approved=true` in a single transaction. Audit-log entry written. User receives notification.
4. Super-admin approves team request → creates `teams` row, makes requester a `team_admin` member (status=active, profile flow still applies).

### Orphaned teams
- If the last active team-admin's role changes or membership goes inactive, a trigger sets `teams.status = 'orphaned'` and enqueues a notification to all super-admins.
- Super-admin UI shows a list of orphaned teams with a "promote user to team-admin" action.

### Invite codes
- One active code per team. Team-admin can rotate (old code stops working immediately). Optionally disable code entirely (requires admin to enable/send new one).

### Profile edits
- Player edits profile → writes `profile_change_requests`. Profile continues showing approved values. Admin queue shows diff. On approve → apply to `profiles`, audit log. On reject → discard with optional note.

### Challenge self-report
- Task page shows progress bar and +/- controls (or a "mark complete" button for target_count=1).
- Player submits count → `task_progress` upserted.
- Trigger recomputes whether the whole challenge is complete (all tasks OR x-of-y depending on mode); if so, insert `challenge_completions` with `points_awarded`.
- Points flow automatically into any overlapping points-leaderboard.

### Recurring challenges
- A daily cron job looks at challenges with `recurrence != 'none'` and clones them for the new period (new start/end). Completions and progress are scoped to the instance, so leaderboards reset correctly each period.

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

### Phase 0 — Foundations (~1 week)
- Next.js + Tailwind + shadcn/ui scaffold
- Supabase project; Google OAuth + email/password enabled
- Base schema + RLS: `app_users`, `teams`, `memberships`, `team_creation_requests`, `profiles`, `audit_log`
- Sign-up / login / logout
- Onboarding: join with invite code, request team
- Super-admin approval UI for team requests
- Team-admin approval UI for memberships + first-time profile
- Minimal team landing page (unthemed)
- Deployed to Vercel behind a simple domain (Vercel's free `.vercel.app` is fine for now)

**Exit criteria:** You can invite a guardian, they sign up, apply, you approve, they see a team page.

### Phase 1 — Challenges & Leaderboards (~2 weeks)
- Challenge CRUD (team-admin) — including Tiptap rich-text editor with image upload to Supabase Storage
- Task CRUD with target counts and optional points
- Completion modes (`all_tasks`, `x_of_y`) with server-side computation via triggers
- Player self-report UI (progress counter)
- Standalone leaderboard CRUD + player value entry
- Points leaderboard (derived view)
- Visibility rule (>0 to appear; owner and admins always see themselves), dense rank for ties
- Start/end dates honored in leaderboard filtering

**Exit criteria:** A team-admin can publish a challenge and a standalone leaderboard, a player can self-report and see points show up on the leaderboard.

### Phase 2 — Profiles, themes, mobile polish (~1 week)
- Jersey number and extra fields
- Profile change request flow (edits)
- 5 seeded themes + theme picker, logo + header upload
- Default team selection, sidebar team switcher
- Mobile-first pass on every page
- PWA manifest + service worker so it installs on phones and feels native

**Exit criteria:** Page is themed, installable as a PWA, and comfortable to use on a phone.

### Phase 3 — Notifications, audit, soft deletes, recurring (~1 week)
- Notification preferences
- Email templates via Resend (new challenge, approval needed, leaderboard passed opt-in)
- In-app notification feed
- Audit log UI for team-admins
- Recurring challenge scheduler (Vercel Cron)
- Soft deletes wired up with undelete in admin UI

**Exit criteria:** Team runs mostly on autopilot; admins get notified when they need to act; nothing is unrecoverable.

### Phase 4 — Later / nice-to-haves
- Data export / delete (GDPR) — attempt automated flow in this phase; if not trivial, defer
- Global / cross-team challenges + leaderboards
- Apple / Microsoft / other logins
- Parental consent flow (only needed if opened beyond teams you personally coach and minors self-register)
- Native app via Capacitor wrapping the PWA (only if PWA proves insufficient)

---

## 7. Open questions / decisions to revisit later

1. **Age handling:** since guardians sign up and manage the profile, we sidestep COPPA/GDPR-K for now. Revisit if we ever let kids sign up directly.
2. **Moderation on embedded media:** team-admins approve profiles but challenge content is authored by team-admins themselves. If we ever let players post content, we'll need a review flow there too.
3. **Image uploads size/format:** plan to auto-resize on upload (sharp in a Next.js route handler) — avoids 20MB phone photos for avatars.
4. **Backup/export of the DB:** Supabase has daily backups on paid plans; on free tier we should take a weekly `pg_dump` into a private bucket for safety.
5. **Analytics:** Vercel Analytics free tier is enough if you want to see how the site is used; skip otherwise.

---

## 8. Summary

The stack is Next.js + Supabase + Vercel, deployed straight from GitHub, costing $0/month for the foreseeable future. The data model keeps users, teams, and memberships separate so any user can play any role in any team. Super-admin is one global flag. Challenges and tasks support partial progress, optional points, two completion modes, and optional start/end dates with recurrence. Leaderboards come in two flavors, hide zero-scorers, share rank on ties, and archive per period. Profiles are per-team and require admin approval. Themes are curated, not free-form. Notifications, audit log, and soft deletes round out safety for a youth context.

Build plan is four roughly-week-sized phases; the first two get you to a usable MVP (auth → onboarding → challenges → leaderboards). Everything else is layered on top without schema rewrites.
