import { randomBytes, createHash } from "node:crypto";
import { expect, type APIRequestContext, type Page } from "@playwright/test";

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

// --------------------------------------------------------------------------
// API-level helpers, for OAuth security tests that don't need a browser.
// --------------------------------------------------------------------------

export const OAUTH_TEST_REDIRECT_URI = "http://localhost:3000/oauth/test/callback";

export function uniqueOAuthClientName(prefix = "oauth-sec") {
  return `${prefix}-${Date.now()}-${randomBytes(4).toString("hex")}`;
}

export type PkcePair = { codeVerifier: string; codeChallenge: string };

/** S256 PKCE pair, generated the same way app/oauth/test/lib.ts does in the browser. */
export function generatePkcePair(): PkcePair {
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
  return { codeVerifier, codeChallenge };
}

/**
 * Registers a fresh OAuth client via the real API. `request` must already be
 * authenticated (e.g. via `loginViaApi`) since POST /api/oauth/clients
 * requires a session.
 */
export async function registerOAuthClient(
  request: APIRequestContext,
  options: { name?: string; redirectUri?: string } = {},
) {
  const name = options.name ?? uniqueOAuthClientName();

  const response = await request.post("/api/oauth/clients", {
    data: {
      name,
      redirectUris: [options.redirectUri ?? OAUTH_TEST_REDIRECT_URI],
    },
  });
  expect(response.status(), "OAuth client registration should succeed").toBe(
    200,
  );

  const body = await response.json();
  return {
    name,
    clientId: body.create.clientId as string,
    clientSecret: body.clientSecret as string,
  };
}

/**
 * Drives GET /api/oauth/authorize directly, without following the redirect,
 * so the issued `code` and `state` can be read straight off the Location
 * header. `request` must already carry the resource owner's session cookie.
 */
export async function requestAuthorizationCode(
  request: APIRequestContext,
  params: {
    clientId: string;
    redirectUri: string;
    codeChallenge: string;
    scope?: string;
    state?: string;
  },
) {
  const state = params.state ?? randomBytes(8).toString("hex");

  const response = await request.get("/api/oauth/authorize", {
    params: {
      response_type: "code",
      client_id: params.clientId,
      redirect_uri: params.redirectUri,
      code_challenge: params.codeChallenge,
      code_challenge_method: "S256",
      state,
      ...(params.scope ? { scope: params.scope } : {}),
    },
    maxRedirects: 0,
  });

  // NextResponse.redirect() defaults to 307 (temporary redirect) when no
  // status is passed, which is what the authorize route uses.
  expect(response.status(), "authorize should redirect with a code").toBe(307);

  const location = new URL(response.headers()["location"]!);
  const code = location.searchParams.get("code");
  const returnedState = location.searchParams.get("state");

  expect(code, "authorize redirect should include a code").toBeTruthy();
  expect(returnedState).toBe(state);

  return { code: code!, state: returnedState! };
}

/**
 * Runs a full authorize -> token exchange for a given scope and returns the
 * resulting access token. Used by resource-server scope tests that only
 * care about the token they end up with.
 */
export async function getAccessTokenWithScope(
  request: APIRequestContext,
  client: { clientId: string },
  scope: string,
) {
  const { codeVerifier, codeChallenge } = generatePkcePair();

  const { code } = await requestAuthorizationCode(request, {
    clientId: client.clientId,
    redirectUri: OAUTH_TEST_REDIRECT_URI,
    codeChallenge,
    scope,
  });

  const tokenResponse = await exchangeCodeForToken(request, {
    code,
    redirectUri: OAUTH_TEST_REDIRECT_URI,
    clientId: client.clientId,
    codeVerifier,
  });
  expect(tokenResponse.status(), "token exchange should succeed").toBe(200);

  const body = await tokenResponse.json();
  return body.access_token as string;
}

/** Exchanges an authorization code for an access token via the real token endpoint. */
export async function exchangeCodeForToken(
  request: APIRequestContext,
  params: {
    code: string;
    redirectUri: string;
    clientId: string;
    codeVerifier: string;
  },
) {
  return request.post("/api/oauth/token", {
    form: {
      grant_type: "authorization_code",
      code: params.code,
      redirect_uri: params.redirectUri,
      client_id: params.clientId,
      code_verifier: params.codeVerifier,
    },
  });
}
