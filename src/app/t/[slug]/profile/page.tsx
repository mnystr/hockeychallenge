import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProfileEditForm from "./edit-form";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: team } = await supabase
    .from("teams")
    .select("id, name")
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle();
  if (!team) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, display_name, jersey_number, pronouns, visibility, approved",
    )
    .eq("user_id", user.id)
    .eq("team_id", team.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!profile) {
    // No profile on this team — you're not a member (yet).
    redirect(`/t/${slug}`);
  }

  const { data: pending } = await supabase
    .from("profile_change_requests")
    .select(
      "id, proposed_display_name, proposed_jersey_number, proposed_pronouns, proposed_visibility, created_at",
    )
    .eq("profile_id", profile.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .maybeSingle();

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href={`/t/${slug}`}
        className="mb-2 inline-block text-sm text-blue-600 hover:underline"
      >
        ← {team.name}
      </Link>
      <h1 className="mb-6 text-3xl font-bold">Your profile</h1>

      {pending && (
        <section className="mb-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Pending changes</p>
          <p className="mt-1 text-amber-800">
            Submitted {new Date(pending.created_at).toLocaleString()}. These
            will appear after a team admin approves:
          </p>
          <ul className="mt-2 list-disc pl-5 text-xs">
            {pending.proposed_display_name && (
              <li>Name → {pending.proposed_display_name}</li>
            )}
            {pending.proposed_jersey_number !== null && (
              <li>Jersey → #{pending.proposed_jersey_number}</li>
            )}
            {pending.proposed_pronouns && (
              <li>Pronouns → {pending.proposed_pronouns}</li>
            )}
            {pending.proposed_visibility && (
              <li>Visibility → {pending.proposed_visibility.replace("_", " ")}</li>
            )}
          </ul>
        </section>
      )}

      <ProfileEditForm
        slug={slug}
        profile={{
          id: profile.id,
          display_name: profile.display_name,
          jersey_number: profile.jersey_number,
          pronouns: profile.pronouns,
          visibility: profile.visibility,
        }}
      />
    </main>
  );
}
