import { test, expect } from "@playwright/test";

/**
 * Phase 2 happy path.
 *
 * - Admin swaps themes and sees the "(current)" marker move.
 * - Guardian signs up, applies with DEMO-INVITE using an initial name.
 * - Admin approves.
 * - Guardian edits their profile (new name + new visibility) and sees a
 *   pending-changes banner.
 * - Admin approves the profile change.
 * - Guardian reloads: banner gone, new name is visible on the profile page.
 *
 * Visibility-rendered names on a second viewer are not covered here —
 * that would need a second player account beyond our seeded one.
 */
test("theme swap + profile edit → admin approves → new name visible", async ({
  browser,
}) => {
  const nonce = Date.now();
  const guardianEmail = `guardian+p2-${nonce}@example.com`;
  const initialName = `P2 Initial ${nonce}`;
  const updatedName = `P2 Updated ${nonce}`;

  // === Admin: swap theme ===
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();

  await admin.goto("/login");
  await admin.getByLabel("Email").fill("admin1@example.com");
  await admin.getByLabel("Password").fill("password123");
  await admin.getByRole("button", { name: "Sign in" }).click();
  await admin.waitForURL("**/t/test-squad");

  await admin.goto("/t/test-squad/admin/settings");
  // Pick a theme that isn't the seed default ("Classic Ice").
  const target = admin
    .getByRole("button")
    .filter({ hasText: "Midnight Rink" });
  await target.click();
  await admin.waitForLoadState("networkidle");

  // After the POST the page reloads and "Midnight Rink" now carries "(current)".
  await expect(
    admin.getByRole("button").filter({ hasText: "Midnight Rink (current)" }),
  ).toBeVisible();

  // === Guardian: sign up + apply ===
  const guardianCtx = await browser.newContext();
  const guardian = await guardianCtx.newPage();
  await guardian.goto("/login");
  await guardian.getByRole("button", { name: "Create one" }).click();
  await guardian.getByLabel("Email").fill(guardianEmail);
  await guardian.getByLabel("Password").fill("password123");
  await guardian.getByRole("button", { name: "Create account" }).click();
  await guardian.waitForURL("**/onboarding");

  await guardian.getByLabel("Invite code").fill("DEMO-INVITE");
  await guardian.getByLabel("Display name").fill(initialName);
  await guardian.getByRole("button", { name: "Apply to join" }).click();
  await guardian.waitForURL("**/onboarding/pending");

  // === Admin: approve membership ===
  await admin.goto("/t/test-squad/admin/approvals");
  const memberRow = admin.locator("li").filter({ hasText: initialName });
  await memberRow.getByRole("button", { name: "Approve" }).click();
  await expect(memberRow).toHaveCount(0);

  // === Guardian: edit profile ===
  await guardian.goto("/t/test-squad/profile");
  await guardian.getByLabel("Display name").fill(updatedName);
  await guardian
    .getByLabel("Visibility to teammates")
    .selectOption("first_name_only");
  await guardian
    .getByRole("button", { name: "Submit changes for approval" })
    .click();
  await expect(guardian.getByText("Submitted for approval.")).toBeVisible();
  // Pending banner is visible on reload.
  await guardian.reload();
  await expect(
    guardian.getByRole("heading", { name: "Pending changes" }).or(
      // Next.js may render the heading as a <p> with font-semibold, so
      // fall back to text.
      guardian.getByText("Pending changes"),
    ),
  ).toBeVisible();
  await expect(guardian.getByText(`Name → ${updatedName}`)).toBeVisible();

  // === Admin: approve the profile change ===
  await admin.goto("/t/test-squad/admin/approvals");
  const changeRow = admin
    .locator("li")
    .filter({ hasText: initialName })
    .filter({ hasText: updatedName });
  await changeRow.getByRole("button", { name: "Approve" }).click();
  await expect(changeRow).toHaveCount(0);

  // === Guardian: reload, new name applied ===
  await guardian.goto("/t/test-squad/profile");
  await expect(guardian.getByLabel("Display name")).toHaveValue(updatedName);
  // Pending banner gone.
  await expect(guardian.getByText("Pending changes")).toHaveCount(0);

  await guardianCtx.close();
  await adminCtx.close();
});
