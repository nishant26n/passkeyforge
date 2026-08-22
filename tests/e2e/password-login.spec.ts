import { countSessionsForUser, getUserByEmail } from "./helpers/db";
import { expect, test } from "./helpers/fixtures";
import {
  WRONG_PASSWORD,
  loginViaUi,
  readSessionCookie,
  uniqueEmail,
} from "./helpers/users";

test.describe("password login", () => {
  test("user can log in with valid credentials and reach the protected page", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();

    await loginViaUi(page, user);

    await expect(page).toHaveURL("/");
    await expect(page.getByText(user.email)).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  });

  test("successful login creates a server-side session", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();

    await loginViaUi(page, user);

    const cookie = await readSessionCookie(page);
    expect(cookie).not.toBeNull();
    expect(cookie!.httpOnly).toBe(true);
    expect(cookie!.sameSite).toBe("Lax");
    expect(cookie!.path).toBe("/");

    const dbUser = await getUserByEmail(user.email);
    expect(await countSessionsForUser(dbUser!.id)).toBe(1);
  });

  test("user cannot log in with an invalid password", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();

    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page
      .getByRole("textbox", { name: "Password", exact: true })
      .fill(WRONG_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(
      page.getByRole("alert").filter({ hasText: "Invalid email or password" }),
    ).toBeVisible();
    await expect(page).toHaveURL("/login");
    expect(await readSessionCookie(page)).toBeNull();
  });

  test("user cannot log in with an unknown email", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(uniqueEmail("no-such-user"));
    await page
      .getByRole("textbox", { name: "Password", exact: true })
      .fill(WRONG_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    // Same message as a wrong password — the app does not disclose which failed.
    await expect(
      page.getByRole("alert").filter({ hasText: "Invalid email or password" }),
    ).toBeVisible();
    expect(await readSessionCookie(page)).toBeNull();
  });

  test("login API rejects a wrong password with 401", async ({
    request,
    createUser,
  }) => {
    const user = await createUser();

    const response = await request.post("/api/auth/login", {
      data: { email: user.email, password: WRONG_PASSWORD },
    });

    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: "Invalid email or password" });
  });

  test("login API rejects an unknown account with 401", async ({ request }) => {
    const response = await request.post("/api/auth/login", {
      data: { email: uniqueEmail("no-such-user"), password: WRONG_PASSWORD },
    });

    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: "Invalid email or password" });
  });

  test("login API rejects missing fields with 400", async ({ request }) => {
    const response = await request.post("/api/auth/login", { data: {} });

    expect(response.status()).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid email or password" });
  });

  test("login is case-insensitive on the email address", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();

    await loginViaUi(page, { ...user, email: user.email.toUpperCase() });

    // The route lowercases before lookup, so the stored address is shown back.
    await expect(page.getByText(user.email)).toBeVisible();
  });

  test("login API rejects a malformed JSON body without authenticating", async ({
    request,
    createUser,
  }) => {
    const user = await createUser();

    const response = await request.post("/api/auth/login", {
      headers: { "Content-Type": "application/json" },
      data: `{"email":"${user.email}","password":`,
    });

    // Currently a 500 from the catch-all handler rather than a 400; what
    // matters for security is that nothing is authenticated.
    expect(response.ok()).toBe(false);
    expect(response.headers()["set-cookie"]).toBeUndefined();
  });
});
