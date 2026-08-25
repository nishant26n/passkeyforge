"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Alert,
  CardHeader,
  Field,
  SubmitButton,
} from "../_components/ui";

const CODE_LENGTH = 12;

// Codes are stored as AAAA-BBBB-CCCC. Rebuilding that shape on every keystroke
// lets a user paste an unformatted or lowercase code and still match the hash.
function formatCode(raw: string) {
  const cleaned = raw
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, CODE_LENGTH);

  return cleaned.replace(/(.{4})(?=.)/g, "$1-");
}

type Errors = { email?: string; code?: string };

export default function RecoveryUI() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    // Without this the browser does its own GET submit and reloads the page,
    // aborting the fetch below
    event.preventDefault();
    setError("");

    const next: Errors = {};
    if (!email.includes("@")) next.email = "Enter a valid email address.";
    if (code.replace(/-/g, "").length !== CODE_LENGTH)
      next.code = "Enter the full 12-character recovery code.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setPending(true);

    try {
      const response = await fetch("/api/auth/recovery/code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, code }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.error || "Failed to recover account");
        setPending(false);
        return;
      }

      setCode("");

      // Stays pending through the redirect: the code is spent and the session
      // cookie is set, so re-enabling the form would only invite a dead retry
      router.replace("/");
      router.refresh();
    } catch (err) {
      console.error("Recovery error:", err);
      setError("Failed to recover account");
      setPending(false);
    }
  };

  return (
    <div className="w-full">
      <CardHeader
        title="Use a recovery code"
        subtitle="Sign in with one of the codes you saved when you set up your account."
      />

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {error ? <Alert>{error}</Alert> : null}

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
            Recovery code
          </label>
          <input
            id="recovery-code"
            name="code"
            value={code}
            onChange={(e) => setCode(formatCode(e.target.value))}
            autoComplete="one-time-code"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="XXXX-XXXX-XXXX"
            aria-invalid={errors.code ? true : undefined}
            aria-describedby={
              errors.code ? "recovery-code-error" : "recovery-code-hint"
            }
            disabled={pending}
            required
            className="h-[52px] w-full rounded-[8px] border border-border bg-surface px-3 text-center font-mono text-[19px] tracking-[0.22em] text-text-primary outline-none transition shadow-[0_1px_2px_rgba(16,20,22,0.04)] placeholder:tracking-[0.22em] placeholder:text-text-tertiary focus:border-accent focus:ring-3 focus:ring-accent-ring disabled:opacity-60"
          />
          {errors.code ? (
            <p id="recovery-code-error" className="text-xs text-error-text">
              {errors.code}
            </p>
          ) : (
            <p id="recovery-code-hint" className="text-xs text-text-muted">
              Each code works once. Dashes are added for you.
            </p>
          )}
        </div>

        <SubmitButton pending={pending}>Sign in</SubmitButton>
      </form>

      <div className="mt-[22px] space-y-2 border-t border-border-hairline pt-[18px] text-center">
        <p className="text-[13px]">
          <Link
            href="/authenticator-login"
            className="text-text-muted hover:text-accent"
          >
            Use an authenticator code instead
          </Link>
        </p>
        <p className="text-[13px]">
          <Link href="/login" className="text-text-muted hover:text-accent">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
