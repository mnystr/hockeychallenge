-- Team-creation request: requester real name.
-- The form already collects role + motivation, but super-admins also need
-- a human-readable name (and the requester's email, looked up at review
-- time) to judge the request and follow up by email.
--
-- Nullable so existing pending rows aren't blocked by a backfill; new
-- requests enforce non-empty at the application layer.

alter table team_creation_requests
  add column if not exists requested_by_name text;
