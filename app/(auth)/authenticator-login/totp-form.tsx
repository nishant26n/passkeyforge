"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Alert,
  Card,
  CardHeader,
  Field,
  SubmitButton,
} from "../_components/ui";
import { useRouter } from "next/navigation";

type Errors = { email?: string; code?: string };

export function TOTPForm() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const next: Errors = {};
    if (!email.includes("@")) next.email = "Enter a valid email address.";
    if (!/^\d{6}$/.test(code)) next.code = "Enter the 6-digit code.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setPending(true);

    try {
      const response = await fetch("/api/auth/recovery/totp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setFormError(data.error ?? "Could not verify that code");
        setPending(false);
        return;
      }
      setCode("");

      // Stays pending through the redirect: the session cookie is already set,
      // so re-enabling the form would only invite a second submit
      router.replace("/");
      router.refresh();
    } catch {
      setFormError("Could not verify that code");
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Login with authenticator code"
        subtitle="Use a code from your authenticator app to login."
      />

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
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

        <div className="space-y-1.5">
          <label
            htmlFor="recovery-code"
            className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
          >
            Authentication code
          </label>
          <input
            id="recovery-code"
            name="code"
            value={code}
            // Digits only: a pasted code with spaces would otherwise fail the
            // route's /^\d{6}$/ check
            onChange={(e) =>
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            aria-invalid={errors.code ? true : undefined}
            aria-describedby={errors.code ? "recovery-code-error" : undefined}
            disabled={pending}
            required
            className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-center font-mono text-base tracking-[0.4em] text-zinc-900 outline-none transition placeholder:tracking-[0.4em] placeholder:text-zinc-300 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-700 dark:focus:border-zinc-400 dark:focus:ring-zinc-100/10"
          />
          {errors.code ? (
            <p
              id="recovery-code-error"
              className="text-xs text-red-600 dark:text-red-400"
            >
              {errors.code}
            </p>
          ) : (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Open your authenticator app and enter the current code.
            </p>
          )}
        </div>

        <SubmitButton pending={pending}>Sign in</SubmitButton>
      </form>

      <p className="mt-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
        Lost access to your authenticator app?{" "}
        <Link
          href="/recovery"
          className="font-medium text-zinc-700 underline-offset-4 hover:underline dark:text-zinc-300"
        >
          Use a recovery code
        </Link>
        .
      </p>

      <div className="mt-6 w-full text-center">
        <Link
          href="/login"
          className="text-sm text-zinc-500 underline-offset-4 hover:underline dark:text-zinc-400"
        >
          Back to sign in
        </Link>
      </div>
    </Card>
  );
}
