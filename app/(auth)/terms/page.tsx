import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardHeader } from "../_components/ui";

export const metadata: Metadata = {
  title: "Terms · Passkey Forge",
  description: "Terms of use for the Passkey Forge demo project.",
};

export default function TermsPage() {
  return (
    <Card>
      <CardHeader title="Terms" subtitle="What you're agreeing to." />

      <div className="space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
        <p>
          Passkey Forge is a demonstration project built to explore WebAuthn
          and passkey authentication. It is not a commercial product, and no
          formal terms of service govern its use.
        </p>
        <p>
          Accounts and data may be reset or deleted at any time without
          notice. Don&apos;t use a password you use anywhere else, and
          don&apos;t store anything sensitive here.
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
