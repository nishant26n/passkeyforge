import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardHeader } from "../_components/ui";

export const metadata: Metadata = {
  title: "Privacy Policy · Passkey Forge",
  description: "What Passkey Forge stores and why.",
};

export default function PrivacyPage() {
  return (
    <Card>
      <CardHeader title="Privacy Policy" subtitle="What we store, and why." />

      <div className="space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
        <p>
          Passkey Forge stores only what&apos;s needed to authenticate you:
          your email, a hashed password, WebAuthn public keys, and session
          metadata. Your passkey&apos;s private key never leaves your device
          — the server only ever sees a public key.
        </p>
        <p>
          This is a demonstration project, not a production service. Treat
          anything you enter as disposable, and don&apos;t use it for real
          accounts or sensitive information.
        </p>
      </div>

      <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
        <Link
          href="/register"
          className="font-medium text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-50"
        >
          Back to sign up
        </Link>
      </p>
    </Card>
  );
}
