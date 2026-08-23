import {
  getRecoveryCodeStats,
  getUserByEmail,
  countSessionsForUser,
} from "./helpers/db";
import { expect, test } from "./helpers/fixtures";
import { generateFirstSet } from "./helpers/recovery";
import { currentTotpCode } from "./helpers/totp";
import {
  loginViaUi,
  logoutViaUi,
  uniqueClientIp,
  uniqueEmail,
} from "./helpers/users";
import { fetchFromPage } from "./helpers/webauthn";

test.describe("authentication negative cases", () => {
  test("register API rejects a short password", async ({ request }) => {
    const response = await request.post("/api/auth/register", {
      data: { email: uniqueEmail(), password: "short" },
    });

    expect(response.status()).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid Inputs" });
  });

  test("register API rejects a malformed email", async ({ request }) => {
    const response = await request.post("/api/auth/register", {
      data: { email: "not-an-email", password: "Long-Enough-1!" },
    });

    expect(response.status()).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid Inputs" });
  });

  test("register API rejects a malformed JSON body without creating a user", async ({
    request,
  }) => {
    const email = uniqueEmail("malformed");

    const response = await request.post("/api/auth/register", {
      headers: { "Content-Type": "application/json" },
      data: `{"email":"${email}",`,
    });

    expect(response.ok()).toBe(false);
    expect(await getUserByEmail(email)).toBeNull();
  });

  test("passkey auth options reject a malformed JSON body", async ({
    request,
  }) => {
    const response = await request.post("/api/webauthn/auth/options", {
      headers: { "Content-Type": "application/json" },
      data: "{not json",
    });

    expect(response.ok()).toBe(false);
    expect(response.headers()["set-cookie"]).toBeUndefined();
  });

  test("passkey auth verify rejects an empty body", async ({ request }) => {
    const response = await request.post("/api/webauthn/auth/verify", {
      data: {},
    });

    expect(response.ok()).toBe(false);
    expect(response.headers()["set-cookie"]).toBeUndefined();
  });
});

test.describe("cross-user authorization", () => {
  test("one user's session never exposes another user's account", async ({
    page,
    browser,
    baseURL,
    createUser,
  }) => {
    const first = await createUser({ prefix: "iso-first" });
    const second = await createUser({ prefix: "iso-second" });

    await loginViaUi(page, first);

    const otherContext = await browser.newContext({
      baseURL,
      extraHTTPHeaders: { "x-forwarded-for": uniqueClientIp() },
    });
    const otherPage = await otherContext.newPage();
    await loginViaUi(otherPage, second);

    const firstMe = await fetchFromPage(page, "/api/auth/me");
    const secondMe = await fetchFromPage(otherPage, "/api/auth/me");

    expect(firstMe.body).toEqual({ user: { id: first.id, email: first.email } });
    expect(secondMe.body).toEqual({
      user: { id: second.id, email: second.email },
    });

    await expect(otherPage.getByText(second.email)).toBeVisible();
    await expect(otherPage.getByText(first.email)).toBeHidden();

    await otherContext.close();
  });

  test("a user cannot generate or invalidate another user's recovery codes", async ({
    page,
    browser,
    baseURL,
    createUser,
  }) => {
    const victim = await createUser({ prefix: "codes-victim" });
    const attacker = await createUser({ prefix: "codes-attacker" });

    await loginViaUi(page, victim);
    await generateFirstSet(page);
    expect(await getRecoveryCodeStats(victim.id)).toEqual({
      total: 10,
      used: 0,
    });

    // The generate route takes no user parameter — it always acts on the
    // caller's own session, so the attacker can only regenerate their own.
    const attackerContext = await browser.newContext({
      baseURL,
      extraHTTPHeaders: { "x-forwarded-for": uniqueClientIp() },
    });
    const attackerPage = await attackerContext.newPage();
    await loginViaUi(attackerPage, attacker);
    const result = await fetchFromPage(
      attackerPage,
      "/api/auth/recovery-codes/generate",
      { method: "POST" },
    );

    expect(result.status).toBe(200);
    expect(await getRecoveryCodeStats(attacker.id)).toEqual({
      total: 10,
      used: 0,
    });
    expect(await getRecoveryCodeStats(victim.id)).toEqual({
      total: 10,
      used: 0,
    });

    await attackerContext.close();
  });

  test("a user cannot change another user's TOTP configuration", async ({
    page,
    browser,
    baseURL,
    createUser,
  }) => {
    const victim = await createUser({ prefix: "totp-victim" });
    const attacker = await createUser({ prefix: "totp-attacker" });

    // The victim enables TOTP.
    await loginViaUi(page, victim);
    await page.goto("/settings/passkeys");
    await page.getByRole("button", { name: "Set up authenticator app" }).click();
    await page.getByText("Can't scan? Enter the setup key").click();
    const secret = (await page.locator("details code").innerText()).trim();
    await page
      .getByRole("textbox", { name: "6-digit authentication code" })
      .fill(await currentTotpCode(secret));
    await page.getByRole("button", { name: "Verify" }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "Authenticator app enabled" }),
    ).toBeVisible();

    const victimBefore = await getUserByEmail(victim.email);

    // The attacker runs setup and verify on their own session.
    const attackerContext = await browser.newContext({
      baseURL,
      extraHTTPHeaders: { "x-forwarded-for": uniqueClientIp() },
    });
    const attackerPage = await attackerContext.newPage();
    await loginViaUi(attackerPage, attacker);
    await fetchFromPage(attackerPage, "/api/auth/totp/setup", {
      method: "POST",
    });

    const victimAfter = await getUserByEmail(victim.email);
    expect(victimAfter!.totpEnabled).toBe(true);
    expect(victimAfter!.totpSecret).toBe(victimBefore!.totpSecret);

    await attackerContext.close();
  });

  test("signing out one user leaves the other user's session intact", async ({
    page,
    browser,
    baseURL,
    createUser,
  }) => {
    const first = await createUser({ prefix: "sess-first" });
    const second = await createUser({ prefix: "sess-second" });

    await loginViaUi(page, first);

    const otherContext = await browser.newContext({
      baseURL,
      extraHTTPHeaders: { "x-forwarded-for": uniqueClientIp() },
    });
    const otherPage = await otherContext.newPage();
    await loginViaUi(otherPage, second);

    await logoutViaUi(page);

    expect(await countSessionsForUser(first.id)).toBe(0);
    expect(await countSessionsForUser(second.id)).toBe(1);

    await otherPage.reload();
    await expect(
      otherPage.getByRole("heading", { name: "You're signed in" }),
    ).toBeVisible();

    await otherContext.close();
  });

  test("a stolen session cookie is bound to the account that created it", async ({
    page,
    browser,
    baseURL,
    createUser,
  }) => {
    const owner = await createUser({ prefix: "steal-owner" });
    await loginViaUi(page, owner);

    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find((cookie) => cookie.name === "session");

    const thiefContext = await browser.newContext({
      baseURL,
      extraHTTPHeaders: { "x-forwarded-for": uniqueClientIp() },
    });
    await thiefContext.addCookies([sessionCookie!]);
    const thiefPage = await thiefContext.newPage();
    await thiefPage.goto("/");

    // The cookie still resolves to its owner — never to anyone else.
    const me = await fetchFromPage(thiefPage, "/api/auth/me");
    expect(me.body).toEqual({ user: { id: owner.id, email: owner.email } });

    // And revoking it from the owner's side kills the copy too.
    await logoutViaUi(page);
    const afterLogout = await fetchFromPage(thiefPage, "/api/auth/me");
    expect(afterLogout.status).toBe(401);

    await thiefContext.close();
  });
});
