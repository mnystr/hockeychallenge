import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireTeamAdmin } from "@/lib/auth/session";
import { themeTokensSchema } from "@/lib/themes/schema";
import { setTeamTheme } from "./actions";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let ctx;
  try {
    ctx = await requireTeamAdmin(slug);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "unauthorized") redirect("/login");
    if (msg === "team not found") notFound();
    redirect(`/t/${slug}`);
  }

  const supabase = await createClient();
  const { data: team } = await supabase
    .from("teams")
    .select("theme_id")
    .eq("id", ctx.teamId)
    .maybeSingle();

  const { data: themes } = await supabase
    .from("themes")
    .select("id, name, tokens")
    .order("name", { ascending: true });

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link
        href={`/t/${slug}/admin`}
        className="mb-2 inline-block text-sm text-blue-600 hover:underline"
      >
        ← Admin
      </Link>
      <h1 className="mb-6 text-3xl font-bold">Settings</h1>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Theme</h2>
        <p className="mb-4 text-sm text-gray-500">
          Colors and fonts applied to the team pages. Admins always see the
          default styling.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {(themes ?? []).map((t) => {
            const parsed = themeTokensSchema.safeParse(t.tokens);
            if (!parsed.success) return null;
            const tokens = parsed.data;
            const selected = team?.theme_id === t.id;
            return (
              <form
                key={t.id}
                action={async () => {
                  "use server";
                  await setTeamTheme(slug, t.id);
                }}
              >
                <button
                  type="submit"
                  className={`flex w-full flex-col gap-2 rounded-md border p-4 text-left hover:bg-gray-50 ${
                    selected ? "border-blue-500 ring-1 ring-blue-500" : "border-gray-200"
                  }`}
                >
                  <span className="font-semibold">
                    {t.name}
                    {selected && (
                      <span className="ml-2 text-xs font-normal text-blue-600">
                        (current)
                      </span>
                    )}
                  </span>
                  <div className="flex gap-1">
                    {(
                      [
                        tokens.palette.primary,
                        tokens.palette.secondary,
                        tokens.palette.accent,
                        tokens.palette.bg,
                        tokens.palette.fg,
                      ] as const
                    ).map((c) => (
                      <span
                        key={c}
                        className="h-8 w-8 rounded-md border border-gray-200"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </button>
              </form>
            );
          })}
        </div>
      </section>
    </main>
  );
}
