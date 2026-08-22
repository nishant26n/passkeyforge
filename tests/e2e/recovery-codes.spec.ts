import { getRecoveryCodeStats } from "./helpers/db";
import { expect, test } from "./helpers/fixtures";
import {
  RECOVERY_CODE_PATTERN,
  generateFirstSet,
  recoverySection,
  regenerateCodes,
  remainingCodesLabel,
} from "./helpers/recovery";
import { loginViaUi } from "./helpers/users";
import { fetchFromPage } from "./helpers/webauthn";

test.describe("recovery codes", () => {
  test("unauthenticated user cannot generate recovery codes", async ({
    request,
  }) => {
    const response = await request.post("/api/auth/recovery-codes/generate");

    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  test("recovery codes start in the not-set-up state", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();
    await loginViaUi(page, user);
    await page.goto("/settings/passkeys");

    await expect(
      page.getByRole("heading", { name: "Recovery codes" }),
    ).toBeVisible();
    await expect(
      page.getByText("No recovery codes yet. Generate a set and store them offline."),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Generate recovery codes" }),
    ).toBeVisible();
  });

  test("authenticated user can generate ten codes, shown once", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();
    await loginViaUi(page, user);

    const codes = await generateFirstSet(page);

    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    await expect(
      page.getByText(
        "These codes are shown once. Save them now — leaving this page hides them for good.",
      ),
    ).toBeVisible();

    expect(await getRecoveryCodeStats(user.id)).toEqual({ total: 10, used: 0 });
  });

  test("codes are hidden again after acknowledging them", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();
    await loginViaUi(page, user);
    await generateFirstSet(page);

    await page.getByRole("button", { name: "I saved them" }).click();

    await expect(recoverySection(page).locator("ol > li")).toHaveCount(0);
    await expect(
      page.getByRole("img", { name: remainingCodesLabel(10, 10) }),
    ).toBeVisible();
  });

  test("regenerating replaces the previous set", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();
    await loginViaUi(page, user);

    const first = await generateFirstSet(page);
    await page.getByRole("button", { name: "I saved them" }).click();
    const second = await regenerateCodes(page);

    expect(second).toHaveLength(10);
    expect(first.some((code) => second.includes(code))).toBe(false);
    expect(await getRecoveryCodeStats(user.id)).toEqual({ total: 10, used: 0 });
  });

  test("a valid recovery code signs the user in", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();
    await loginViaUi(page, user);
    const codes = await generateFirstSet(page);

    await page.goto("/");
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(
      page.getByRole("heading", { name: "Welcome back" }),
    ).toBeVisible();

    await page.goto("/recovery");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Recovery code").fill(codes[0]);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(
      page.getByRole("heading", { name: "You're signed in" }),
    ).toBeVisible();
    expect(await getRecoveryCodeStats(user.id)).toEqual({ total: 10, used: 1 });
  });

  test("a used recovery code cannot be reused", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();
    await loginViaUi(page, user);
    const codes = await generateFirstSet(page);

    await page.goto("/");
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(
      page.getByRole("heading", { name: "Welcome back" }),
    ).toBeVisible();

    await page.goto("/recovery");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Recovery code").fill(codes[0]);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(
      page.getByRole("heading", { name: "You're signed in" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(
      page.getByRole("heading", { name: "Welcome back" }),
    ).toBeVisible();

    await page.goto("/recovery");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Recovery code").fill(codes[0]);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "Invalid or already used recovery code" }),
    ).toBeVisible();
    expect(await getRecoveryCodeStats(user.id)).toEqual({ total: 10, used: 1 });
  });

  test("a code from a replaced set no longer works", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();
    await loginViaUi(page, user);

    const first = await generateFirstSet(page);
    await page.getByRole("button", { name: "I saved them" }).click();
    await regenerateCodes(page);

    await page.goto("/");
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(
      page.getByRole("heading", { name: "Welcome back" }),
    ).toBeVisible();

    await page.goto("/recovery");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Recovery code").fill(first[0]);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "Invalid or already used recovery code" }),
    ).toBeVisible();
  });

  test("the remaining count drops after a code is spent", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();
    await loginViaUi(page, user);
    const codes = await generateFirstSet(page);

    await page.goto("/");
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(
      page.getByRole("heading", { name: "Welcome back" }),
    ).toBeVisible();

    await page.goto("/recovery");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Recovery code").fill(codes[1]);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(
      page.getByRole("heading", { name: "You're signed in" }),
    ).toBeVisible();

    await page.goto("/settings/passkeys");
    await expect(
      page.getByRole("img", { name: remainingCodesLabel(9, 10) }),
    ).toBeVisible();
    await expect(page.getByText("1 used")).toBeVisible();
  });

  test("another user's recovery code does not work on a different account", async ({
    page,
    createUser,
  }) => {
    const owner = await createUser({ prefix: "owner" });
    const other = await createUser({ prefix: "other" });

    await loginViaUi(page, owner);
    const codes = await generateFirstSet(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(
      page.getByRole("heading", { name: "Welcome back" }),
    ).toBeVisible();

    await page.goto("/recovery");
    await page.getByLabel("Email").fill(other.email);
    await page.getByLabel("Recovery code").fill(codes[0]);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "Invalid or already used recovery code" }),
    ).toBeVisible();
    expect(await getRecoveryCodeStats(owner.id)).toEqual({ total: 10, used: 0 });
  });

  test("a recovery code cannot be consumed twice by concurrent requests", async ({
    page,
    request,
    createUser,
  }) => {
    const user = await createUser();
    await loginViaUi(page, user);
    const codes = await generateFirstSet(page);

    // Fire both requests together so they race on the same unused code: the
    // atomic `updateMany({ where: { usedAt: null } })` consumption must let
    // exactly one of them win regardless of how the DB interleaves them.
    const [first, second] = await Promise.all([
      request.post("/api/auth/recovery/code", {
        data: { email: user.email, code: codes[0] },
      }),
      request.post("/api/auth/recovery/code", {
        data: { email: user.email, code: codes[0] },
      }),
    ]);

    const statuses = [first.status(), second.status()].sort((a, b) => a - b);
    expect(statuses).toEqual([200, 401]);
    expect(await getRecoveryCodeStats(user.id)).toEqual({ total: 10, used: 1 });
  });

  test("the generate endpoint returns exactly ten codes", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();
    await loginViaUi(page, user);

    const result = await fetchFromPage(
      page,
      "/api/auth/recovery-codes/generate",
      { method: "POST" },
    );

    expect(result.status).toBe(200);
    const codes = result.body!.codes as string[];
    expect(codes).toHaveLength(10);
    expect(codes.every((code) => RECOVERY_CODE_PATTERN.test(code))).toBe(true);
    expect(await getRecoveryCodeStats(user.id)).toEqual({ total: 10, used: 0 });
  });
});
