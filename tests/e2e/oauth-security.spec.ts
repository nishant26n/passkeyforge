import { expireOAuthAccessToken, expireOAuthAuthorizationCode } from "./helpers/db";
import { expect, test } from "./helpers/fixtures";
import {
  OAUTH_TEST_REDIRECT_URI,
  exchangeCodeForToken,
  generatePkcePair,
  getAccessTokenWithScope,
  registerOAuthClient,
  requestAuthorizationCode,
} from "./helpers/oauth";
import { loginViaApi } from "./helpers/users";

/**
 * API-level security coverage for /api/oauth/authorize and /api/oauth/token.
 *
 * The end-to-end happy path (register client -> PKCE -> authorize -> token ->
 * userinfo -> revoke -> 401 on the revoked token), state mismatch, a missing
 * authorization code, and "no client secret in the browser" are already
 * covered through the real UI in oauth-test-ui.spec.ts and are not repeated
 * here. This file covers the negative and abuse cases that UI suite doesn't
 * drive: bad client/redirect_uri, PKCE failures, code replay/expiry, bad or
 * expired tokens, and rate limiting.
 */
const AUTH_RATE_LIMIT = 5;

test.describe("OAuth authorize security", () => {
  test("rejects an unknown client_id", async ({ request }) => {
    const response = await request.get("/api/oauth/authorize", {
      params: {
        response_type: "code",
        client_id: "does-not-exist",
        redirect_uri: OAUTH_TEST_REDIRECT_URI,
        code_challenge: generatePkcePair().codeChallenge,
        code_challenge_method: "S256",
        state: "state",
      },
      maxRedirects: 0,
    });

    expect(response.status()).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_client" });
  });

  test("rejects a redirect_uri that isn't registered for the client", async ({
    request,
    createUser,
    trackOAuthClient,
  }) => {
    const user = await createUser({ prefix: "oauth-authz" });
    await loginViaApi(request, user);
    const client = await registerOAuthClient(request);
    trackOAuthClient(client.name);

    const response = await request.get("/api/oauth/authorize", {
      params: {
        response_type: "code",
        client_id: client.clientId,
        redirect_uri: "http://localhost:3000/oauth/test/not-the-registered-callback",
        code_challenge: generatePkcePair().codeChallenge,
        code_challenge_method: "S256",
        state: "state",
      },
      maxRedirects: 0,
    });

    expect(response.status()).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_redirect_uri" });
  });

  test("rejects a request missing the PKCE code_challenge", async ({
    request,
    createUser,
    trackOAuthClient,
  }) => {
    const user = await createUser({ prefix: "oauth-authz" });
    await loginViaApi(request, user);
    const client = await registerOAuthClient(request);
    trackOAuthClient(client.name);

    const response = await request.get("/api/oauth/authorize", {
      params: {
        response_type: "code",
        client_id: client.clientId,
        redirect_uri: OAUTH_TEST_REDIRECT_URI,
        state: "state",
      },
      maxRedirects: 0,
    });

    expect(response.status()).toBe(400);
    expect((await response.json()).error).toBe("invalid_request");
  });

  test("rejects a code_challenge_method other than S256", async ({
    request,
    createUser,
    trackOAuthClient,
  }) => {
    const user = await createUser({ prefix: "oauth-authz" });
    await loginViaApi(request, user);
    const client = await registerOAuthClient(request);
    trackOAuthClient(client.name);

    const response = await request.get("/api/oauth/authorize", {
      params: {
        response_type: "code",
        client_id: client.clientId,
        redirect_uri: OAUTH_TEST_REDIRECT_URI,
        code_challenge: generatePkcePair().codeChallenge,
        code_challenge_method: "plain",
        state: "state",
      },
      maxRedirects: 0,
    });

    expect(response.status()).toBe(400);
    expect((await response.json()).error).toBe("invalid_request");
  });

  test("rejects a scope outside the allowed set", async ({
    request,
    createUser,
    trackOAuthClient,
  }) => {
    const user = await createUser({ prefix: "oauth-authz" });
    await loginViaApi(request, user);
    const client = await registerOAuthClient(request);
    trackOAuthClient(client.name);

    const response = await request.get("/api/oauth/authorize", {
      params: {
        response_type: "code",
        client_id: client.clientId,
        redirect_uri: OAUTH_TEST_REDIRECT_URI,
        code_challenge: generatePkcePair().codeChallenge,
        code_challenge_method: "S256",
        scope: "openid admin",
        state: "state",
      },
      maxRedirects: 0,
    });

    expect(response.status()).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_scope" });
  });

  test("is rate limited per client_id, with Retry-After on the blocked response", async ({
    request,
    createUser,
    trackOAuthClient,
  }) => {
    const user = await createUser({ prefix: "oauth-authz-rl" });
    await loginViaApi(request, user);
    const client = await registerOAuthClient(request);
    trackOAuthClient(client.name);
    const { codeChallenge } = generatePkcePair();

    const statuses: number[] = [];
    let blocked;

    for (let attempt = 0; attempt < AUTH_RATE_LIMIT + 1; attempt += 1) {
      const response = await request.get("/api/oauth/authorize", {
        params: {
          response_type: "code",
          client_id: client.clientId,
          redirect_uri: OAUTH_TEST_REDIRECT_URI,
          code_challenge: codeChallenge,
          code_challenge_method: "S256",
          state: `state-${attempt}`,
        },
        maxRedirects: 0,
      });
      statuses.push(response.status());
      blocked = response;
    }

    expect(statuses.slice(0, AUTH_RATE_LIMIT)).toEqual(
      Array(AUTH_RATE_LIMIT).fill(307),
    );
    expect(statuses[AUTH_RATE_LIMIT]).toBe(429);
    expect(blocked!.headers()["retry-after"]).toBe("60");
    expect(await blocked!.json()).toEqual({ error: "too_many_requests" });
  });
});

