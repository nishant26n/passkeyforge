import { expect, test } from "./helpers/fixtures";

test.describe("login page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("login page loads with its title and heading", async ({ page }) => {
    await expect(page).toHaveTitle("Sign in · Passkey Forge");
    await expect(
      page.getByRole("heading", { name: "Welcome back" }),
    ).toBeVisible();
    await expect(
      page.getByText("Sign in to continue to Passkey Forge."),
    ).toBeVisible();
  });

  test("login page shows the email, password and sign-in controls", async ({
    page,
  }) => {
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "Password", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  test("login page offers passkey and authenticator alternatives", async ({
    page,
  }) => {
    await expect(
      page.getByRole("button", { name: "Continue with a passkey" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Use authenticator code" }),
    ).toBeVisible();
  });

  test("login page links to account recovery and registration", async ({
    page,
  }) => {
    await expect(
      page.getByRole("link", { name: "Recover your account" }),
    ).toHaveAttribute("href", "/recovery");
    await expect(
      page.getByRole("link", { name: "Create one" }),
    ).toHaveAttribute("href", "/register");
    await expect(
      page.getByRole("link", { name: "Forgot password?" }),
    ).toBeVisible();
  });

  test("passkey option navigates to the passkey sign-in page", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Continue with a passkey" }).click();

    await expect(page).toHaveURL("/login/passkey");
    await expect(
      page.getByRole("heading", { name: "Sign in with a passkey" }),
    ).toBeVisible();
  });

  test("authenticator option navigates to the authenticator sign-in page", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Use authenticator code" }).click();

    await expect(page).toHaveURL("/authenticator-login");
    await expect(
      page.getByRole("heading", { name: "Login with authenticator code" }),
    ).toBeVisible();
  });

  test("client-side validation rejects an empty submission", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText("Enter a valid email address.")).toBeVisible();
    await expect(page.getByText("Enter your password.")).toBeVisible();
    await expect(page).toHaveURL("/login");
  });
});
