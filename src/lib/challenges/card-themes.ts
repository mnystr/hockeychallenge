// Preset card-theme names recognised by both the schema (for validation
// against the DB CHECK constraint) and the UI (for swatches + the
// challenge-card data-theme attribute). Keep in sync with the SQL
// constraint in 20260501120000_challenge_card_themes.sql.

export const CHALLENGE_CARD_THEMES = [
  "aurora",
  "inferno",
  "glacier",
  "forest",
  "sunset",
  "lightning",
  "royal",
  "ocean",
] as const;

export type ChallengeCardTheme = (typeof CHALLENGE_CARD_THEMES)[number];

export function isChallengeCardTheme(v: unknown): v is ChallengeCardTheme {
  return (
    typeof v === "string" &&
    (CHALLENGE_CARD_THEMES as readonly string[]).includes(v)
  );
}
