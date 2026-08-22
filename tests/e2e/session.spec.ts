import {
  expireSessionsForUser,
  getSessionByToken,
  getUserByEmail,
} from "./helpers/db";
import { expect, test } from "./helpers/fixtures";
import { loginViaUi, readSessionCookie } from "./helpers/users";

test.describe("session behaviour", () => {
  test("refreshing the page preserves authentication", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();
    await loginViaUi(page, user);

    await page.reload();

    await expect(
      page.getByRole("heading", { name: "You're signed in" }),
    ).toBeVisible();
    await expect(page.getByText(user.email)).toBeVisible();
  });

  test("navigating to another page preserves authentication", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();
    await loginViaUi(page, user);

    await page.goto("/settings/passkeys");
    await expect(
      page.getByRole("heading", { name: "Security settings" }),
    ).toBeVisible();

    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "You're signed in" }),
    ).toBeVisible();
  });

  test("an invalid session cookie is rejected", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();
    await loginViaUi(page, user);

    await page.context().clearCookies();
    await page.context().addCookies([
      {
        name: "session",
        value: "not-a-real-session-token",
        domain: "localhost",
        path: "/",
      },
    ]);

    await page.goto("/");
    await expect(page).toHaveURL("/login");

    expect((await page.request.get("/api/auth/me")).status()).toBe(401);
  });

  test("an expired session is rejected", async ({ page, createUser }) => {
    const user = await createUser();
    await loginViaUi(page, user);

    const cookie = await readSessionCookie(page);
    const dbUser = await getUserByEmail(user.email);
    await expireSessionsForUser(dbUser!.id);

    await page.goto("/");
    await expect(page).toHaveURL("/login");

    // getSession deletes the row it found expired.
    expect(await getSessionByToken(cookie!.value)).toBeNull();
  });

  test("session refresh endpoint issues a new session", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();
    await loginViaUi(page, user);

    const before = await readSessionCookie(page);
    const response = await page.request.post("/api/auth/session/refresh");

    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      user: { email: user.email },
    });

    const after = await readSessionCookie(page);
    expect(after).not.toBeNull();
    expect(after!.value).not.toBe(before!.value);

    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "You're signed in" }),
    ).toBeVisible();
  });

  test("a rotated session token cannot be reused", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();
    await loginViaUi(page, user);

    const original = await readSessionCookie(page);
    expect((await page.request.post("/api/auth/session/refresh")).status()).toBe(
      200,
    );

    // Replay the pre-rotation token, as a stolen cookie would.
    await page.context().clearCookies();
    await page.context().addCookies([original!]);

    expect((await page.request.get("/api/auth/me")).status()).toBe(401);

    // Presenting a rotated token also destroys the record entirely.
    expect(await getSessionByToken(original!.value)).toBeNull();

    await page.goto("/");
    await expect(page).toHaveURL("/login");
  });

  test("session refresh with an invalid token is rejected", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.context().addCookies([
      {
        name: "session",
        value: "definitely-not-a-session",
        domain: "localhost",
        path: "/",
      },
    ]);

    const response = await page.request.post("/api/auth/session/refresh");

    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  test("session survives a full browser context reload of the app", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();
    await loginViaUi(page, user);

    const state = await page.context().storageState();
    expect(
      state.cookies.some((cookie) => cookie.name === "session"),
    ).toBe(true);

    await page.goto("/settings/passkeys");
    await page.reload();

    await expect(page.getByText(`Signed in as ${user.email}`)).toBeVisible();
  });
});
