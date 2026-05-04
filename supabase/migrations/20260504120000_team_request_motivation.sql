-- Team-creation request: motivation fields.
-- Onboarding asks the requester for their role on the team (coach,
-- team leader, parent, ...) and an optional free-text note. Both help
-- super-admins triage incoming requests.

alter table team_creation_requests
  add column if not exists requester_role text,
  add column if not exists request_note text;
