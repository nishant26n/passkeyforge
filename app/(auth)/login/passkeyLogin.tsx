"use client";

import { useState } from "react";
import {
  Alert,
  Card,
  CardHeader,
  Divider,
  Field,
  PasskeyButton,
  SubmitButton,
} from "../_components/ui";
import { startAuthentication } from "@simplewebauthn/browser";
import { useRouter } from "next/navigation";

type Errors = { email?: string };
type PendingAction = "email" | "usernameless" | null;

const PasskeyLogin = () => {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  // Tracks which of the two buttons triggered the ceremony, so only that
  // one shows a spinner — a shared boolean would spin both at once.
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [formError, setFormError] = useState("");

  /** Requests options, runs the ceremony, and verifies — shared by the
   * email-first and usernameless flows, which only differ in the request
   * body sent to /api/webauthn/auth/options. */
  const authenticate = async (optionsBody: Record<string, unknown>) => {
    const response = await fetch("/api/webauthn/auth/options", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(optionsBody),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setFormError(data.error ?? "Something went wrong. Try again.");
      setPendingAction(null);
      return;
    }

    const authenticationResponse = await startAuthentication({
      optionsJSON: data,
    });

    const verifyResponse = await fetch("/api/webauthn/auth/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(authenticationResponse),
    });

    const verifyData = await verifyResponse.json().catch(() => ({}));

    if (!verifyResponse.ok) {
      setFormError(verifyData.error ?? "Passkey authentication failed.");
      setPendingAction(null);
      return;
    }

    router.replace("/");
    router.refresh();
  };

  const handlePasskey = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");

    const next: Errors = {};
    if (!email.includes("@")) next.email = "Enter a valid email address.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setPendingAction("email");

    try {
      await authenticate({ email });
    } catch {
      setFormError("Network error. Check your connection and try again.");
      setPendingAction(null);
    }
  };

  const handleUsernameless = async () => {
    setFormError("");
    setPendingAction("usernameless");

    try {
      await authenticate({ usernameless: true });
    } catch {
      setFormError("Network error. Check your connection and try again.");
      setPendingAction(null);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Sign in with a passkey"
        subtitle="Enter your email to continue."
      />

      <form onSubmit={handlePasskey} noValidate className="space-y-4">
        {formError ? <Alert>{formError}</Alert> : null}
        <Field
          label="Email"
          type="email"
          name="email"
          autoComplete="email webauthn"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          disabled={pendingAction !== null}
          required
        />

        <SubmitButton
          pending={pendingAction === "email"}
          disabled={pendingAction !== null}
        >
          Login with Passkey
        </SubmitButton>
      </form>

      <div className="my-6">
        <Divider>or</Divider>
      </div>

      <PasskeyButton
        pending={pendingAction === "usernameless"}
        disabled={pendingAction !== null}
        onClick={handleUsernameless}
      >
        Sign in without typing your email
      </PasskeyButton>
    </Card>
  );
};

export default PasskeyLogin;
