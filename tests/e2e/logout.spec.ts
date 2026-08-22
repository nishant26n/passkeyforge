import { countSessionsForUser, getSessionByToken } from "./helpers/db";
import { expect, test } from "./helpers/fixtures";
import { loginViaUi, readSessionCookie } from "./helpers/users";

test.describe("logout", () => {
  test("user can log out and is returned to the login page", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();
    await loginViaUi(page, user);

    await page.getByRole("button", { name: "Sign out" }).click();

    await expect(page).toHaveURL("/login");
    await expect(
      page.getByRole("heading", { name: "Welcome back" }),
    ).toBeVisible();
  });

  test("logout removes the session cookie and the stored session", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();
    await loginViaUi(page, user);

    const cookie = await readSessionCookie(page);
    expect(cookie).not.toBeNull();
    expect(await getSessionByToken(cookie!.value)).not.toBeNull();

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(
      page.getByRole("heading", { name: "Welcome back" }),
    ).toBeVisible();

    expect(await readSessionCookie(page)).toBeNull();
    expect(await getSessionByToken(cookie!.value)).toBeNull();
    expect(await countSessionsForUser(user.id)).toBe(0);
  });

  test("logged out user cannot access the protected page", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();
    await loginViaUi(page, user);

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(
      page.getByRole("heading", { name: "Welcome back" }),
    ).toBeVisible();

    await page.goto("/");
    await expect(page).toHaveURL("/login");
    await expect(
      page.getByRole("heading", { name: "You're signed in" }),
    ).toBeHidden();
  });

  test("a logged out session token is rejected by the API", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();
    await loginViaUi(page, user);
    const cookie = await readSessionCookie(page);

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(
      page.getByRole("heading", { name: "Welcome back" }),
    ).toBeVisible();

    // Put the dead token back and confirm the server refuses it.
    await page.context().addCookies([
      { ...cookie!, value: cookie!.value },
    ]);
    const response = await page.request.get("/api/auth/me");
    expect(response.status()).toBe(401);
  });

  test("logout without a session still succeeds", async ({ request }) => {
    const response = await request.post("/api/auth/logout");

    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ success: true });
  });
});
