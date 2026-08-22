import { expect, type CDPSession, type Page } from "@playwright/test";

/**
 * Chrome's CDP virtual authenticator. This is a real WebAuthn authenticator
 * implementation inside the browser: it generates a real key pair, signs real
 * client data, and the server verifies those signatures normally. Nothing about
 * the application's verification is stubbed or relaxed.
 *
 * `rpID`/`origin` resolve to `localhost` / `http://localhost:3000` outside
 * production (app/lib/webauthn/config.ts), which matches the Playwright
 * `baseURL`, so the ceremony passes the app's real origin and RP ID checks.
 */
export type VirtualAuthenticator = {
  client: CDPSession;
  authenticatorId: string;
  remove: () => Promise<void>;
};

export async function addVirtualAuthenticator(
  page: Page,
): Promise<VirtualAuthenticator> {
  const client = await page.context().newCDPSession(page);

  await client.send("WebAuthn.enable", { enableUI: false });

  const { authenticatorId } = (await client.send(
    "WebAuthn.addVirtualAuthenticator",
    {
      options: {
        protocol: "ctap2",
        transport: "internal",
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    },
  )) as { authenticatorId: string };

  return {
    client,
    authenticatorId,
    remove: async () => {
      await client.send("WebAuthn.removeVirtualAuthenticator", {
        authenticatorId,
      });
    },
  };
}

/**
 * Adds a passkey through the real UI ceremony on the signed-in home page.
 * Requires a virtual authenticator to already be attached to `page`.
 */
export async function registerPasskeyViaUi(page: Page, name?: string) {
  if (name) {
    await page.getByLabel("Name").fill(name);
  }
  await page.getByRole("button", { name: "Add a passkey" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Passkey added" }),
  ).toBeVisible();
}

export type CapturedRequest<T> = { value: T | null };

/**
 * Records the JSON body the page posts to `url`, so a real ceremony's
 * attestation/assertion can be reused by the API level negative tests.
 */
export function captureJsonPost<T>(page: Page, url: string): CapturedRequest<T> {
  const captured: CapturedRequest<T> = { value: null };

  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().endsWith(url)) {
      captured.value = request.postDataJSON() as T;
    }
  });

  return captured;
}

/**
 * Rewrites the `origin` inside a WebAuthn response's clientDataJSON while it is
 * in flight. The authenticator still signs the genuine data — only the value
 * the server checks its origin against is swapped, which is exactly what a
 * cross-origin relay attack looks like from the server's side.
 */
export async function tamperClientDataOrigin(
  page: Page,
  urlGlob: string,
  fakeOrigin: string,
  pick: (body: Record<string, unknown>) => Record<string, unknown>,
) {
  await page.route(urlGlob, async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    const response = pick(body).response as Record<string, unknown>;

    const clientData = JSON.parse(
      Buffer.from(String(response.clientDataJSON), "base64url").toString("utf8"),
    );
    clientData.origin = fakeOrigin;
    response.clientDataJSON = Buffer.from(JSON.stringify(clientData)).toString(
      "base64url",
    );

    await route.continue({ postData: JSON.stringify(body) });
  });
}

/**
 * Runs `fetch` inside the page so the request carries the page's httpOnly
 * session cookie. Used for the API contract tests that must run as the
 * signed-in browser without reading the cookie out of the browser.
 */
export async function fetchFromPage(
  page: Page,
  url: string,
  init?: { method?: string; body?: unknown },
): Promise<{ status: number; body: Record<string, unknown> | null }> {
  return page.evaluate(
    async (args: { url: string; method: string; body: string | null }) => {
      const response = await fetch(args.url, {
        method: args.method,
        headers: args.body ? { "Content-Type": "application/json" } : undefined,
        body: args.body ?? undefined,
      });
      return {
        status: response.status,
        body: (await response.json().catch(() => null)) as Record<
          string,
          unknown
        > | null,
      };
    },
    {
      url,
      method: init?.method ?? "GET",
      body: init?.body === undefined ? null : JSON.stringify(init.body),
    },
  );
}
