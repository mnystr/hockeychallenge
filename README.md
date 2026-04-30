# hockeychallenge

Off-season training challenges and leaderboards for youth hockey teams.

Stack: Next.js 16 + Supabase + Vercel. See [PLAN.md](./PLAN.md) for the full design.

## Local development

You need:
- Node 20+ (tested on 22)
- Docker (for the local Supabase stack)
- `npx supabase` is vendored via npm — no global install needed

### First-time setup

```bash
# 1. Install Node deps.
npm install

# 2. Start the local Supabase stack (Postgres + Auth + Storage + Studio).
#    First run pulls Docker images — takes a few minutes.
npx supabase start

# 3. Apply migrations and run the seed script.
#    `supabase start` does this automatically on a fresh DB. If you need
#    to reset later:
npx supabase db reset

# 4. Copy env vars. `supabase start` prints the anon + service role keys;
#    paste them into .env.local.
cp .env.example .env.local

# 5. Run the Next.js dev server.
npm run dev
```

The app is at <http://localhost:3000>. Supabase Studio (DB browser) is at
<http://localhost:54323>.

### Seed accounts

- `admin1@example.com` / `password123` — super-admin
- `admin2@example.com` / `password123` — super-admin
- Demo team "Test Squad" with open invite code `DEMO-INVITE`

The app enforces a minimum of two super-admins; see
[`docs/admin-recovery.md`](./docs/admin-recovery.md) for the escape hatch.

## Useful commands

```bash
npm run dev              # Next.js dev server
npm run build            # production build
npm run lint             # eslint
npm run e2e              # run Playwright tests (needs browsers installed, see below)
npm run e2e:install      # one-time: install Chromium for Playwright
npx supabase status      # show local stack URLs + keys
npx supabase db reset    # drop and recreate local DB, reapply migrations + seed
npx supabase migration new <name>   # create a new timestamped migration
```

## End-to-end tests

The Phase 0 happy path (signup → apply with invite → admin approves →
team page) lives in `e2e/phase0.spec.ts`.

```bash
# One-time: install Chromium
npm run e2e:install

# Make sure the local Supabase stack is running and seeded
npx supabase start

# Then run the test. Playwright will start the Next.js dev server
# automatically via playwright.config.ts.
npm run e2e
```

The test uses a unique `guardian+<timestamp>@example.com` each run, so it
can be re-run without resetting the DB. If the test gets stuck in a weird
state (rare), `npx supabase db reset` restores the seeded baseline.

## Deploying

Target stack: **Supabase cloud** for Postgres + Auth + Storage, **Vercel** for
Next.js. Free tiers cover a couple of youth teams.

### 1. Supabase cloud project

1. Create a project at <https://supabase.com>. Pick a region close to your
   users and save the database password somewhere safe (Supabase only shows
   it once).
2. Grab the project ref (in the URL: `https://supabase.com/dashboard/project/<ref>`)
   and, from **Project Settings → API**, the Project URL, the Publishable
   (anon) key, and the Secret (service role) key.
3. From your local repo, link and push migrations:
   ```bash
   npx supabase login         # opens a browser to authenticate
   npx supabase link --project-ref <ref>
   npx supabase db push       # applies every migration in supabase/migrations
   ```
   `db push` does **not** run `seed.sql` — that's local-only. You bootstrap
   production admins via [`docs/admin-recovery.md`](./docs/admin-recovery.md).

### 2. Google OAuth (optional but recommended)

1. Google Cloud Console → APIs & Services → Credentials → Create OAuth 2.0
   Client ID → Web application.
2. Authorized redirect URIs: `https://<ref>.supabase.co/auth/v1/callback`
3. In Supabase dashboard → Authentication → Providers → Google, paste the
   Client ID and Secret.
4. Authentication → URL Configuration → Site URL: set to your production
   domain (e.g. `https://hockey.example.com`). Add any additional redirect
   URLs you use for previews (`https://*.vercel.app/**`).

### 3. Scheduled jobs (optional — needed for recurring challenges + auto archive)

See [`docs/scheduled-jobs.md`](./docs/scheduled-jobs.md). Takes two SQL
statements in Supabase Studio once the project is up.

### 3b. Media storage

The `20260419120000_phase3_media_storage.sql` migration creates a `media`
bucket and locks client-side writes. Profile pictures + team logos + team
header images are uploaded through server actions that resize with `sharp`
and write via the service-role key — no extra setup is required in the
dashboard as long as `SUPABASE_SERVICE_ROLE_KEY` is set (see below).

### 4. Vercel

1. Import the GitHub repo at <https://vercel.com/new>. Root directory is the
   repo root, framework preset Next.js — no changes needed.
2. Environment Variables (set for Production + Preview):

   | Key | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL from step 1 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable key |
   | `SUPABASE_SERVICE_ROLE_KEY` | Secret key (server-only) |
   | `NEXT_PUBLIC_SITE_URL` | Your Vercel/custom domain URL |
   | `RESEND_API_KEY` | From <https://resend.com> (optional — emails are skipped without it) |
   | `EMAIL_FROM` | e.g. `"hockey <noreply@yourdomain.com>"` (optional) |
3. Push to `main` — Vercel builds and deploys on every commit.

### 5. First super-admin

The seed doesn't run in production. Instead:

1. Sign up through the app like any user.
2. Use the Supabase Studio SQL editor to run the promotion SQL from
   [`docs/admin-recovery.md`](./docs/admin-recovery.md#re-flag-an-existing-user-as-super-admin)
   twice — once for yourself, once for a co-admin (the app enforces a
   minimum of two super-admins).

### 6. Optional: custom domain

In Vercel → Project → Settings → Domains, add your domain and follow the
DNS instructions. Update `NEXT_PUBLIC_SITE_URL` to match. If you use Google
OAuth, also add the domain to the Google Cloud authorized redirect URIs
**and** to Supabase Authentication → URL Configuration.

## Project layout

```
src/
  app/                # Next.js App Router pages
  lib/
    supabase/         # Supabase client helpers (server + browser)
    themes/           # Theme token schema + helpers
supabase/
  config.toml         # Supabase CLI config
  migrations/         # SQL migrations, timestamped
  seed.sql            # Local dev seed (not run in production)
docs/                 # Runbook-style docs (admin-recovery, etc.)
```
