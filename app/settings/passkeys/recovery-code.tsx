"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button } from "@/app/(auth)/_components/ui";

// Below this many unused codes, nudge the user to regenerate
const LOW_THRESHOLD = 3;

export function RecoveryCodes({
  remaining,
  total,
  generatedAt,
}: {
  remaining: number;
  total: number;
  generatedAt: string | null;
}) {
  const router = useRouter();
  const hasCodes = total > 0;
  const used = total - remaining;
  const [codes, setCodes] = useState<string[] | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmingReplace, setConfirmingReplace] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setError(null);
    setCopied(false);
    setConfirmingReplace(false);
    setPending(true);

    try {
      const response = await fetch("/api/auth/recovery-codes/generate", {
        method: "POST",
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error ?? "Could not generate recovery codes");
        return;
      }

      setCodes(data.codes ?? []);
      // Pull the fresh remaining/total counts without dropping the codes above
      router.refresh();
    } catch {
      setError("Could not generate recovery codes");
    } finally {
      setPending(false);
    }
  }

  async function handleCopy() {
    if (!codes) return;

    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopied(true);
    } catch {
      // Clipboard is blocked outside a secure context; the codes are on screen
      // anyway, so downgrade to a hint instead of an error
      setError("Copy blocked by the browser. Select the codes manually.");
    }
  }

  function handleDownload() {
    if (!codes) return;

    const body = [
      "Passkey Forge recovery codes",
      `Generated ${new Date().toISOString()}`,
      "",
      "Each code works once. Keep them somewhere safe and offline.",
      "",
      ...codes,
      "",
    ].join("\n");

    const url = URL.createObjectURL(
      new Blob([body], { type: "text/plain;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "passkey-forge-recovery-codes.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="rounded-[12px] border border-border-card bg-surface">
      <header className="flex items-start justify-between gap-4 border-b border-border-divider px-5 py-4">
        <div className="space-y-0.5">
          <h2 className="text-[15px] font-semibold text-text-primary">
            Recovery codes
          </h2>
          <p className="text-xs text-text-muted">
            One-time codes for when every passkey and authenticator is gone.
          </p>
        </div>
        <StatusBadge active={remaining > 0} />
      </header>

      <div className="space-y-4 px-5 py-4">
        {codes ? (
          <>
            <Alert variant="warning">
              These codes are shown once. Save them now — leaving this page
              hides them for good.
            </Alert>

            <ol className="grid grid-cols-1 gap-1.5 rounded-[10px] border border-border-card bg-surface-muted p-3 tablet:grid-cols-2">
              {codes.map((code, index) => (
                <li
                  key={code}
                  className="flex items-center gap-2 font-mono text-sm tracking-wider text-text-primary"
                >
                  <span className="w-5 shrink-0 text-right text-xs text-text-tertiary">
                    {index + 1}
                  </span>
                  {code}
                </li>
              ))}
            </ol>

            <div className="flex flex-wrap gap-2">
              <Button onClick={handleCopy}>
                {copied ? "Copied" : "Copy all"}
              </Button>
              <Button onClick={handleDownload}>Download .txt</Button>
              <Button
                variant="primary"
                onClick={() => {
                  setCodes(null);
                  setCopied(false);
                }}
              >
                I saved them
              </Button>
            </div>
          </>
        ) : hasCodes ? (
          <div className="space-y-3">
            <div className="rounded-[10px] border border-border-card bg-surface-muted px-4 py-3">
              <div className="flex items-baseline gap-1.5">
                <span
                  className={`text-2xl font-bold tabular-nums ${
                    remaining === 0
                      ? "text-error-text"
                      : remaining <= LOW_THRESHOLD
                        ? "text-warning-text"
                        : "text-text-primary"
                  }`}
                >
                  {remaining}
                </span>
                <span className="text-sm text-text-muted">
                  of {total} codes unused
                </span>
              </div>

              <div
                className="mt-2 flex gap-1"
                role="img"
                aria-label={`${remaining} of ${total} recovery codes unused`}
              >
                {Array.from({ length: total }).map((_, index) => (
                  <span
                    key={index}
                    className={`h-1.5 flex-1 rounded-full ${
                      index < remaining ? "bg-accent" : "bg-border"
                    }`}
                  />
                ))}
              </div>

              <p className="mt-2.5 font-mono text-xs text-text-muted">
                {generatedAt ? `Generated ${generatedAt}` : null}
                {generatedAt && used > 0 ? " · " : null}
                {used > 0 ? `${used} used` : null}
              </p>
            </div>

            {remaining === 0 ? (
              <Alert>
                Every code has been used. Generate a new set to keep a way
                back into your account.
              </Alert>
            ) : remaining <= LOW_THRESHOLD ? (
              <Alert variant="warning">
                Running low. Generate a new set soon.
              </Alert>
            ) : null}

            <p className="text-xs text-text-muted">
              Codes are stored hashed, so they can&apos;t be shown again. Lost
              them? Generate a new set — the old codes stop working.
            </p>
          </div>
        ) : (
          <p className="text-sm text-text-secondary">
            No recovery codes yet. Generate a set and store them offline.
          </p>
        )}

        {error ? <Alert>{error}</Alert> : null}

        {codes ? null : confirmingReplace ? (
          <div className="space-y-2">
            <p className="text-sm text-text-secondary">
              Replace the current codes? Every unused code stops working
              immediately.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                onClick={handleGenerate}
                disabled={pending}
                pending={pending}
              >
                {pending ? "Generating…" : "Yes, replace them"}
              </Button>
              <Button
                onClick={() => setConfirmingReplace(false)}
                disabled={pending}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant={hasCodes ? "secondary" : "primary"}
            // A second set silently kills the first, so an existing set gets a
            // confirm step instead of a one-click overwrite
            onClick={
              hasCodes ? () => setConfirmingReplace(true) : handleGenerate
            }
            disabled={pending}
            pending={pending}
          >
            {pending
              ? "Generating…"
              : hasCodes
                ? "Generate new codes"
                : "Generate recovery codes"}
          </Button>
        )}
      </div>
    </section>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
        active
          ? "border-success-border bg-success-bg text-success-text"
          : "border-border-card bg-surface-subtle text-text-muted"
      }`}
    >
      <span
        aria-hidden
        className={`h-1.5 w-1.5 rounded-full ${
          active ? "bg-accent" : "bg-text-tertiary"
        }`}
      />
      {active ? "Active" : "Not set up"}
    </span>
  );
}
