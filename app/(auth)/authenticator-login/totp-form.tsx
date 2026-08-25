"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Alert,
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
    <div className="w-full">
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

        <div className="space-y-[7px]">
          <label
            htmlFor="recovery-code"
            className="text-[13px] font-semibold text-text-secondary"
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
            className="h-[52px] w-full rounded-[8px] border border-border bg-surface px-3 text-center font-mono text-[22px] tracking-[0.42em] text-text-primary outline-none transition shadow-[0_1px_2px_rgba(16,20,22,0.04)] placeholder:tracking-[0.42em] placeholder:text-text-tertiary focus:border-accent focus:ring-3 focus:ring-accent-ring disabled:opacity-60"
          />
          {errors.code ? (
            <p id="recovery-code-error" className="text-xs text-error-text">
              {errors.code}
            </p>
          ) : (
            <p className="text-xs text-text-muted">
              Open your authenticator app and enter the current code.
            </p>
          )}
        </div>

        <SubmitButton pending={pending}>Sign in</SubmitButton>
      </form>

      <div className="mt-[22px] space-y-[10px] border-t border-border-hairline pt-[18px]">
        <p className="text-[13px] leading-5 text-text-muted">
          Lost access to your authenticator app? Contact support to regain
          access to your account.{" "}
          <Link
            href="/recovery"
            className="font-semibold text-accent hover:text-accent-hover"
          >
            Use a recovery code
          </Link>
          .
        </p>
        <Link
          href="/login"
          className="block text-[13px] font-semibold text-accent hover:text-accent-hover"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
