"use client";

import { useState } from "react";
import { PasskeyError, usePasskey } from "use-passkey";
import {
  Alert,
  CardHeader,
  Divider,
  Field,
  PasskeyButton,
  SubmitButton,
} from "../_components/ui";
import { useRouter } from "next/navigation";

type Errors = { email?: string };

function describeLoginError(err: unknown): string {
  if (err instanceof PasskeyError) {
    if (err.code === "network_error") {
      return "Network error. Check your connection and try again.";
    }
    return err.message;
  }
  return "Network error. Check your connection and try again.";
}

const PasskeyLogin = () => {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState("");

  // Two independent hook instances, one per button, so each has its own
  // isLoggingIn flag. A single shared instance would spin both buttons on
  // every click — the exact bug this app shipped and fixed before
  // use-passkey existed; using one instance for both here would bring it
  // straight back.
  const emailAuth = usePasskey();
  const usernamelessAuth = usePasskey();
  const pending = emailAuth.isLoggingIn || usernamelessAuth.isLoggingIn;

  const handlePasskey = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");

    const next: Errors = {};
    if (!email.includes("@")) next.email = "Enter a valid email address.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    try {
      await emailAuth.login({ email });
      router.replace("/");
      router.refresh();
    } catch (err) {
      setFormError(describeLoginError(err));
    }
  };

  const handleUsernameless = async () => {
    setFormError("");

    try {
      await usernamelessAuth.login({ usernameless: true });
      router.replace("/");
      router.refresh();
    } catch (err) {
      setFormError(describeLoginError(err));
    }
  };

  return (
    <div className="w-full">
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

        <SubmitButton pending={emailAuth.isLoggingIn} disabled={pending}>
          Login with Passkey
        </SubmitButton>
      </form>

      <div className="my-6">
        <Divider>or</Divider>
      </div>

      <PasskeyButton
        pending={usernamelessAuth.isLoggingIn}
        disabled={pending}
        onClick={handleUsernameless}
      >
        Sign in without typing your email
      </PasskeyButton>
    </div>
  );
};

export default PasskeyLogin;