test.describe("OAuth token security", () => {
  test("rejects the wrong code_verifier", async ({
    request,
    createUser,
    trackOAuthClient,
  }) => {
    const user = await createUser({ prefix: "oauth-token" });
    await loginViaApi(request, user);
    const client = await registerOAuthClient(request);
    trackOAuthClient(client.name);
    const { codeChallenge } = generatePkcePair();

    const { code } = await requestAuthorizationCode(request, {
      clientId: client.clientId,
      redirectUri: OAUTH_TEST_REDIRECT_URI,
      codeChallenge,
    });

    const response = await exchangeCodeForToken(request, {
      code,
      redirectUri: OAUTH_TEST_REDIRECT_URI,
      clientId: client.clientId,
      codeVerifier: "this-does-not-match-the-challenge-at-all",
    });

    expect(response.status()).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_grant" });
  });

  test("rejects an expired authorization code", async ({
    request,
    createUser,
    trackOAuthClient,
  }) => {
    const user = await createUser({ prefix: "oauth-token" });
    await loginViaApi(request, user);
    const client = await registerOAuthClient(request);
    trackOAuthClient(client.name);
    const { codeVerifier, codeChallenge } = generatePkcePair();

    const { code } = await requestAuthorizationCode(request, {
      clientId: client.clientId,
      redirectUri: OAUTH_TEST_REDIRECT_URI,
      codeChallenge,
    });

    await expireOAuthAuthorizationCode(code);

    const response = await exchangeCodeForToken(request, {
      code,
      redirectUri: OAUTH_TEST_REDIRECT_URI,
      clientId: client.clientId,
      codeVerifier,
    });

    expect(response.status()).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_grant" });
  });

  test("rejects a reused authorization code, after a valid first exchange", async ({
    request,
    createUser,
    trackOAuthClient,
  }) => {
    const user = await createUser({ prefix: "oauth-token" });
    await loginViaApi(request, user);
    const client = await registerOAuthClient(request);
    trackOAuthClient(client.name);
    const { codeVerifier, codeChallenge } = generatePkcePair();

    const { code } = await requestAuthorizationCode(request, {
      clientId: client.clientId,
      redirectUri: OAUTH_TEST_REDIRECT_URI,
      codeChallenge,
    });

    const exchangeParams = {
      code,
      redirectUri: OAUTH_TEST_REDIRECT_URI,
      clientId: client.clientId,
      codeVerifier,
    };

    const first = await exchangeCodeForToken(request, exchangeParams);
    expect(first.status()).toBe(200);
    expect((await first.json()).access_token).toBeTruthy();

    const second = await exchangeCodeForToken(request, exchangeParams);
    expect(second.status()).toBe(400);
    expect(await second.json()).toEqual({ error: "invalid_grant" });
  });

  test("is rate limited per client_id, with Retry-After on the blocked response", async ({
    request,
    createUser,
    trackOAuthClient,
  }) => {
    const user = await createUser({ prefix: "oauth-token-rl" });
    await loginViaApi(request, user);
    const client = await registerOAuthClient(request);
    trackOAuthClient(client.name);

    const statuses: number[] = [];
    let blocked;

    for (let attempt = 0; attempt < AUTH_RATE_LIMIT + 1; attempt += 1) {
      const response = await exchangeCodeForToken(request, {
        code: "bogus-code-value",
        redirectUri: OAUTH_TEST_REDIRECT_URI,
        clientId: client.clientId,
        codeVerifier: "irrelevant",
      });
      statuses.push(response.status());
      blocked = response;
    }

    expect(statuses.slice(0, AUTH_RATE_LIMIT)).toEqual(
      Array(AUTH_RATE_LIMIT).fill(400),
    );
    expect(statuses[AUTH_RATE_LIMIT]).toBe(429);
    expect(blocked!.headers()["retry-after"]).toBe("60");
    expect(await blocked!.json()).toEqual({ error: "too_many_requests" });
  });
});

