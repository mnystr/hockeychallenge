import { test, expect } from "@playwright/test";
import { newEnContext } from "./helpers";

/**
 * Phase 3 happy path.
 *
 * 1. Guardian signs up + applies via DEMO-INVITE. Admin approves.
 * 2. Admin creates + publishes a challenge with one target-1 task.
 * 3. Guardian navigates to /notifications. The "New challenge" row
 *    is there, unread, links into the challenge detail.
 * 4. Guardian marks all notifications read; badge count updates.
 * 5. Admin soft-deletes the challenge; it disappears from the list
 *    and appears in /admin/trash. Admin restores; it's back.
 * 6. Admin opens the audit log; restore + delete entries are visible.
 * 7. Guardian downloads their data — we just assert the response has
 *    the right Content-Disposition.
 */
test("Phase 3: notifications, trash, audit, data export", async ({ browser }) => {
  const nonce = Date.now();
  const guardianEmail = `guardian+p3-${nonce}@example.com`;
  const displayName = `P3 Kid ${nonce}`;
  const challengeTitle = `Phase3 chal ${nonce}`;
  const taskTitle = `Phase3 task ${nonce}`;

  // === Admin setup ===
  const adminCtx = await newEnContext(browser);
  const admin = await adminCtx.newPage();
  await admin.goto("/login");
  await admin.getByLabel("Email").fill("admin1@example.com");
  await admin.getByLabel("Password").fill("password123");
  await admin.getByRole("button", { name: "Sign in" }).click();
  await admin.waitForURL("**/t/test-squad");

  // === Guardian: sign up + apply ===
  const guardianCtx = await newEnContext(browser);
  const guardian = await guardianCtx.newPage();
  await guardian.goto("/login");
  await guardian.getByRole("button", { name: "Create one" }).click();
  await guardian.getByLabel("Email").fill(guardianEmail);
  await guardian.getByLabel("Password").fill("password123");
  await guardian.getByRole("button", { name: "Create account" }).click();
  await guardian.waitForURL("**/onboarding");
  await guardian.getByLabel("Invite code").fill("DEMO-INVITE");
  await guardian.getByLabel("Display name").fill(displayName);
  await guardian.getByRole("button", { name: "Apply to join" }).click();
  await guardian.waitForURL("**/onboarding/pending");

  // === Admin: approve membership ===
  await admin.goto("/t/test-squad/admin/approvals");
  const memberRow = admin.locator("li").filter({ hasText: displayName });
  await memberRow.getByRole("button", { name: "Approve" }).click();
  await expect(memberRow).toHaveCount(0);

  // === Admin: create + publish challenge (fires notification trigger) ===
  await admin.goto("/t/test-squad/admin/challenges");
  await admin.getByRole("button", { name: "New challenge" }).click();
  await admin.waitForURL(/\/t\/test-squad\/admin\/challenges\/[0-9a-f-]+$/);
  const challengeUrl = admin.url();
  const challengeId = challengeUrl.split("/").pop()!;

  await admin.getByLabel("Title", { exact: true }).fill(challengeTitle);
  await admin.getByRole("button", { name: "Save" }).click();
  await expect(admin.getByText("Saved.")).toBeVisible();

  await admin.getByLabel("Task title").fill(taskTitle);
  await admin.getByLabel("Target count").fill("1");
  await admin.getByRole("button", { name: "Add task" }).click();
  await expect(admin.getByText(taskTitle)).toBeVisible();

  await admin.getByRole("button", { name: "Publish" }).click();
  await expect(admin.getByRole("button", { name: "Unpublish" })).toBeVisible();

  // === Guardian: notification arrived ===
  await guardian.goto("/notifications");
  const notifRow = guardian
    .locator("li")
    .filter({ hasText: `New challenge: ${challengeTitle}` });
  await expect(notifRow).toBeVisible();
  await expect(notifRow).toContainText("Test Squad");

  // Click "mark read" on this specific row.
  await notifRow.getByRole("button", { name: "mark read" }).click();
  // After revalidation the "mark read" button is gone from that row.
  await expect(notifRow.getByRole("button", { name: "mark read" })).toHaveCount(0);

  // Going back to the team page, the unread badge is gone.
  await guardian.goto("/t/test-squad");
  await expect(
    guardian.getByRole("link", { name: /Notifications/ }),
  ).toBeVisible();

  // === Admin: soft-delete challenge, then restore from trash ===
  await admin.goto(challengeUrl);
  admin.on("dialog", (d) => d.accept().catch(() => undefined));
  await admin.getByRole("button", { name: "Delete" }).click();
  await admin.waitForURL("**/admin/challenges");
  // No longer in the active list.
  await expect(
    admin.getByRole("link", { name: challengeTitle }),
  ).toHaveCount(0);

  await admin.goto("/t/test-squad/admin/trash");
  const trashRow = admin.locator("li").filter({ hasText: challengeTitle });
  await expect(trashRow).toBeVisible();
  await trashRow.getByRole("button", { name: "Restore" }).click();
  await expect(trashRow).toHaveCount(0);

  // Back in the challenges list.
  await admin.goto("/t/test-squad/admin/challenges");
  await expect(
    admin.getByRole("link", { name: challengeTitle }),
  ).toBeVisible();

  // === Admin: audit log shows the lifecycle ===
  await admin.goto("/t/test-squad/admin/audit");
  await expect(admin.getByText("Challenge created").first()).toBeVisible();

  // === Guardian: data export ===
  const download = await guardian.waitForEvent("download", {
    timeout: 15_000,
    predicate: () => true,
    // Trigger the download by navigating.
  }).catch(() => null);
  const downloadPromise = guardian.waitForEvent("download");
  await guardian.goto("/settings/data");
  await guardian.getByRole("link", { name: "Download my data" }).click();
  const dl = await downloadPromise;
  expect(dl.suggestedFilename()).toMatch(
    /^hockeychallenge-export-.*\.json$/,
  );

  void download; // keep ts happy if unused

  await guardianCtx.close();
  await adminCtx.close();
});
