import { NextResponse, type NextRequest } from "next/server";
import { requireTeamAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

function csvEscape(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  let ctx;
  try {
    ctx = await requireTeamAdmin(slug);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg === "unauthorized" ? 401 : 403;
    return new NextResponse(msg, { status });
  }

  const supabase = await createClient();
  const [{ data: profiles }, { data: memberships }] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "user_id, display_name, jersey_number, visibility, approved",
      )
      .eq("team_id", ctx.teamId)
      .is("deleted_at", null),
    supabase
      .from("memberships")
      .select("user_id, role, status, created_at, approved_at")
      .eq("team_id", ctx.teamId)
      .is("deleted_at", null),
  ]);

  // Emails need the Auth admin endpoint.
  const admin = createServiceClient();
  const userIds = (profiles ?? []).map((p) => p.user_id);
  const emailByUser = new Map<string, string>();
  for (const uid of userIds) {
    const { data } = await admin.auth.admin.getUserById(uid);
    if (data?.user?.email) emailByUser.set(uid, data.user.email);
  }

  const roleByUser = new Map<
    string,
    { role: string; status: string; created_at: string; approved_at: string | null }
  >();
  for (const m of memberships ?? []) {
    roleByUser.set(m.user_id, {
      role: m.role,
      status: m.status,
      created_at: m.created_at,
      approved_at: m.approved_at,
    });
  }

  const header = [
    "display_name",
    "jersey_number",
    "visibility",
    "role",
    "status",
    "approved",
    "email",
    "joined_at",
    "approved_at",
  ];

  const rows = (profiles ?? [])
    .filter((p) => roleByUser.get(p.user_id)?.status === "active")
    .sort((a, b) => a.display_name.localeCompare(b.display_name))
    .map((p) => {
      const m = roleByUser.get(p.user_id);
      return [
        p.display_name,
        p.jersey_number ?? "",
        p.visibility,
        m?.role ?? "",
        m?.status ?? "",
        p.approved ? "true" : "false",
        emailByUser.get(p.user_id) ?? "",
        m?.created_at ?? "",
        m?.approved_at ?? "",
      ];
    });

  const body = [header, ...rows]
    .map((r) => r.map(csvEscape).join(","))
    .join("\r\n");

  // Audit-log the export. Service client bypasses RLS on audit_log.
  await admin.from("audit_log").insert({
    actor_user_id: ctx.userId,
    team_id: ctx.teamId,
    action: "roster.exported",
    target_type: "team",
    target_id: ctx.teamId,
    details: { row_count: rows.length },
  });

  const filename = `${slug}-roster-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
