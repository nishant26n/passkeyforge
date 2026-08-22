import { randomBytes } from "node:crypto";
import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { TEST_EMAIL_DOMAIN } from "./db";

export type TestUser = {
  id: string;
  email: string;
  password: string;
};

/**
 * The password every test account shares. It is never asserted on, never
 * printed, and only ever leaves this module by being typed into a field.
 */
export const TEST_PASSWORD = "Corr3ct-Horse-Batt3ry!";

/** A password that satisfies the client but is deliberately wrong at the API. */
export const WRONG_PASSWORD = "Wr0ng-Horse-Batt3ry!";

export function uniqueEmail(prefix = "e2e") {
  return `${prefix}-${Date.now()}-${randomBytes(4).toString("hex")}@${TEST_EMAIL_DOMAIN}`;
}

/** A plausible-looking but unused IP, so each test gets its own rate limit bucket. */
export function uniqueClientIp() {
  const octet = () => 1 + Math.floor(Math.random() * 254);
  return `203.0.${octet()}.${octet()}`;
}

/** Signs in through the real login form and waits for the authenticated page. */
export async function loginViaUi(page: Page, user: TestUser) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page
    .getByRole("textbox", { name: "Password", exact: true })
    .fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(
    page.getByRole("heading", { name: "You're signed in" }),
  ).toBeVisible();
}

/** Signs in through the real login API on an API request context. */
export async function loginViaApi(
  request: APIRequestContext,
  user: TestUser,
) {
  const response = await request.post("/api/auth/login", {
    data: { email: user.email, password: user.password },
  });
  expect(response.status()).toBe(200);
  return response;
}

export async function logoutViaUi(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
}

export async function readSessionCookie(page: Page) {
  const cookies = await page.context().cookies();
  return cookies.find((cookie) => cookie.name === "session") ?? null;
}
