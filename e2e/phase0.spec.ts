import { test, expect } from "@playwright/test";
import { newEnContext } from "./helpers";

/**
 * Phase 0 happy path.
 *
 * Covers the full onboarding flow end-to-end:
 *   1. A new guardian signs up with email + password.
 *   2. They apply to the seeded "Test Squad" team using the DEMO-INVITE
 *      code with a display name.
 *   3. They land on the pending state.
 *   4. The seeded super-admin (admin1@example.com) signs in in a separate
 *      browser context, opens the approvals queue, and approves.
 *   5. The guardian refreshes and is redirected to the team page.
 *
 * Prerequisites (run on your machine before this test):
 *   - `npx supabase start` (Docker must be running)
 *   - .env.local populated with the local Supabase URL + anon key
 *     (see `npx supabase status` output)
 *   - The seed applied (happens automatically on a fresh `supabase start`)
 */
test("signup → apply → admin approves → team page", async ({ browser }) => {
  const guardianEmail = `guardian+${Date.now()}@example.com`;
  const guardianPassword = "password123";
  const displayName = `E2E Kid ${Date.now()}`;

  // === Guardian: sign up, apply to team ===
  const guardianCtx = await newEnContext(browser);
  const guardian = await guardianCtx.newPage();

  await guardian.goto("/login");
  // Toggle to sign-up mode.
  await guardian.getByRole("button", { name: "Create one" }).click();
  await guardian.getByLabel("Email").fill(guardianEmail);
  await guardian.getByLabel("Password").fill(guardianPassword);
  await guardian.getByRole("button", { name: "Create account" }).click();

  // Lands on /onboarding because they have no memberships yet.
  await guardian.waitForURL("**/onboarding");

  // Apply with the seeded invite code.
  await guardian.getByLabel("Invite code").fill("DEMO-INVITE");
  await guardian.getByLabel("Display name").fill(displayName);
  await guardian.getByRole("button", { name: "Apply to join" }).click();

  await guardian.waitForURL("**/onboarding/pending");
  await expect(
    guardian.getByRole("heading", { name: "Almost there" }),
  ).toBeVisible();

  // === Admin: sign in, approve the pending membership ===
  const adminCtx = await newEnContext(browser);
  const admin = await adminCtx.newPage();

  await admin.goto("/login");
  await admin.getByLabel("Email").fill("admin1@example.com");
  await admin.getByLabel("Password").fill("password123");
  await admin.getByRole("button", { name: "Sign in" }).click();

  // admin1 is a team_admin of Test Squad, so they land on the team page.
  await admin.waitForURL("**/t/test-squad");

  await admin.goto("/t/test-squad/admin/approvals");
  await expect(admin.getByText(displayName)).toBeVisible();

  // Approve the row matching our guardian.
  const row = admin
    .locator("li")
    .filter({ hasText: displayName });
  await row.getByRole("button", { name: "Approve" }).click();

  // The row disappears from the pending list.
  await expect(row).toHaveCount(0);

  // === Guardian: reload, land on team page ===
  await guardian.goto("/");
  await guardian.waitForURL("**/t/test-squad");
  await expect(
    guardian.getByRole("heading", { name: "Test Squad" }),
  ).toBeVisible();

  await guardianCtx.close();
  await adminCtx.close();
});
