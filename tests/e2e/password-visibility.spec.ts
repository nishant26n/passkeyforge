import { expect, test } from "./helpers/fixtures";
import { TEST_PASSWORD } from "./helpers/users";

/**
 * Both auth forms render the same `PasswordField`, whose toggle is the only
 * control labelled "Show password" / "Hide password".
 */
const pagesWithPasswordField = [
  { path: "/login", heading: "Welcome back" },
  { path: "/register", heading: "Create your account" },
];

for (const { path, heading } of pagesWithPasswordField) {
  test.describe(`password visibility control on ${path}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    });

    test("password input starts masked", async ({ page }) => {
      const input = page.getByRole("textbox", {
        name: "Password",
        exact: true,
      });

      await expect(input).toHaveAttribute("type", "password");
      await expect(
        page.getByRole("button", { name: "Show password" }),
      ).toHaveAttribute("aria-pressed", "false");
    });

    test("show password reveals the value and hide password masks it again", async ({
      page,
    }) => {
      const input = page.getByRole("textbox", {
        name: "Password",
        exact: true,
      });
      await input.fill(TEST_PASSWORD);

      await page.getByRole("button", { name: "Show password" }).click();

      await expect(input).toHaveAttribute("type", "text");
      const hideButton = page.getByRole("button", { name: "Hide password" });
      await expect(hideButton).toHaveAttribute("aria-pressed", "true");

      await hideButton.click();

      await expect(input).toHaveAttribute("type", "password");
      await expect(
        page.getByRole("button", { name: "Show password" }),
      ).toBeVisible();
    });
  });
}
