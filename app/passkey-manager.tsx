"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  WebAuthnError,
  browserSupportsWebAuthn,
  startRegistration,
} from "@simplewebauthn/browser";
import { Alert, PasskeyButton } from "@/app/(auth)/_components/ui";

export type PasskeySummary = {
  id: string;
  // Preformatted on the server: formatting a Date here would hydrate with the
  // browser's locale and timezone instead of the server's
  addedAt: string;
  transports: string[];
};

export function PasskeyManager({ passkeys }: { passkeys: PasskeySummary[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleAddPasskey() {
    setError(null);
    setSuccess(null);

    // Checked here rather than on mount: it reads `window`, so a render-time
    // check would mismatch the server-rendered markup
    if (!browserSupportsWebAuthn()) {
      setError("This browser doesn't support passkeys");
      return;
    }

    setPending(true);

    try {
      const optionsResponse = await fetch("/api/webauthn/register/options", {
        method: "POST",
      });
      const optionsJSON = await optionsResponse.json();

      if (!optionsResponse.ok) {
        setError(optionsJSON.error ?? "Could not start passkey registration");
        return;
      }

      const attestation = await startRegistration({ optionsJSON });

      const verifyResponse = await fetch("/api/webauthn/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(attestation),
      });
      const verifyResult = await verifyResponse.json();

      if (!verifyResponse.ok) {
        setError(verifyResult.error ?? "Could not save passkey");
        return;
      }

      setSuccess("Passkey added");
      router.refresh();
    } catch (err) {
      setError(describeRegistrationError(err));
    } finally {
      setPending(false);
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
            <li key={passkey.id} className="px-3 py-2.5">
              <p className="text-sm text-zinc-800 dark:text-zinc-200">
                {passkey.transports.length > 0
                  ? passkey.transports.join(", ")
                  : "Passkey"}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Added {passkey.addedAt}
              </p>
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

      <PasskeyButton onClick={handleAddPasskey} pending={pending}>
        {pending ? "Waiting for authenticator…" : "Add a passkey"}
      </PasskeyButton>
    </div>
  );
}

function describeRegistrationError(err: unknown) {
  if (err instanceof WebAuthnError) {
    if (err.code === "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED") {
      return "This device already has a passkey for your account";
    }
    if (err.code === "ERROR_CEREMONY_ABORTED") {
      return "Passkey registration was cancelled";
    }
    return err.message;
  }

  if (err instanceof Error) {
    return err.message;
  }

  return "Could not register a passkey";
}
