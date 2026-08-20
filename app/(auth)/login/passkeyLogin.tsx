"use client";

import { useState } from "react";
import {
  Alert,
  Card,
  CardHeader,
  Field,
  SubmitButton,
} from "../_components/ui";
import { startAuthentication } from "@simplewebauthn/browser";
import { useRouter } from "next/navigation";

type Errors = { email?: string };

const PasskeyLogin = () => {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState("");

  const handlePasskey = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");

    const next: Errors = {};
    if (!email.includes("@")) next.email = "Enter a valid email address.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setPending(true);

    try {
      const response = await fetch("/api/webauthn/auth/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setFormError(data.error ?? "Something went wrong. Try again.");
        setPending(false);
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
        setPending(false);
        return;
      }

      router.replace("/");
      router.refresh();
    } catch {
      setFormError("Network error. Check your connection and try again.");
      setPending(false);
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
          disabled={pending}
          required
        />

        <SubmitButton pending={pending}>Login with Passkey</SubmitButton>
      </form>
    </Card>
  );
};

export default PasskeyLogin;
