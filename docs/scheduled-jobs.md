# Scheduled jobs

The app has two functions that want to run on a cron:

| Function | What it does | Suggested schedule |
|---|---|---|
| `archive_expired_leaderboards()` | Snapshots and archives any active leaderboard whose `ends_at` has passed | hourly |
| `process_recurring_challenges()` | Clones published challenges with `recurrence IN ('weekly', 'monthly')` past their `ends_at`, creating a successor with fresh `starts_at` / `ends_at` and cloned tasks | hourly |

Both are idempotent. Running them every 5 minutes is safe — they'll just
no-op on rows that have already been processed.

## Local dev

They are NOT scheduled by default. Run manually from Studio's SQL editor,
or via `npx supabase db query`:

```sql
select archive_expired_leaderboards();
select process_recurring_challenges();
```

## Supabase cloud

Enable `pg_cron` (Dashboard → Database → Extensions), then in the SQL editor:

```sql
-- Hourly
select cron.schedule(
  'archive-expired-leaderboards',
  '0 * * * *',
  'select public.archive_expired_leaderboards();'
);

select cron.schedule(
  'process-recurring-challenges',
  '15 * * * *',
  'select public.process_recurring_challenges();'
);
```

Staggering the two by 15 minutes keeps them from competing for locks.

To pause: `select cron.unschedule('job-name');`
