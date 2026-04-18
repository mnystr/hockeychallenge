import { test, expect } from "@playwright/test";

/**
 * Phase 1 happy path.
 *
 * Flow:
 *   1. Admin creates a published challenge with one task worth 10 pts.
 *   2. Admin creates an active points leaderboard.
 *   3. Guardian signs up + applies via DEMO-INVITE.
 *   4. Admin approves.
 *   5. Guardian marks the task done. Challenge auto-completes.
 *   6. Guardian sees themselves at rank 1 with 10 pts on the leaderboard.
 *   7. Admin archives the leaderboard.
 *   8. Board moves to History with the standings preserved.
 *
 * Re-runnable: names include Date.now() so multiple runs don't collide.
 */
test("admin creates challenge + leaderboard → player completes → archive preserves snapshot", async ({
  browser,
}) => {
  const nonce = Date.now();
  const challengeTitle = `Shot practice ${nonce}`;
  const leaderboardName = `Summer points ${nonce}`;
  const taskTitle = `Wrist shots ${nonce}`;
  const guardianEmail = `guardian+p1-${nonce}@example.com`;
  const guardianPassword = "password123";
  const displayName = `Phase1 Kid ${nonce}`;

  // === Admin: create challenge, task, publish, create leaderboard ===
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();

  await admin.goto("/login");
  await admin.getByLabel("Email").fill("admin1@example.com");
  await admin.getByLabel("Password").fill("password123");
  await admin.getByRole("button", { name: "Sign in" }).click();
  await admin.waitForURL("**/t/test-squad");

  // Create a draft challenge.
  await admin.goto("/t/test-squad/admin/challenges");
  await admin.getByRole("button", { name: "New challenge" }).click();
  await admin.waitForURL(/\/t\/test-squad\/admin\/challenges\/[0-9a-f-]+$/);
  const challengeUrl = admin.url();

  // Fill in title and save.
  await admin.getByLabel("Title").fill(challengeTitle);
  await admin.getByRole("button", { name: "Save" }).click();
  await expect(admin.getByText("Saved.")).toBeVisible();

  // Add one task with target 1, 10 points.
  await admin.getByLabel("Title").last().fill(taskTitle);
  await admin.getByLabel("Target count").fill("1");
  await admin.getByLabel("Points (optional)").fill("10");
  await admin.getByRole("button", { name: "Add task" }).click();
  await expect(admin.getByText(taskTitle)).toBeVisible();

  // Publish the challenge.
  await admin.getByRole("button", { name: "Publish" }).click();
  await expect(admin.getByRole("button", { name: "Unpublish" })).toBeVisible();

  // Create a leaderboard.
  await admin.goto("/t/test-squad/admin/leaderboards/new");
  await admin.getByLabel("Name").fill(leaderboardName);
  // Defaults: kind=points, sort=desc. That's what we want.
  await admin.getByRole("button", { name: "Create" }).click();
  await admin.waitForURL(/\/t\/test-squad\/admin\/leaderboards\/[0-9a-f-]+$/);
  const leaderboardAdminUrl = admin.url();
  const leaderboardId = leaderboardAdminUrl.split("/").pop()!;

  // === Guardian: sign up + apply ===
  const guardianCtx = await browser.newContext();
  const guardian = await guardianCtx.newPage();
  await guardian.goto("/login");
  await guardian.getByRole("button", { name: "Create one" }).click();
  await guardian.getByLabel("Email").fill(guardianEmail);
  await guardian.getByLabel("Password").fill(guardianPassword);
  await guardian.getByRole("button", { name: "Create account" }).click();
  await guardian.waitForURL("**/onboarding");

  await guardian.getByLabel("Invite code").fill("DEMO-INVITE");
  await guardian.getByLabel("Display name").fill(displayName);
  await guardian.getByRole("button", { name: "Apply to join" }).click();
  await guardian.waitForURL("**/onboarding/pending");

  // === Admin: approve ===
  await admin.goto("/t/test-squad/admin/approvals");
  const pendingRow = admin.locator("li").filter({ hasText: displayName });
  await pendingRow.getByRole("button", { name: "Approve" }).click();
  await expect(pendingRow).toHaveCount(0);

  // === Guardian: reload, mark task done ===
  await guardian.goto("/t/test-squad/challenges");
  await guardian.getByRole("link", { name: challengeTitle }).click();
  await guardian.waitForURL(/\/t\/test-squad\/challenges\/[0-9a-f-]+$/);

  // target_count=1 → a "Mark done" button exists.
  await guardian.getByRole("button", { name: "Mark done" }).click();
  // After completion the banner appears.
  await expect(guardian.getByText(/Completed .* · 10 pts/)).toBeVisible();

  // === Guardian: see themselves on leaderboard ===
  await guardian.goto(`/t/test-squad/leaderboards/${leaderboardId}`);
  // The list includes "(you)" and "10" in the guardian's row.
  const youRow = guardian.locator("li").filter({ hasText: "(you)" });
  await expect(youRow).toContainText(displayName);
  await expect(youRow).toContainText("10");

  // === Admin: archive the leaderboard ===
  await admin.goto(leaderboardAdminUrl);
  await admin.getByRole("button", { name: "Archive" }).click();
  await expect(admin.getByText("archived")).toBeVisible();

  // === Verify snapshot survives: it now appears under History ===
  await guardian.goto("/t/test-squad/leaderboards");
  await expect(guardian.getByRole("heading", { name: "History" })).toBeVisible();
  // The archived board is in the History section.
  const historySection = guardian
    .locator("section")
    .filter({ has: guardian.getByRole("heading", { name: "History" }) });
  await expect(historySection.getByText(leaderboardName)).toBeVisible();

  // Standings are preserved.
  await guardian.goto(`/t/test-squad/leaderboards/${leaderboardId}`);
  const archivedYouRow = guardian.locator("li").filter({ hasText: "(you)" });
  await expect(archivedYouRow).toContainText(displayName);
  await expect(archivedYouRow).toContainText("10");

  await guardianCtx.close();
  await adminCtx.close();
});
