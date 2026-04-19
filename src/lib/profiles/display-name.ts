export type Visibility = "full" | "first_name_only" | "initials";

/**
 * Transform a stored display_name according to the profile's visibility
 * preference. Team-admins and owners should bypass this (they see the
 * full name).
 *
 * Examples (name "Alex Nystrom"):
 *   full              -> "Alex Nystrom"
 *   first_name_only   -> "Alex N."
 *   initials          -> "A.N."
 *
 * Single-name edge case (no space): first-name-only returns the name
 * as-is; initials returns a single initial + dot ("A.").
 */
export function renderDisplayName(
  name: string | null | undefined,
  visibility: Visibility,
): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "Pending";

  if (visibility === "full") return trimmed;

  const parts = trimmed.split(/\s+/);
  const first = parts[0];
  const rest = parts.slice(1);

  if (visibility === "first_name_only") {
    if (rest.length === 0) return first;
    const initial = rest[rest.length - 1].charAt(0).toUpperCase();
    return `${first} ${initial}.`;
  }

  // initials
  const initials = parts
    .map((p) => p.charAt(0).toUpperCase())
    .join(".");
  return `${initials}.`;
}
