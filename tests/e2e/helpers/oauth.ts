import { expect, type Page } from "@playwright/test";

/**
 * Registers a fresh OAuth test client and generates PKCE + state through the
 * real /oauth/test UI. Leaves the page on /oauth/test with the flow state
 * saved in sessionStorage, ready for "Start OAuth Login".
 */
export async function setUpOAuthTestClient(page: Page) {
  await page.goto("/oauth/test");

  await page.getByRole("button", { name: "Register new test client" }).click();
  await expect(page.getByLabel("Client ID")).not.toHaveValue("");

  await page.getByRole("button", { name: "Generate PKCE + state" }).click();
  await expect(page.getByText(/code_challenge:/)).toBeVisible();
}

/** Runs the client setup through a completed token exchange. */
export async function runOAuthLoginToToken(page: Page) {
  await setUpOAuthTestClient(page);

  await page.getByRole("button", { name: "Start OAuth Login" }).click();
  await expect(page.getByText("Access token obtained.")).toBeVisible();

  await page.getByRole("link", { name: "Continue to test client" }).click();
  await expect(page.locator("li", { hasText: "Access token" })).toContainText("✓");
}
