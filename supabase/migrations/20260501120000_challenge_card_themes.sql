-- Adds an optional preset card-theme to challenges so admins can pick a
-- visual identity (gradient + accent) per challenge. Tokens for each
-- preset live in the frontend (globals.css); this column just stores
-- the chosen preset name. NULL = use the team's --ui-primary/accent.
--
-- Kept as a text column with a CHECK constraint instead of a Postgres
-- enum so we can add or rename presets without ALTER TYPE migrations.

alter table challenges
  add column if not exists card_theme text null;

-- Drop-and-recreate the constraint so this migration is re-runnable
-- if the preset list grows later.
alter table challenges
  drop constraint if exists challenges_card_theme_valid;

alter table challenges
  add constraint challenges_card_theme_valid
  check (
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
  );
