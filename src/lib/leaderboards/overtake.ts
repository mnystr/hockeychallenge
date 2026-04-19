import { createServiceClient } from "@/lib/supabase/service";
import { emailLeaderboardPassed } from "@/lib/email/events";

type StandingsRow = { leaderboard_id: string; user_id: string; rank: number };

/**
 * Fetch current rank-by-user for every active leaderboard that could be
 * affected by a mutation by `teamId`. Uses the service client so RLS
 * doesn't hide other users' rows from the actor.
 */
export async function snapshotStandings(
  teamId: string,
): Promise<Map<string, Map<string, number>>> {
  const admin = createServiceClient();
  const { data } = await admin
    .from("leaderboard_active_standings")
    .select("leaderboard_id, user_id, rank")
    .eq("team_id", teamId);

  const byBoard = new Map<string, Map<string, number>>();
  for (const row of (data ?? []) as StandingsRow[]) {
    let inner = byBoard.get(row.leaderboard_id);
    if (!inner) {
      inner = new Map();
      byBoard.set(row.leaderboard_id, inner);
    }
    inner.set(row.user_id, row.rank);
  }
  return byBoard;
}

/**
 * Compare before/after snapshots for `teamId`'s active leaderboards and
 * fire in-app notifications + emails for users overtaken by `actorUserId`.
 * Missing-from-before or missing-from-after users are treated as
 * transitioning in/out of the board (covered conservatively: if actor's
 * new rank < someone else's old rank (who is still on the board), that
 * user got passed).
 */
export async function notifyOvertakes(params: {
  teamId: string;
  teamSlug: string;
  actorUserId: string;
  before: Map<string, Map<string, number>>;
}): Promise<void> {
  try {
    const after = await snapshotStandings(params.teamId);
    const admin = createServiceClient();

    for (const [boardId, afterMap] of after.entries()) {
      const beforeMap = params.before.get(boardId) ?? new Map();
      const actorNew = afterMap.get(params.actorUserId);
      if (actorNew == null) continue;
      const actorOld = beforeMap.get(params.actorUserId) ?? Number.MAX_SAFE_INTEGER;
      if (actorNew >= actorOld) continue; // actor did not move up

      // Anyone whose old rank is in [actorNew, actorOld) and who is still on
      // the board (so they can be notified meaningfully) was passed.
      const passed: string[] = [];
      for (const [uid, oldRank] of beforeMap.entries()) {
        if (uid === params.actorUserId) continue;
        if (oldRank >= actorNew && oldRank < actorOld && afterMap.has(uid)) {
          passed.push(uid);
        }
      }
      if (passed.length === 0) continue;

      const { data: board } = await admin
        .from("leaderboards")
        .select("name")
        .eq("id", boardId)
        .maybeSingle();
      const leaderboardName = board?.name ?? "a leaderboard";

      // Only notify users who have in_app_leaderboard_passed enabled for
      // that team. The preferences row is per (user, team).
      const { data: prefs } = await admin
        .from("notification_preferences")
        .select("user_id")
        .eq("team_id", params.teamId)
        .eq("in_app_leaderboard_passed", true)
        .in("user_id", passed);
      const inAppRecipients = (prefs ?? []).map((p) => p.user_id);
      if (inAppRecipients.length > 0) {
        await admin.from("notifications").insert(
          inAppRecipients.map((user_id) => ({
            user_id,
            kind: "leaderboard_passed",
            payload: {
              leaderboard_id: boardId,
              team_id: params.teamId,
              team_slug: params.teamSlug,
              leaderboard_name: leaderboardName,
              by_user_id: params.actorUserId,
            },
          })),
        );
      }

      await emailLeaderboardPassed({
        leaderboardId: boardId,
        teamId: params.teamId,
        teamSlug: params.teamSlug,
        leaderboardName,
        passedUserIds: passed,
      });
    }
  } catch (err) {
    console.error("[leaderboards] notifyOvertakes failed:", err);
  }
}
