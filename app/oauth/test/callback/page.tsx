"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Alert, Card, CardHeader } from "@/app/(auth)/_components/ui";
import { loadFlowState, saveFlowState } from "../lib";

type Status = "processing" | "success" | "error";

export default function OAuthTestCallbackPage() {
  const [status, setStatus] = useState<Status>("processing");
  const [message, setMessage] = useState<string | null>(null);
  // The authorization code is single-use; React Strict Mode's dev-only
  // double-invoke of effects would otherwise burn it on a second exchange.
  const hasRunRef = useRef(false);

  useEffect(() => {
    document.title = "OAuth callback · Passkey Forge";

    if (hasRunRef.current) return;
    hasRunRef.current = true;

    async function run() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const returnedState = params.get("state");
      const oauthError = params.get("error");

      const flow = loadFlowState();

      if (oauthError) {
        flow.authError = params.get("error_description") ?? oauthError;
        saveFlowState(flow);
        setStatus("error");
        setMessage(flow.authError);
        return;
      }

      if (!code) {
        flow.authError = "Callback did not include an authorization code.";
        saveFlowState(flow);
        setStatus("error");
        setMessage(flow.authError);
        return;
      }

      if (!flow.oauthState || returnedState !== flow.oauthState) {
        flow.authError = "State mismatch — possible CSRF. Flow aborted.";
        saveFlowState(flow);
        setStatus("error");
        setMessage(flow.authError);
        return;
      }

      if (!flow.codeVerifier || !flow.clientId || !flow.redirectUri) {
        flow.authError = "Missing PKCE verifier or client configuration in this session.";
        saveFlowState(flow);
        setStatus("error");
        setMessage(flow.authError);
        return;
      }

      flow.code = code;
      flow.authError = null;
      saveFlowState(flow);

      try {
        const response = await fetch("/api/oauth/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            code,
            redirect_uri: flow.redirectUri,
            client_id: flow.clientId,
            code_verifier: flow.codeVerifier,
          }),
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          flow.authError = data.error ?? "Token exchange failed.";
          saveFlowState(flow);
          setStatus("error");
          setMessage(flow.authError);
          return;
        }

        flow.accessToken = data.access_token;
        flow.tokenType = data.token_type;
        flow.expiresAt = Date.now() + Number(data.expires_in ?? 0) * 1000;
        flow.grantedScope = data.scope ?? null;
        flow.revokedAt = null;
        flow.revokedTestResult = null;
        flow.userInfo = null;
        flow.userInfoError = null;
        // No longer needed once the code has been exchanged.
        flow.codeVerifier = null;
        saveFlowState(flow);

        setStatus("success");
      } catch {
        flow.authError = "Network error during token exchange.";
        saveFlowState(flow);
        setStatus("error");
        setMessage(flow.authError);
      }
    }

    run();
  }, []);

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-10 font-sans dark:bg-black">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader
            title="OAuth callback"
            subtitle="Exchanging the authorization code for an access token."
          />

          {status === "processing" ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Working…</p>
          ) : status === "success" ? (
            <Alert variant="success">Access token obtained.</Alert>
          ) : (
            <Alert>{message}</Alert>
          )}

          <Link
            href="/oauth/test"
            className="mt-6 flex h-11 w-full items-center justify-center rounded-lg bg-zinc-900 text-sm font-medium text-zinc-50 transition hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Continue to test client
          </Link>
        </Card>
      </div>
    </div>
  );
}
