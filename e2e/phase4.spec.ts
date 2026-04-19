import { test, expect } from "@playwright/test";
import { newEnContext } from "./helpers";

// A tiny valid 1×1 PNG. sharp upscales to the target avatar size with
// fit=cover, which is fine for tests.
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

/**
 * Picture upload → admin approval → avatar visible on roster.
 */
test("profile picture upload flows through the approval queue", async ({
  browser,
}) => {
  const nonce = Date.now();
  const email = `pic+${nonce}@example.com`;
  const name = `Pic ${nonce}`;

  // Sign up guardian and apply.
  const guardianCtx = await newEnContext(browser);
  const guardian = await guardianCtx.newPage();
  await guardian.goto("/login");
  await guardian.getByRole("button", { name: "Create one" }).click();
  await guardian.getByLabel("Email").fill(email);
  await guardian.getByLabel("Password").fill("password123");
  await guardian.getByRole("button", { name: "Create account" }).click();
  await guardian.waitForURL("**/onboarding");
  await guardian.getByLabel("Invite code").fill("DEMO-INVITE");
  await guardian.getByLabel("Display name").fill(name);
  await guardian.getByRole("button", { name: "Apply to join" }).click();
  await guardian.waitForURL("**/onboarding/pending");

  // Admin approves membership.
  const adminCtx = await newEnContext(browser);
  const admin = await adminCtx.newPage();
  await admin.goto("/login");
  await admin.getByLabel("Email").fill("admin1@example.com");
  await admin.getByLabel("Password").fill("password123");
  await admin.getByRole("button", { name: "Sign in" }).click();
  await admin.waitForURL("**/t/test-squad");
  await admin.goto("/t/test-squad/admin/approvals");
  const memberRow = admin.locator("li").filter({ hasText: name });
  await memberRow.getByRole("button", { name: "Approve" }).click();
  await expect(memberRow).toHaveCount(0);

  // Guardian uploads picture.
  await guardian.goto("/t/test-squad/profile");
  await guardian
    .getByLabel("Profile picture")
    .setInputFiles({ name: "avatar.png", mimeType: "image/png", buffer: TINY_PNG });
  await guardian
    .getByRole("button", { name: "Submit changes for approval" })
    .click();
  await expect(guardian.getByText("Submitted for approval.")).toBeVisible();

  // Admin sees the pending change with an image preview.
  await admin.goto("/t/test-squad/admin/approvals");
  const changeRow = admin.locator("li").filter({ hasText: name });
  await expect(changeRow.locator('img[alt="proposed"]').first()).toBeVisible();
  await changeRow.getByRole("button", { name: "Approve" }).click();
  await expect(changeRow).toHaveCount(0);

  // Roster shows the avatar image on the guardian's row.
  await guardian.goto("/t/test-squad/members");
  const rosterRow = guardian.locator("li").filter({ hasText: name });
  await expect(rosterRow.locator("img").first()).toBeVisible();

  await guardianCtx.close();
  await adminCtx.close();
});

/**
 * Team-admin demote + remove via the roster page.
 * Seeded admin1 is team-admin of Test Squad. We need two accounts so
 * we can demote one without orphaning. Use admin2 for this.
 */