test.describe("OAuth access token security", () => {
  test("userinfo rejects an unknown/malformed access token", async ({
    request,
  }) => {
    const response = await request.get("/api/oauth/userInfo", {
      headers: { Authorization: "Bearer not-a-real-token" },
    });

    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: "invalid_token" });
  });

  test("userinfo rejects an expired access token", async ({
    request,
    createUser,
    trackOAuthClient,
  }) => {
    const user = await createUser({ prefix: "oauth-userinfo" });
    await loginViaApi(request, user);
    const client = await registerOAuthClient(request);
    trackOAuthClient(client.name);
    const { codeVerifier, codeChallenge } = generatePkcePair();

    const { code } = await requestAuthorizationCode(request, {
      clientId: client.clientId,
      redirectUri: OAUTH_TEST_REDIRECT_URI,
      codeChallenge,
    });

    const tokenResponse = await exchangeCodeForToken(request, {
      code,
      redirectUri: OAUTH_TEST_REDIRECT_URI,
      clientId: client.clientId,
      codeVerifier,
    });
    expect(tokenResponse.status()).toBe(200);
    const { access_token: accessToken } = await tokenResponse.json();

    await expireOAuthAccessToken(accessToken);

    const response = await request.get("/api/oauth/userInfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: "invalid_token" });
  });
});

test.describe("OAuth resource server (/api/oauth/me)", () => {
  test("rejects a missing bearer token", async ({ request }) => {
    const response = await request.get("/api/oauth/me");

    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: "invalid_token" });
  });

  test("rejects an invalid/malformed bearer token", async ({ request }) => {
    const response = await request.get("/api/oauth/me", {
      headers: { Authorization: "Bearer not-a-real-token" },
    });

    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: "invalid_token" });
  });

  test("rejects an expired access token", async ({
    request,
    createUser,
    trackOAuthClient,
  }) => {
    const user = await createUser({ prefix: "oauth-me" });
    await loginViaApi(request, user);
    const client = await registerOAuthClient(request);
    trackOAuthClient(client.name);

    const accessToken = await getAccessTokenWithScope(
      request,
      client,
      "openid email",
    );
    await expireOAuthAccessToken(accessToken);

    const response = await request.get("/api/oauth/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: "invalid_token" });
  });

  test("rejects a revoked access token", async ({
    request,
    createUser,
    trackOAuthClient,
  }) => {
    const user = await createUser({ prefix: "oauth-me" });
    await loginViaApi(request, user);
    const client = await registerOAuthClient(request);
    trackOAuthClient(client.name);

    const accessToken = await getAccessTokenWithScope(
      request,
      client,
      "openid email",
    );

    const revoked = await request.post("/api/oauth/revoke", {
      data: { token: accessToken },
    });
    expect(revoked.status()).toBe(200);

    const response = await request.get("/api/oauth/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: "invalid_token" });
  });

  test("rejects a valid token that was never granted the openid scope", async ({
    request,
    createUser,
    trackOAuthClient,
  }) => {
    const user = await createUser({ prefix: "oauth-me" });
    await loginViaApi(request, user);
    const client = await registerOAuthClient(request);
    trackOAuthClient(client.name);

    const accessToken = await getAccessTokenWithScope(request, client, "profile");

    const response = await request.get("/api/oauth/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(response.status()).toBe(403);
    expect(await response.json()).toEqual({
      error: "insufficient_scope",
      error_description: "This endpoint requires the openid scope",
    });
  });

  test("returns only safe fields for a valid token with the openid and email scopes", async ({
    request,
    createUser,
    trackOAuthClient,
  }) => {
    const user = await createUser({ prefix: "oauth-me" });
    await loginViaApi(request, user);
    const client = await registerOAuthClient(request);
    trackOAuthClient(client.name);

    const accessToken = await getAccessTokenWithScope(
      request,
      client,
      "openid email",
    );

    const response = await request.get("/api/oauth/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      sub: user.id,
      email: user.email,
      scope: "openid email",
    });
  });

  test("omits the email claim when only the openid scope was granted", async ({
    request,
    createUser,
    trackOAuthClient,
  }) => {
    const user = await createUser({ prefix: "oauth-me" });
    await loginViaApi(request, user);
    const client = await registerOAuthClient(request);
    trackOAuthClient(client.name);

    const accessToken = await getAccessTokenWithScope(request, client, "openid");

    const response = await request.get("/api/oauth/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ sub: user.id, scope: "openid" });
  });
});
