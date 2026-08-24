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
    <div className="space-y-3 text-left">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Passkeys
        </h2>
        <span className="text-xs text-zinc-400 dark:text-zinc-600">
          {passkeys.length} registered
        </span>
      </div>

      {passkeys.length > 0 ? (
        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {passkeys.map((passkey) => (
            <li
              key={passkey.id}
              className="flex items-start justify-between gap-3 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-zinc-800 dark:text-zinc-200">
                  {passkey.name ?? describeDevice(passkey.transports)}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
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
                    className="text-xs font-medium text-red-600 transition hover:text-red-700 disabled:opacity-60 dark:text-red-400 dark:hover:text-red-300"
                  >
                    {revokingId === passkey.id ? "Removing…" : "Confirm"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingId(null)}
                    disabled={revokingId === passkey.id}
                    className="text-xs text-zinc-500 transition hover:text-zinc-800 disabled:opacity-60 dark:text-zinc-400 dark:hover:text-zinc-200"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingId(passkey.id)}
                  aria-label={`Remove ${passkey.name ?? `passkey added ${passkey.addedAt}`}`}
                  className="shrink-0 text-xs font-medium text-zinc-500 transition hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No passkeys yet. Add one to sign in without your password.
        </p>
      )}

      {error ? <Alert>{error}</Alert> : null}
      {success ? <Alert variant="success">{success}</Alert> : null}

      <div className="space-y-3">
        <Field
          label="Name"
          hint={
            <span className="text-xs text-zinc-400 dark:text-zinc-600">
              Optional
            </span>
          }
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={NAME_MAX_LENGTH}
          disabled={isRegistering}
          placeholder="Work laptop"
        />

        <PasskeyButton onClick={handleAddPasskey} pending={isRegistering}>
          {isRegistering ? "Waiting for authenticator…" : "Add a passkey"}
        </PasskeyButton>
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