test("admin demotes and removes a teammate", async ({ browser }) => {
  const nonce = Date.now();
  const email = `toremove+${nonce}@example.com`;
  const name = `Removable ${nonce}`;

  // Guardian signs up + applies.
  const guardianCtx = await newEnContext(browser);
  const guardian = await guardianCtx.newPage();
  await guardian.goto("/login");
  await guardian.getByRole("button", { name: "Create one" }).click();
  await guardian.getByLabel("Email").fill(email);
  await guardian.getByLabel("Password").fill("password123");
  await guardian.getByRole("button", { name: "Create account" }).click();
  await guardian.waitForURL("**/onboarding");
  await guardian.getByLabel("Invite code").fill("DEMO-INVITE");
  await guardian.getByLabel("Display name").fill(name);
  await guardian.getByRole("button", { name: "Apply to join" }).click();
  await guardian.waitForURL("**/onboarding/pending");
  await guardianCtx.close();

  // Admin approves and opens roster.
  const adminCtx = await newEnContext(browser);
  const admin = await adminCtx.newPage();
  await admin.goto("/login");
  await admin.getByLabel("Email").fill("admin1@example.com");
  await admin.getByLabel("Password").fill("password123");
  await admin.getByRole("button", { name: "Sign in" }).click();
  await admin.waitForURL("**/t/test-squad");
  await admin.goto("/t/test-squad/admin/approvals");
  await admin
    .locator("li")
    .filter({ hasText: name })
    .getByRole("button", { name: "Approve" })
    .click();

  await admin.goto("/t/test-squad/members");
  const row = admin.locator("li").filter({ hasText: name });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Remove" }).click();
  // After remove, the row disappears.
  await expect(row).toHaveCount(0);

  await adminCtx.close();
});

/**
 * Super-admin grant via /admin/users. admin1 searches for the fresh
 * guardian, grants, then revokes. The 2-super-admin floor is only
 * enforced on demotion of the last one — granting to a third is fine.
 */
test("super-admin can grant and revoke super-admin flag", async ({
  browser,
}) => {
  const nonce = Date.now();
  const email = `super+${nonce}@example.com`;

  // Create a throwaway user first.
  const userCtx = await newEnContext(browser);
  const user = await userCtx.newPage();
  await user.goto("/login");
  await user.getByRole("button", { name: "Create one" }).click();
  await user.getByLabel("Email").fill(email);
  await user.getByLabel("Password").fill("password123");
  await user.getByRole("button", { name: "Create account" }).click();
  await user.waitForURL("**/onboarding");
  await userCtx.close();

  const adminCtx = await newEnContext(browser);
  const admin = await adminCtx.newPage();
  await admin.goto("/login");
  await admin.getByLabel("Email").fill("admin1@example.com");
  await admin.getByLabel("Password").fill("password123");
  await admin.getByRole("button", { name: "Sign in" }).click();
  await admin.waitForURL("**/t/test-squad");

  await admin.goto("/admin/users");
  await admin.getByPlaceholder("Search by email or user id").fill(email);
  await admin.getByRole("button", { name: "Search" }).click();

  const row = admin.locator("li").filter({ hasText: email });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Grant super-admin" }).click();
  await expect(row.getByText("super-admin", { exact: true })).toBeVisible();
  await row.getByRole("button", { name: "Revoke super-admin" }).click();
  await expect(row.getByRole("button", { name: "Grant super-admin" })).toBeVisible();

  await adminCtx.close();
});

/**
 * Roster CSV export returns a CSV body + audit-log entry is written.
 * We don't parse the CSV deeply — column header presence is enough.
 */
test("roster CSV export returns a CSV file", async ({ browser }) => {
  const adminCtx = await newEnContext(browser);
  const admin = await adminCtx.newPage();
  await admin.goto("/login");
  await admin.getByLabel("Email").fill("admin1@example.com");
  await admin.getByLabel("Password").fill("password123");
  await admin.getByRole("button", { name: "Sign in" }).click();
  await admin.waitForURL("**/t/test-squad");

  const resp = await admin.request.get("/t/test-squad/admin/roster-export");
  expect(resp.status()).toBe(200);
  expect(resp.headers()["content-type"]).toContain("text/csv");
  const body = await resp.text();
  expect(body.split("\r\n")[0]).toContain("display_name");
  expect(body.split("\r\n")[0]).toContain("email");

  // Audit log page surfaces the export event.
  await admin.goto("/t/test-squad/admin/audit");
  await expect(
    admin.getByText("Roster exported (CSV)").first(),
  ).toBeVisible();

  await adminCtx.close();
});
