"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Spinner } from "@/app/(auth)/_components/ui";

const primaryButton =
  "flex h-11 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-zinc-50 transition hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:focus-visible:outline-zinc-100";

// Below this many unused codes, nudge the user to regenerate
const LOW_THRESHOLD = 3;

const secondaryButton =
  "flex h-11 items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:focus-visible:outline-zinc-100";

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
    <section className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <header className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
        <div className="space-y-0.5">
          <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
            Recovery codes
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            One-time codes for when every passkey and authenticator is gone.
          </p>
        </div>
        <StatusBadge active={remaining > 0} />
      </header>

      <div className="space-y-4 px-5 py-4">
        {codes ? (
          <>
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
              These codes are shown once. Save them now — leaving this page
              hides them for good.
            </div>

            <ol className="grid grid-cols-1 gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900 sm:grid-cols-2">
              {codes.map((code, index) => (
                <li
                  key={code}
                  className="flex items-center gap-2 font-mono text-sm tracking-wider text-zinc-800 dark:text-zinc-200"
                >
                  <span className="w-5 shrink-0 text-right text-xs text-zinc-400 dark:text-zinc-600">
                    {index + 1}
                  </span>
                  {code}
                </li>
              ))}
            </ol>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className={secondaryButton}
              >
                {copied ? "Copied" : "Copy all"}
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className={secondaryButton}
              >
                Download .txt
              </button>
              <button
                type="button"
                onClick={() => {
                  setCodes(null);
                  setCopied(false);
                }}
                className={primaryButton}
              >
                I saved them
              </button>
            </div>
          </>
        ) : hasCodes ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-baseline gap-1.5">
                <span
                  className={`text-2xl font-semibold tabular-nums ${
                    remaining === 0
                      ? "text-red-600 dark:text-red-400"
                      : remaining <= LOW_THRESHOLD
                        ? "text-amber-600 dark:text-amber-500"
                        : "text-zinc-900 dark:text-zinc-50"
                  }`}
                >
                  {remaining}
                </span>
                <span className="text-sm text-zinc-500 dark:text-zinc-400">
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
                      index < remaining
                        ? "bg-zinc-900 dark:bg-zinc-100"
                        : "bg-zinc-200 dark:bg-zinc-800"
                    }`}
                  />
                ))}
              </div>

              <p className="mt-2.5 text-xs text-zinc-500 dark:text-zinc-400">
                {generatedAt ? `Generated ${generatedAt}` : null}
                {generatedAt && used > 0 ? " · " : null}
                {used > 0 ? `${used} used` : null}
              </p>
            </div>

            {remaining === 0 ? (
              <Alert>
                Every code has been used. Generate a new set to keep a way back
                into your account.
              </Alert>
            ) : remaining <= LOW_THRESHOLD ? (
              <p className="text-xs text-amber-700 dark:text-amber-500">
                Running low. Generate a new set soon.
              </p>
            ) : null}

            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Codes are stored hashed, so they can&apos;t be shown again. Lost
              them? Generate a new set — the old codes stop working.
            </p>
          </div>
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No recovery codes yet. Generate a set and store them offline.
          </p>
        )}

        {error ? <Alert>{error}</Alert> : null}

        {codes ? null : confirmingReplace ? (
          <div className="space-y-2">
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              Replace the current codes? Every unused code stops working
              immediately.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={pending}
                className={primaryButton}
              >
                {pending ? <Spinner /> : null}
                {pending ? "Generating…" : "Yes, replace them"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingReplace(false)}
                disabled={pending}
                className={secondaryButton}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            // A second set silently kills the first, so an existing set gets a
            // confirm step instead of a one-click overwrite
            onClick={
              hasCodes ? () => setConfirmingReplace(true) : handleGenerate
            }
            disabled={pending}
            className={hasCodes ? secondaryButton : primaryButton}
          >
            {pending ? <Spinner /> : null}
            {pending
              ? "Generating…"
              : hasCodes
                ? "Generate new codes"
                : "Generate recovery codes"}
          </button>
        )}
      </div>
    </section>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
        active
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
          : "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
      }`}
    >
      <span
        aria-hidden
        className={`h-1.5 w-1.5 rounded-full ${
          active ? "bg-emerald-500" : "bg-zinc-400 dark:bg-zinc-600"
        }`}
      />
      {active ? "Active" : "Not set up"}
    </span>
  );
}
