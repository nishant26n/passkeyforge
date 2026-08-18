"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Alert,
  Card,
  CardHeader,
  Divider,
  Field,
  PasskeyButton,
  PasswordField,
  SubmitButton,
} from "../_components/ui";

type Errors = { email?: string; password?: string };

const STRENGTH_LABELS = ["Too short", "Weak", "Fair", "Strong"];
const STRENGTH_COLORS = [
  "bg-red-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-emerald-500",
];

/** 0-3 score from length plus character variety. */
function scorePassword(value: string) {
  if (value.length < 8) return 0;
  const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^\w]/].filter((re) =>
    re.test(value),
  ).length;
  if (variety >= 4 && value.length >= 12) return 3;
  if (variety >= 3) return 2;
  return 1;
}

export function RegisterForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const score = scorePassword(password);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const next: Errors = {};
    if (!email.includes("@")) next.email = "Enter a valid email address.";
    if (password.length < 8) next.password = "Use at least 8 characters.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setPending(true);

    try {
      const response = await fetch("/api/auth/register", {
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

      // Register does not create a session; send them through sign in.
      router.replace("/login?registered=1");
    } catch {
      setFormError("Network error. Check your connection and try again.");
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Create your account"
        subtitle="Start forging passkeys in under a minute."
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

        <div className="space-y-2">
          <PasswordField
            label="Password"
            name="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            disabled={pending}
            required
          />

          {password ? (
            <div className="flex items-center gap-3">
              <div className="flex flex-1 gap-1" aria-hidden>
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      i <= score
                        ? STRENGTH_COLORS[score]
                        : "bg-zinc-200 dark:bg-zinc-800"
                    }`}
                  />
                ))}
              </div>
              <span
                aria-live="polite"
                className="w-16 text-right text-xs text-zinc-500 dark:text-zinc-400"
              >
                {STRENGTH_LABELS[score]}
              </span>
            </div>
          ) : null}
        </div>

        <SubmitButton pending={pending}>Create account</SubmitButton>

        <p className="text-center text-xs leading-5 text-zinc-500 dark:text-zinc-400">
          By creating an account you agree to our{" "}
          <a
            href="/terms"
            className="underline underline-offset-4 hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            Terms
          </a>{" "}
          and{" "}
          <a
            href="/privacy"
            className="underline underline-offset-4 hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            Privacy Policy
          </a>
          .
        </p>
      </form>

      <div className="my-6">
        <Divider>or</Divider>
      </div>

      <PasskeyButton>Sign up with a passkey</PasskeyButton>
    </Card>
  );
}
