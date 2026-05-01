-- Mirror challenge card themes onto leaderboards so admins can give each
-- board a distinct visual identity in the list. Same preset list as
-- challenges.card_theme; tokens live in globals.css. NULL = team colors.

alter table leaderboards
  add column if not exists card_theme text null;

alter table leaderboards
  drop constraint if exists leaderboards_card_theme_valid;

alter table leaderboards
  add constraint leaderboards_card_theme_valid
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
