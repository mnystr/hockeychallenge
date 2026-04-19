import { createClient } from "@/lib/supabase/server";
import { themeTokensSchema, type ThemeTokens } from "@/lib/themes/schema";

/**
 * Wraps every route under /t/[slug]/* with the team's selected theme's
 * CSS custom properties, so components inside can reference
 * var(--theme-primary), var(--theme-accent), etc.
 */
export default async function TeamLayout({
  params,
  children,
}: {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  // Don't redirect or throw here — child pages may already require auth.
  // We just try to load the theme for visual decoration.
  const { data: team } = await supabase
    .from("teams")
    .select("theme:theme_id(tokens)")
    .eq("slug", slug)
    .maybeSingle();

  const nestedTokens = (team?.theme as unknown as { tokens: unknown } | null)
    ?.tokens;
  const parsed = nestedTokens ? themeTokensSchema.safeParse(nestedTokens) : null;
  const tokens: ThemeTokens | null = parsed?.success ? parsed.data : null;

  const style = tokens
    ? ({
        ["--theme-primary" as string]: tokens.palette.primary,
        ["--theme-secondary" as string]: tokens.palette.secondary,
        ["--theme-accent" as string]: tokens.palette.accent,
        ["--theme-bg" as string]: tokens.palette.bg,
        ["--theme-fg" as string]: tokens.palette.fg,
      } as React.CSSProperties)
    : undefined;

  return (
    <div style={style} className="team-theme-scope">
      {children}
    </div>
  );
}
