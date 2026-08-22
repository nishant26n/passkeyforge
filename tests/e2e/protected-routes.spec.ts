import { expect, test } from "./helpers/fixtures";
import { loginViaUi } from "./helpers/users";

/** Server components that call `getCurrentUser()` and redirect when it is null. */
const protectedPages = ["/", "/settings/passkeys"];

/** Route handlers that answer 401 without a session. */
const protectedEndpoints: Array<{
  method: "GET" | "POST" | "DELETE";
  path: string;
  data?: unknown;
}> = [
  { method: "GET", path: "/api/auth/me" },
  { method: "GET", path: "/api/webauthn/credentials" },
  { method: "POST", path: "/api/webauthn/register/options" },
  { method: "POST", path: "/api/webauthn/register/verify", data: {} },
  { method: "POST", path: "/api/auth/totp/setup" },
  { method: "POST", path: "/api/auth/totp/verify", data: { code: "123456" } },
  { method: "POST", path: "/api/auth/recovery-codes/generate" },
  { method: "POST", path: "/api/auth/session/refresh" },
  { method: "DELETE", path: "/api/webauthn/credentials/some-credential-id" },
];

/** Pages that bounce an already-authenticated visitor back to the app. */
const guestOnlyPages = [
  "/login",
  "/register",
  "/login/passkey",
  "/authenticator-login",
  "/recovery",
];

test.describe("protected routes", () => {
  for (const path of protectedPages) {
    test(`unauthenticated user is redirected away from ${path}`, async ({
      page,
    }) => {
      await page.goto(path);

      await expect(page).toHaveURL("/login");
      await expect(
        page.getByRole("heading", { name: "Welcome back" }),
      ).toBeVisible();
    });
  }

  for (const endpoint of protectedEndpoints) {
    test(`unauthenticated ${endpoint.method} ${endpoint.path} is rejected`, async ({
      request,
    }) => {
      const response = await request.fetch(endpoint.path, {
        method: endpoint.method,
        data: endpoint.data as undefined,
      });

      expect(response.status()).toBe(401);
      expect((await response.json()).error).toBe("Unauthorized");
    });
  }

  for (const path of guestOnlyPages) {
    test(`authenticated user visiting ${path} is sent to the app`, async ({
      page,
      createUser,
    }) => {
      const user = await createUser();
      await loginViaUi(page, user);

      await page.goto(path);

      await expect(page).toHaveURL("/");
      await expect(
        page.getByRole("heading", { name: "You're signed in" }),
      ).toBeVisible();
    });
  }

  test("authenticated user can open the settings page", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();
    await loginViaUi(page, user);

    await page.getByRole("link", { name: "Settings" }).click();

    await expect(page).toHaveURL("/settings/passkeys");
    await expect(
      page.getByRole("heading", { name: "Security settings" }),
    ).toBeVisible();
    await expect(page.getByText(`Signed in as ${user.email}`)).toBeVisible();
  });
});
