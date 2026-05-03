# Deployment

Two environments, both auto-deployed:

| Branch | Vercel deploy   | Supabase project    |
| ------ | --------------- | ------------------- |
| `main` | Production      | hockeychallenge     |
| `dev`  | Preview (alias) | hockeychallenge-dev |

Day-to-day: push to `dev` to ship to dev, merge `dev` → `main` to ship to prod. Migrations follow the code — a push that adds a migration runs it automatically against the matching environment via [.github/workflows/migrate.yml](.github/workflows/migrate.yml).

## First-time setup

1. **Create the dev Supabase project**
   - Free tier, same org as prod.
   - Name suggestion: `hockeychallenge-dev`.
   - Note the project ref (Settings → General → Reference ID).
   - Set a DB password (Settings → Database → Reset database password). Save it.

2. **Set DB password on prod too**
   - Same place as above. Save it.

3. **Create a Supabase access token**
   - https://supabase.com/dashboard/account/tokens
   - This is for the CLI in GitHub Actions. Save it.

4. **Add 5 GitHub secrets**
   - Repo Settings → Secrets and variables → Actions → New repository secret:
     - `SUPABASE_ACCESS_TOKEN`
     - `SUPABASE_PROD_PROJECT_REF`
     - `SUPABASE_PROD_DB_PASSWORD`
     - `SUPABASE_DEV_PROJECT_REF`
     - `SUPABASE_DEV_DB_PASSWORD`

5. **Import the repo into Vercel**
   - https://vercel.com/new → import `mnystr/hockeychallenge`.
   - Production branch: `main`.
   - Don't deploy yet — env vars are set in the next step.

6. **Vercel env vars** (per environment)
   - Production: prod Supabase URL + anon key + service-role key.
   - Preview: dev Supabase URL + anon key + service-role key.
   - Both need `NEXT_PUBLIC_SITE_URL` matching the deploy's URL.
   - (Once `dev` is set up I'll wire these via the Vercel MCP — you don't paste them by hand.)

7. **First migration runs**
   - Once secrets exist, push a no-op commit to `dev` to trigger the workflow. It links the dev Supabase project and applies all 15 migrations.
   - Merge `dev` → `main` to do the same on prod.

## Day-to-day

- **Make a change** → push to `dev` → Vercel deploys it; if migrations changed, they run on dev too.
- **Promote** → merge `dev` → `main` (or open PR `dev` → `main`).
- **Hotfix** directly on `main` is allowed; remember to back-merge to `dev` after.

## Rehearsing a prod deploy

Before merging `dev` → `main`, you can prove the pending migrations work against prod-shaped data:

```sh
cp .env.rehearse.example .env.rehearse
# fill in the values from the Supabase dashboard
npm run rehearse-prod-deploy -- --i-mean-it
```

This:

1. Wipes the dev Supabase project.
2. Copies prod's full state to dev (schema + data + auth users + storage files).
3. Applies pending migrations on dev — exactly what will happen to prod after the merge.

If the script succeeds and the dev URL looks healthy, the prod merge is safe.

**Requirements:** `pg_dump` and `psql` (PostgreSQL 17+ client tools) on PATH. See the comment block at the top of [scripts/rehearse-prod-deploy.mjs](scripts/rehearse-prod-deploy.mjs) for install commands.

**Caveats:**

- Free-tier Supabase projects pause after ~1 week idle. If a rehearsal hits a paused dev project, unpause it from the dashboard first.
- The script copies real prod user PII to dev. The dev project's service-role key is in `.env.rehearse` (gitignored) — keep that file off shared machines.
- Free tier is 500 MB DB + 1 GB storage. If prod outgrows that, the script will need a sampling step.

## Rotating secrets

- **DB passwords**: reset in the Supabase dashboard, then update `SUPABASE_*_DB_PASSWORD` in GitHub secrets and `.env.rehearse`.
- **Access token**: revoke at https://supabase.com/dashboard/account/tokens, create a new one, update `SUPABASE_ACCESS_TOKEN` in GitHub secrets.
- **Service-role keys**: rotated in Supabase dashboard → Settings → API. Update Vercel env vars and `.env.rehearse`.

## Troubleshooting

- **"Failed to push migrations"** in CI — check the run log. Typical causes: DB password wrong (rotate + update secret), or a migration genuinely fails (fix in the migration file, push again).
- **Dev project paused** — visit the Supabase dashboard for the dev project; it'll prompt to restore. Then retry the failing CI run via "Re-run jobs".
- **Vercel build fails on Next.js 16** — check `node_modules/next/dist/docs/` for breaking-change notes (per AGENTS.md, Next 16 in this repo has divergence from upstream training data).
