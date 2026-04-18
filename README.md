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

## Deploying (later)

Production deployment isn't wired up yet. When we're ready, the steps will be:

1. **Supabase cloud project** — create a new project at <https://supabase.com>.
   Copy the project ref, URL, and anon/service-role keys.
2. **Link the local project:**
   ```bash
   npx supabase link --project-ref <ref>
   npx supabase db push     # applies local migrations to cloud
   ```
3. **Google OAuth** — create credentials in Google Cloud Console, paste into
   the Supabase dashboard (Authentication → Providers → Google).
4. **Vercel** — import the GitHub repo, set `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` in Project
   Settings → Environment Variables. Push to `main` to deploy.

Seed data is local-only — on the cloud, you'll bootstrap the first super-admin
via `docs/admin-recovery.md`.

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
