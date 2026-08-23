/**
 * Client-only helpers for the OAuth developer/test UI. Nothing here runs on
 * the server — the flow state (including the access token) lives only in
 * this browser tab's sessionStorage, never in localStorage or a cookie.
 */

export type OAuthFlowState = {
  clientId: string;
  redirectUri: string;
  scope: string;
  codeVerifier: string | null;
  codeChallenge: string | null;
  oauthState: string | null;
  authorizationStarted: boolean;
  code: string | null;
  authError: string | null;
  accessToken: string | null;
  tokenType: string | null;
  expiresAt: number | null;
  grantedScope: string | null;
  revokedAt: number | null;
  userInfo: { sub: string; email: string } | null;
  userInfoError: string | null;
  revokedTestResult: "confirmed" | "unexpected" | null;
};

const STORAGE_KEY = "pf_oauth_test_flow";

export const DEFAULT_SCOPE = "openid profile email";

export function defaultRedirectUri() {
  return `${window.location.origin}/oauth/test/callback`;
}

export function emptyFlowState(): OAuthFlowState {
  return {
    clientId: "",
    redirectUri: defaultRedirectUri(),
    scope: DEFAULT_SCOPE,
    codeVerifier: null,
    codeChallenge: null,
    oauthState: null,
    authorizationStarted: false,
    code: null,
    authError: null,
    accessToken: null,
    tokenType: null,
    expiresAt: null,
    grantedScope: null,
    revokedAt: null,
    userInfo: null,
    userInfoError: null,
    revokedTestResult: null,
  };
}

export function loadFlowState(): OAuthFlowState {
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return emptyFlowState();

  try {
    return { ...emptyFlowState(), ...JSON.parse(raw) };
  } catch {
    return emptyFlowState();
  }
}

export function saveFlowState(state: OAuthFlowState) {
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function clearFlowState() {
  window.sessionStorage.removeItem(STORAGE_KEY);
}

function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Cryptographically random, URL-safe token — used for both the PKCE code_verifier and the state param. */
export function generateRandomToken(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

/** S256 PKCE code_challenge derived from a code_verifier. */
export async function deriveCodeChallenge(codeVerifier: string) {
  const data = new TextEncoder().encode(codeVerifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(new Uint8Array(digest));
}

/** Shows only enough of a secret to eyeball-diff it, never the full value. */
export function maskSecret(value: string) {
  if (value.length <= 10) return "•".repeat(value.length);
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export function buildAuthorizeUrl(flow: OAuthFlowState) {
  if (!flow.codeChallenge || !flow.oauthState) {
    throw new Error("PKCE and state must be generated before starting authorization");
  }

  const url = new URL("/api/oauth/authorize", window.location.origin);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", flow.clientId);
  url.searchParams.set("redirect_uri", flow.redirectUri);
  if (flow.scope) url.searchParams.set("scope", flow.scope);
  url.searchParams.set("state", flow.oauthState);
  url.searchParams.set("code_challenge", flow.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}
