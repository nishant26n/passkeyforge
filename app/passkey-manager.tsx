"use client";

import { useState } from "react";
import { PasskeyError, usePasskey } from "use-passkey";
import { Alert, Field, PasskeyButton } from "@/app/(auth)/_components/ui";

export type PasskeySummary = {
  id: string;
  name: string | null;
  // Preformatted on the server for the first paint: formatting a Date during
  // render would hydrate with the browser's locale and timezone instead of the
  // server's. Refreshes reuse the same format (see `dateFormat` below)
  addedAt: string;
  lastUsedAt: string | null;
  transports: string[];
};

// Shape returned by GET /api/webauthn/credentials
type CredentialResponse = {
  id: string;
  credentialID: string;
  aaguid: string | null;
  name: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  transports: string | null;
};

// Matches the cap the verify route applies before storing
const NAME_MAX_LENGTH = 60;

export function PasskeyManager({
  initialPasskeys,
}: {
  initialPasskeys: PasskeySummary[];
}) {
  const [passkeys, setPasskeys] = useState(initialPasskeys);
  const [name, setName] = useState("");
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { register, isRegistering } = usePasskey();

  async function refreshPasskeys() {
    const response = await fetch("/api/webauthn/credentials");
    const result = await response.json();

    if (!response.ok) {
      setError(result.error ?? "Could not load passkeys");
      return;
    }

    setPasskeys((result.credentials as CredentialResponse[]).map(toSummary));
  }

  async function handleAddPasskey() {
    setError(null);
    setSuccess(null);

    try {
      await register({ name: name.trim() });
      setSuccess("Passkey added");
      setName("");
      await refreshPasskeys();
    } catch (err) {
      setError(describeRegistrationError(err));
    }
  }

  async function handleRevoke(id: string) {
    setError(null);
    setSuccess(null);
    setRevokingId(id);

    try {
      const response = await fetch(`/api/webauthn/credentials/${id}`, {
        method: "DELETE",
      });
      const result = await response.json();

      if (!response.ok) {
        setError(result.error ?? "Could not remove passkey");
        return;
      }

      setConfirmingId(null);
      setSuccess("Passkey removed");
      await refreshPasskeys();
    } catch {
      setError("Could not remove passkey");
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <div className="text-left">
      <header className="flex items-center justify-between gap-4 border-b border-border-divider px-5 py-4">
        <h2 className="text-[15px] font-semibold text-text-primary">
          Passkeys
        </h2>
        <span className="rounded-[6px] border border-border-card px-2 py-1 font-mono text-[11px] uppercase tracking-[0.06em] text-text-muted">
          {passkeys.length} registered
        </span>
      </header>

      {passkeys.length > 0 ? (
        <ul>
          {passkeys.map((passkey) => (
            <li
              key={passkey.id}
              className={`flex items-center justify-between gap-4 border-b border-border-divider px-5 py-4 last:border-b-0 ${
                confirmingId === passkey.id ? "bg-surface-tint" : ""
              }`}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-text-primary">
                  {passkey.name ?? describeDevice(passkey.transports)}
                </p>
                <p className="mt-0.5 font-mono text-xs text-text-muted">
                  {passkey.name && passkey.transports.length > 0
                    ? `${passkey.transports.join(", ")} · `
                    : ""}
                  Added {passkey.addedAt}
                  {passkey.lastUsedAt
                    ? ` · Last used ${passkey.lastUsedAt}`
                    : " · Never used"}
                </p>
              </div>

              {confirmingId === passkey.id ? (
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleRevoke(passkey.id)}
                    disabled={revokingId === passkey.id}
                    className="flex h-8 items-center rounded-[7px] bg-error-hover px-3 text-[13px] font-semibold text-white transition hover:bg-error-hover disabled:opacity-60"
                  >
                    {revokingId === passkey.id ? "Removing…" : "Confirm"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingId(null)}
                    disabled={revokingId === passkey.id}
                    className="flex h-8 items-center rounded-[7px] border border-border-card px-3 text-[13px] font-semibold text-text-secondary transition hover:bg-surface-subtle disabled:opacity-60"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingId(passkey.id)}
                  aria-label={`Remove ${passkey.name ?? `passkey added ${passkey.addedAt}`}`}
                  className="flex h-8 shrink-0 items-center rounded-[7px] border border-border-card px-3 text-[13px] font-semibold text-text-secondary transition hover:border-error-border hover:bg-error-bg hover:text-error-text"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-5 py-4 text-sm text-text-muted">
          No passkeys yet. Add one to sign in without your password.
        </p>
      )}

      <div className="space-y-3.5 border-t border-border-divider bg-surface-quiet px-5 py-[18px]">
        {error ? <Alert>{error}</Alert> : null}
        {success ? <Alert variant="success">{success}</Alert> : null}

        <div className="flex items-end gap-2.5">
          <div className="flex-1">
            <Field
              label="Name"
              hint={<span className="text-xs text-text-tertiary">Optional</span>}
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={NAME_MAX_LENGTH}
              disabled={isRegistering}
              placeholder="Work laptop"
            />
          </div>

          <div className="shrink-0">
            <PasskeyButton onClick={handleAddPasskey} pending={isRegistering}>
              {isRegistering ? "Waiting for authenticator…" : "Add a passkey"}
            </PasskeyButton>
          </div>
        </div>
      </div>
    </div>
  );
}

// Must match the formatter `page.tsx` uses for the server-rendered list, so a
// refreshed row doesn't render its date differently from a first-paint one
const dateFormat = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeZone: "UTC",
});

// Fallback label for passkeys saved without a name (including every one
// registered before the name field existed)
function describeDevice(transports: string[]) {
  return transports.length > 0 ? transports.join(", ") : "Passkey";
}

function toSummary(credential: CredentialResponse): PasskeySummary {
  return {
    id: credential.id,
    name: credential.name,
    addedAt: dateFormat.format(new Date(credential.createdAt)),
    lastUsedAt: credential.lastUsedAt
      ? dateFormat.format(new Date(credential.lastUsedAt))
      : null,
    transports: credential.transports
      ? (JSON.parse(credential.transports) as string[])
      : [],
  };
}

function describeRegistrationError(err: unknown) {
  if (err instanceof PasskeyError) {
    // use-passkey's own wording for these two is more generic; keep this
    // app's existing copy for the one case a test pins exactly.
    if (err.code === "already_registered") {
      return "This device already has a passkey for your account";
    }
    if (err.code === "ceremony_cancelled") {
      return "Passkey registration was cancelled";
    }
    return err.message;
  }

  if (err instanceof Error) {
    return err.message;
  }

  return "Could not register a passkey";
}
