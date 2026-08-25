"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Alert,
  CardHeader,
  Divider,
  Field,
  PasskeyButton,
  PasswordField,
  SubmitButton,
} from "../_components/ui";

type Errors = { email?: string; password?: string };

export function LoginForm({ registered }: { registered?: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const next: Errors = {};
    if (!email.includes("@")) next.email = "Enter a valid email address.";
    if (!password) next.password = "Enter your password.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setPending(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setFormError(data.error ?? "Something went wrong. Try again.");
        setPending(false);
        return;
      }

      // Session cookie is set by the API; refresh so server components see it.
      router.replace("/");
      router.refresh();
    } catch {
      setFormError("Network error. Check your connection and try again.");
      setPending(false);
    }
  }

  return (
    <div className="w-full">
      <CardHeader
        title="Welcome back"
        subtitle="Sign in to continue to Passkey Forge."
      />

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {registered && !formError ? (
          <Alert variant="success">Account created. Sign in to continue.</Alert>
        ) : null}
        {formError ? <Alert>{formError}</Alert> : null}

        <Field
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          disabled={pending}
          required
        />

        <PasswordField
          label="Password"
          name="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          disabled={pending}
          required
          hint={
            <Link
              href="/recovery"
              className="text-xs text-text-muted underline-offset-4 hover:underline hover:text-accent"
            >
              Forgot password?
            </Link>
          }
        />

        <SubmitButton pending={pending}>Sign in</SubmitButton>
      </form>

      <div className="my-6">
        <Divider>or</Divider>
      </div>

      <div className="flex flex-col gap-5">
        <PasskeyButton
          disabled={pending}
          onClick={() => router.push("/login/passkey")}
        >
          Continue with a passkey
        </PasskeyButton>

        <PasskeyButton
          disabled={pending}
          onClick={() => router.push("/authenticator-login")}
        >
          Use authenticator code
        </PasskeyButton>
      </div>

      <div className="mt-4 w-full text-center">
        <Link
          href="/recovery"
          className="text-sm text-text-muted underline-offset-4 hover:underline hover:text-accent"
        >
          Recover your account
        </Link>
      </div>
    </div>
  );
}
