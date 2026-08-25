"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Alert, Button } from "@/app/(auth)/_components/ui";

// Apps that can't scan want the bare base32 secret, not the whole otpauth:// URI
function secretFromUri(uri: string) {
  try {
    return new URL(uri).searchParams.get("secret");
  } catch {
    return null;
  }
}

export function TotpSetup({ totpEnabled }: { totpEnabled: boolean }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(totpEnabled);
  const [uri, setUri] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSetup() {
    setError(null);
    setSuccess(null);
    setPending(true);

    try {
      const response = await fetch("/api/auth/totp/setup", { method: "POST" });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Could not start authenticator setup");
        return;
      }

      setUri(data.uri);
      setCode("");
      // The route clears totpEnabled when it issues a new secret, so the badge
      // has to follow it back to "Not set up" until the new code is confirmed
      setEnabled(false);
    } catch {
      setError("Could not start authenticator setup");
    } finally {
      setPending(false);
    }
  }

  async function handleVerify(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setVerifying(true);

    try {
      const response = await fetch("/api/auth/totp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Could not verify that code");
        return;
      }

      setEnabled(true);
      setUri(null);
      setCode("");
      setSuccess("Authenticator app enabled");
      router.refresh();
    } catch {
      setError("Could not verify that code");
    } finally {
      setVerifying(false);
    }
  }

  function handleCancel() {
    setUri(null);
    setCode("");
    setError(null);
  }

  return (
    <section className="rounded-[12px] border border-border-card bg-surface">
      <header className="flex items-start justify-between gap-4 border-b border-border-divider px-5 py-4">
        <div className="space-y-0.5">
          <h2 className="text-[15px] font-semibold text-text-primary">
            Authenticator app
          </h2>
          <p className="text-xs text-text-muted">
            Time-based codes as a backup when a passkey isn&apos;t available.
          </p>
        </div>
        <StatusBadge enabled={enabled} />
      </header>

      <div className="space-y-4 px-5 py-4">
        {uri ? (
          <div className="space-y-4">
            <Step
              number={1}
              title="Scan the QR code"
              description="Open your authenticator app and add a new account."
            >
              <div className="flex w-fit justify-center rounded-[10px] border border-border-card bg-white p-3">
                {/* Fixed white background and black modules: inheriting the
                    dark theme's colors would invert the code and break scanning */}
                <QRCodeSVG
                  value={uri}
                  size={160}
                  bgColor="#ffffff"
                  fgColor="#000000"
                  marginSize={0}
                  title="TOTP setup QR code"
                />
              </div>

              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-text-muted transition hover:text-text-primary">
                  Can&apos;t scan? Enter the setup key
                </summary>
                <code className="mt-1.5 block break-all rounded-[8px] border border-border-card bg-surface-subtle px-3 py-2 font-mono text-xs tracking-wider text-text-secondary">
                  {secretFromUri(uri) ?? uri}
                </code>
              </details>
            </Step>

            <Step
              number={2}
              title="Enter the 6-digit code"
              description="Confirms the app is generating the right codes."
            >
              <form onSubmit={handleVerify} className="flex flex-wrap gap-2">
                <input
                  value={code}
                  // Digits only: a pasted code with spaces or a stray letter
                  // would otherwise fail the route's /^\d{6}$/ check
                  onChange={(event) =>
                    setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  aria-label="6-digit authentication code"
                  disabled={verifying}
                  className="h-11 w-36 rounded-[8px] border border-border bg-surface px-3 text-center font-mono text-base tracking-[0.4em] text-text-primary outline-none transition placeholder:tracking-[0.4em] placeholder:text-text-tertiary focus:border-accent focus:ring-3 focus:ring-accent-ring disabled:opacity-60"
                />
                <Button
                  variant="primary"
                  type="submit"
                  disabled={code.length !== 6 || verifying}
                  pending={verifying}
                >
                  {verifying ? "Verifying…" : "Verify"}
                </Button>
                <Button onClick={handleCancel} disabled={verifying}>
                  Cancel
                </Button>
              </form>
            </Step>
          </div>
        ) : (
          <p className="text-sm text-text-secondary">
            {enabled
              ? "Your authenticator app is set up. Replacing it invalidates the current one."
              : "Not set up yet. Add an authenticator app to generate sign-in codes."}
          </p>
        )}

        {error ? <Alert>{error}</Alert> : null}
        {success ? <Alert variant="success">{success}</Alert> : null}

        {uri ? null : (
          <div className="space-y-2">
            <Button
              variant={enabled ? "secondary" : "primary"}
              onClick={handleSetup}
              disabled={pending}
              pending={pending}
            >
              {pending
                ? "Generating…"
                : enabled
                  ? "Replace authenticator app"
                  : "Set up authenticator app"}
            </Button>
            {enabled ? (
              <Alert variant="warning">
                Replacing turns two-factor off until you confirm a code from
                the new app.
              </Alert>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}

function StatusBadge({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
        enabled
          ? "border-success-border bg-success-bg text-success-text"
          : "border-border-card bg-surface-subtle text-text-muted"
      }`}
    >
      <span
        aria-hidden
        className={`h-1.5 w-1.5 rounded-full ${
          enabled ? "bg-accent" : "bg-text-tertiary"
        }`}
      />
      {enabled ? "Enabled" : "Not set up"}
    </span>
  );
}

function Step({
  number,
  title,
  description,
  children,
}: {
  number: number;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border-card text-xs font-semibold text-text-muted">
        {number}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-text-primary">{title}</p>
        <p className="mb-2 text-xs text-text-muted">{description}</p>
        {children}
      </div>
    </div>
  );
}
