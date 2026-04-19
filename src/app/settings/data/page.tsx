import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DeleteAccountForm from "./delete-form";

export default async function DataSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href="/"
        className="mb-2 inline-block text-sm text-blue-600 hover:underline"
      >
        ← Home
      </Link>
      <h1 className="mb-6 text-3xl font-bold">Your data</h1>

      <section className="mb-10 rounded-md border border-gray-200 p-4">
        <h2 className="mb-2 text-lg font-semibold">Download</h2>
        <p className="mb-4 text-sm text-gray-600">
          Your profile, memberships, progress, completions, leaderboard
          entries, notifications, and preferences as a single JSON file.
        </p>
        <a
          href="/settings/data/export"
          className="inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          download
        >
          Download my data
        </a>
      </section>

      <section className="rounded-md border border-red-200 p-4">
        <h2 className="mb-2 text-lg font-semibold text-red-800">
          Delete account
        </h2>
        <p className="mb-4 text-sm text-red-700">
          Marks your account, memberships, and profiles as deleted across
          every team. Your progress and past leaderboard entries stay in
          place so teammates&apos; rankings don&apos;t shuffle mid-period.
          This cannot be undone from the app — contact a super-admin if you
          need to recover.
        </p>
        <DeleteAccountForm />
      </section>
    </main>
  );
}
