import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function TeamPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS ensures the user can only see teams they're a member of.
  const { data: team } = await supabase
    .from("teams")
    .select("id, name, slug")
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle();

  if (!team) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-bold">{team.name}</h1>
      <p className="mt-2 text-sm text-gray-500">
        Team home placeholder — challenges and leaderboards land here in Phase 1.
      </p>
      <form action="/logout" method="post" className="mt-8">
        <button
          type="submit"
          className="text-sm text-gray-500 hover:text-gray-700 hover:underline"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}
