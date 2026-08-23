"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert, Card, CardHeader, Field } from "@/app/(auth)/_components/ui";
import {
  DEFAULT_SCOPE,
  buildAuthorizeUrl,
  clearFlowState,
  defaultRedirectUri,
  deriveCodeChallenge,
  emptyFlowState,
  generateRandomToken,
  loadFlowState,
  maskSecret,
  saveFlowState,
  type OAuthFlowState,
} from "./lib";

type CurrentUser = { email: string } | null | "loading";

export default function OAuthTestPage() {
  const [flow, setFlow] = useState<OAuthFlowState | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser>("loading");

  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  const [userInfoLoading, setUserInfoLoading] = useState(false);
  const [revokeLoading, setRevokeLoading] = useState(false);
  const [revokeTestLoading, setRevokeTestLoading] = useState(false);

  useEffect(() => {
    document.title = "OAuth test client · Passkey Forge";
    setFlow(loadFlowState());

    fetch("/api/auth/me")
      .then(async (response) => {
        if (!response.ok) {
          setCurrentUser(null);
          return;
        }
        const data = await response.json();
        setCurrentUser({ email: data.user.email });
      })
      .catch(() => setCurrentUser(null));
  }, []);

  function update(patch: Partial<OAuthFlowState>) {
    setFlow((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      saveFlowState(next);
      return next;
    });
  }

  async function handleRegisterClient() {
    setRegisterError(null);
    setRegistering(true);
    try {
      const response = await fetch("/api/oauth/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "OAuth Test Client",
          redirectUris: [flow?.redirectUri ?? defaultRedirectUri()],
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setRegisterError(
          response.status === 401
            ? "Sign in first, then register a test client."
            : (data.error ?? "Failed to register client."),
        );
        return;
      }

      // The client secret is returned here once but this is a PKCE public
      // client flow — it is never needed again, so it is discarded unread.
      update({ clientId: data.create.clientId });
    } catch {
      setRegisterError("Network error while registering client.");
    } finally {
      setRegistering(false);
    }
  }

  async function handleGeneratePkce() {
    if (!flow) return;
    const codeVerifier = generateRandomToken(32);
    const codeChallenge = await deriveCodeChallenge(codeVerifier);
    const oauthState = generateRandomToken(16);
    update({ codeVerifier, codeChallenge, oauthState });
  }

  function handleStartAuthorization() {
    if (!flow) return;
    // Write directly rather than through the React state updater: the
    // updater runs on the next render, which is not guaranteed to happen
    // before the synchronous navigation below starts.
    const next = { ...flow, authorizationStarted: true };
    saveFlowState(next);
    window.location.href = buildAuthorizeUrl(next);
  }

  async function handleGetUserInfo() {
    if (!flow?.accessToken) return;
    setUserInfoLoading(true);
    try {
      const response = await fetch("/api/oauth/userInfo", {
        headers: { Authorization: `Bearer ${flow.accessToken}` },
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        update({ userInfo: null, userInfoError: data.error ?? "request_failed" });
        return;
      }

      update({ userInfo: data, userInfoError: null });
    } catch {
      update({ userInfo: null, userInfoError: "network_error" });
    } finally {
      setUserInfoLoading(false);
    }
  }

  async function handleRevoke() {
    if (!flow?.accessToken) return;
    setRevokeLoading(true);
    try {
      const response = await fetch("/api/oauth/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: flow.accessToken }),
      });

      if (response.ok) {
        update({ revokedAt: Date.now(), revokedTestResult: null });
      }
    } finally {
      setRevokeLoading(false);
    }
  }

  async function handleTestRevokedToken() {
    if (!flow?.accessToken) return;
    setRevokeTestLoading(true);
    try {
      const response = await fetch("/api/oauth/userInfo", {
        headers: { Authorization: `Bearer ${flow.accessToken}` },
      });
      const data = await response.json().catch(() => ({}));

      const confirmed = response.status === 401 && data.error === "invalid_token";
      update({ revokedTestResult: confirmed ? "confirmed" : "unexpected" });
    } finally {
      setRevokeTestLoading(false);
    }
  }

  function handleReset() {
    if (!flow) return;
    clearFlowState();
    const next = {
      ...emptyFlowState(),
      clientId: flow.clientId,
      redirectUri: flow.redirectUri,
      scope: flow.scope,
    };
    saveFlowState(next);
    setFlow(next);
  }

  if (!flow) return null;

  const steps = [
    { label: "Client configured", done: Boolean(flow.clientId && flow.redirectUri) },
    { label: "PKCE generated", done: Boolean(flow.codeChallenge) },
    { label: "Authorization", done: flow.authorizationStarted },
    { label: "Authorization code", done: Boolean(flow.code && !flow.authError) },
    { label: "Access token", done: Boolean(flow.accessToken) },
    { label: "UserInfo", done: Boolean(flow.userInfo) },
    { label: "Token revocation", done: Boolean(flow.revokedAt) },
  ];

  const tokenStatus = !flow.accessToken
    ? "Not obtained"
    : flow.revokedAt
      ? "Revoked"
      : flow.expiresAt && flow.expiresAt <= Date.now()
        ? "Expired"
        : "Active";

  const canStart = Boolean(
    flow.clientId &&
      flow.redirectUri &&
      flow.codeChallenge &&
      flow.oauthState &&
      currentUser &&
      currentUser !== "loading",
  );

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10 font-sans dark:bg-black sm:py-14">
      <div className="w-full max-w-2xl">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
            aria-hidden
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Back
        </Link>

        <header className="mt-4 mb-6 space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            OAuth test client
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {currentUser === "loading"
              ? "Checking session…"
              : currentUser
                ? `Signed in as ${currentUser.email}`
                : "Not signed in"}
          </p>
        </header>

        {currentUser === null ? (
          <div className="mb-6">
            <Alert>
              Not signed in.{" "}
              <Link href="/login" className="underline underline-offset-4">
                Sign in
              </Link>{" "}
              through the normal Passkey Forge login, then come back to this page to
              continue.
            </Alert>
          </div>
        ) : null}

        <div className="mb-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-3 text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Flow status
          </h2>
          <ol className="space-y-1.5 text-sm">
            {steps.map((step, index) => (
              <li key={step.label} className="flex items-center gap-2">
                <span
                  className={
                    step.done
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-zinc-400 dark:text-zinc-600"
                  }
                >
                  {step.done ? "✓" : "○"}
                </span>
                <span className="text-zinc-700 dark:text-zinc-300">
                  {index + 1}. {step.label}
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader
              title="1. OAuth client"
              subtitle="Register a test client or enter one that already exists."
            />
            <div className="space-y-4">
              <Field
                label="Client ID"
                value={flow.clientId}
                onChange={(e) => update({ clientId: e.target.value })}
                placeholder="pf_client_…"
              />
              <Field
                label="Redirect URI"
                value={flow.redirectUri}
                onChange={(e) => update({ redirectUri: e.target.value })}
              />
              <Field
                label="Scope"
                value={flow.scope}
                onChange={(e) => update({ scope: e.target.value })}
                placeholder={DEFAULT_SCOPE}
              />
              {registerError ? <Alert>{registerError}</Alert> : null}
              <button
                type="button"
                onClick={handleRegisterClient}
                disabled={registering}
                className="flex h-11 w-full items-center justify-center rounded-lg border border-zinc-300 bg-white text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
              >
                {registering ? "Registering…" : "Register new test client"}
              </button>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Registration requires a signed-in session. The client secret is
                issued once by the API but is never shown here — this flow only
                needs the client ID plus PKCE.
              </p>
            </div>
          </Card>

          <Card>
            <CardHeader title="2. PKCE" subtitle="Generated in the browser with Web Crypto." />
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleGeneratePkce}
                className="flex h-11 w-full items-center justify-center rounded-lg border border-zinc-300 bg-white text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
              >
                Generate PKCE + state
              </button>
              {flow.codeChallenge ? (
                <dl className="space-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                  <div>
                    <dt className="inline font-medium">code_challenge: </dt>
                    <dd className="inline break-all">{flow.codeChallenge}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium">code_verifier: </dt>
                    <dd className="inline break-all">
                      {flow.codeVerifier
                        ? `${maskSecret(flow.codeVerifier)} (kept in sessionStorage)`
                        : "consumed by the token exchange"}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline font-medium">state: </dt>
                    <dd className="inline break-all">{flow.oauthState}</dd>
                  </div>
                </dl>
              ) : null}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="3. Authorization"
              subtitle="Navigates the browser to the real /api/oauth/authorize endpoint."
            />
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleStartAuthorization}
                disabled={!canStart}
                className="flex h-11 w-full items-center justify-center rounded-lg bg-zinc-900 text-sm font-medium text-zinc-50 transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Start OAuth Login
              </button>
              {!canStart && currentUser !== "loading" ? (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Needs a client ID, redirect URI, generated PKCE, and a signed-in
                  session before it can start.
                </p>
              ) : null}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="4. Authorization code"
              subtitle="Set by the callback page after the redirect back from /authorize."
            />
            {flow.authError ? (
              <Alert>{flow.authError}</Alert>
            ) : flow.code ? (
              <p className="text-sm text-zinc-700 dark:text-zinc-300">
                Code received: <span className="break-all font-mono text-xs">{maskSecret(flow.code)}</span>
              </p>
            ) : (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                No authorization code yet. Complete step 3 to get one.
              </p>
            )}
          </Card>

          <Card>
            <CardHeader
              title="5. Access token"
              subtitle="Exchanged by the callback page via POST /api/oauth/token."
            />
            <dl className="space-y-1.5 text-sm text-zinc-700 dark:text-zinc-300">
              <div className="flex justify-between">
                <dt className="text-zinc-500 dark:text-zinc-400">Status</dt>
                <dd>{tokenStatus}</dd>
              </div>
              {flow.tokenType ? (
                <div className="flex justify-between">
                  <dt className="text-zinc-500 dark:text-zinc-400">Token type</dt>
                  <dd>{flow.tokenType}</dd>
                </div>
              ) : null}
              {flow.expiresAt ? (
                <div className="flex justify-between">
                  <dt className="text-zinc-500 dark:text-zinc-400">Expires</dt>
                  <dd>{new Date(flow.expiresAt).toLocaleTimeString()}</dd>
                </div>
              ) : null}
              {flow.grantedScope ? (
                <div className="flex justify-between">
                  <dt className="text-zinc-500 dark:text-zinc-400">Scope</dt>
                  <dd>{flow.grantedScope}</dd>
                </div>
              ) : null}
            </dl>
          </Card>

          <Card>
            <CardHeader
              title="6. UserInfo"
              subtitle="GET /api/oauth/userInfo with the access token as a Bearer header."
            />
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleGetUserInfo}
                disabled={!flow.accessToken || userInfoLoading}
                className="flex h-11 w-full items-center justify-center rounded-lg border border-zinc-300 bg-white text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
              >
                {userInfoLoading ? "Loading…" : "Get User Info"}
              </button>
              {flow.userInfoError ? <Alert>{flow.userInfoError}</Alert> : null}
              {flow.userInfo ? (
                <pre className="overflow-x-auto rounded-lg bg-zinc-100 p-3 text-xs text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
                  {JSON.stringify(flow.userInfo, null, 2)}
                </pre>
              ) : null}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="7. Token revocation"
              subtitle="POST /api/oauth/revoke, then a follow-up UserInfo call to confirm rejection."
            />
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleRevoke}
                disabled={!flow.accessToken || Boolean(flow.revokedAt) || revokeLoading}
                className="flex h-11 w-full items-center justify-center rounded-lg border border-zinc-300 bg-white text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
              >
                {revokeLoading ? "Revoking…" : "Revoke Access Token"}
              </button>

              {flow.revokedAt ? (
                <Alert variant="success">Token revoked</Alert>
              ) : null}

              <button
                type="button"
                onClick={handleTestRevokedToken}
                disabled={!flow.revokedAt || revokeTestLoading}
                className="flex h-11 w-full items-center justify-center rounded-lg border border-zinc-300 bg-white text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
              >
                {revokeTestLoading ? "Testing…" : "Test Revoked Token"}
              </button>

              {flow.revokedTestResult === "confirmed" ? (
                <Alert variant="success">
                  Revocation verified — the revoked token was rejected with 401
                  invalid_token.
                </Alert>
              ) : null}
              {flow.revokedTestResult === "unexpected" ? (
                <Alert>
                  Unexpected result: the revoked token was not rejected as
                  invalid_token.
                </Alert>
              ) : null}
            </div>
          </Card>

          <button
            type="button"
            onClick={handleReset}
            className="text-sm text-zinc-500 underline-offset-4 hover:underline dark:text-zinc-400"
          >
            Reset flow
          </button>
        </div>
      </div>
    </div>
  );
}
