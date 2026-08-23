import { getUserByEmail } from "./helpers/db";
import { expect, test } from "./helpers/fixtures";
import { TEST_PASSWORD, loginViaUi, uniqueEmail } from "./helpers/users";

test.describe("registration", () => {
  test("registration page loads with its required fields", async ({ page }) => {
    await page.goto("/register");

    await expect(page).toHaveTitle("Create account · Passkey Forge");
    await expect(
      page.getByRole("heading", { name: "Create your account" }),
    ).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "Password", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Create account" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  test("registration rejects an invalid email", async ({ page }) => {
    await page.goto("/register");

    await page.getByLabel("Email").fill("not-an-email");
    await page
      .getByRole("textbox", { name: "Password", exact: true })
      .fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByText("Enter a valid email address.")).toBeVisible();
    await expect(page).toHaveURL("/register");
  });

  test("registration rejects an empty password", async ({ page }) => {
    await page.goto("/register");

    await page.getByLabel("Email").fill(uniqueEmail());
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByText("Use at least 8 characters.")).toBeVisible();
    await expect(page).toHaveURL("/register");
  });

  test("registration enforces the eight character password rule", async ({
    page,
  }) => {
    await page.goto("/register");

    await page.getByLabel("Email").fill(uniqueEmail());
    await page
      .getByRole("textbox", { name: "Password", exact: true })
      .fill("Sh0rt!");

    // The strength meter reports the same rule the API enforces (min 8).
    await expect(page.getByText("Too short")).toBeVisible();

    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Use at least 8 characters.")).toBeVisible();
  });

  test("password strength meter reacts to a strong password", async ({
    page,
  }) => {
    await page.goto("/register");

    await page
      .getByRole("textbox", { name: "Password", exact: true })
      .fill(TEST_PASSWORD);

    await expect(page.getByText("Strong")).toBeVisible();
  });

  test("user can register and is redirected to sign in", async ({
    page,
    trackEmail,
  }) => {
    // Registered through the form rather than the fixture's API call, so the
    // browser flow itself is what is under test.
    const email = uniqueEmail();
    trackEmail(email);

    await page.goto("/register");
    await page.getByLabel("Email").fill(email);
    await page
      .getByRole("textbox", { name: "Password", exact: true })
      .fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page).toHaveURL("/login?registered=1");
    await expect(
      page.getByText("Account created. Sign in to continue."),
    ).toBeVisible();

    expect(await getUserByEmail(email)).not.toBeNull();
  });

  test("newly registered user can log in", async ({ page, trackEmail }) => {
    const email = uniqueEmail();
    trackEmail(email);

    await page.goto("/register");
    await page.getByLabel("Email").fill(email);
    await page
      .getByRole("textbox", { name: "Password", exact: true })
      .fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL("/login?registered=1");

    await loginViaUi(page, { id: "", email, password: TEST_PASSWORD });
    await expect(page.getByText(email)).toBeVisible();
  });

  test("registration rejects an email that is already taken", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();

    await page.goto("/register");
    await page.getByLabel("Email").fill(user.email);
    await page
      .getByRole("textbox", { name: "Password", exact: true })
      .fill(user.password);
    await page.getByRole("button", { name: "Create account" }).click();

    // Scoped past Next's empty route-announcer, which also carries role=alert.
    await expect(
      page.getByRole("alert").filter({ hasText: "Email is already taken" }),
    ).toBeVisible();
    await expect(page).toHaveURL("/register");
  });

  test("registration does not create a session", async ({
    page,
    trackEmail,
  }) => {
    const email = uniqueEmail();
    trackEmail(email);

    await page.goto("/register");
    await page.getByLabel("Email").fill(email);
    await page
      .getByRole("textbox", { name: "Password", exact: true })
      .fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL("/login?registered=1");

    const cookies = await page.context().cookies();
    expect(cookies.find((cookie) => cookie.name === "session")).toBeUndefined();
  });
});
