import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/app/lib/auth/current-user";
import { prisma } from "@/app/lib/prisma";
import { LogoutButton } from "./logout-button";
import { PasskeyManager, type PasskeySummary } from "./passkey-manager";

export const metadata: Metadata = {
  title: "You're signed in · Passkey Forge",
  description: "Manage your Passkey Forge passkeys.",
};

export default async function Home() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // First paint only — the client refetches through
  // GET /api/webauthn/credentials after adding or revoking a passkey
  const credentials = await prisma.credential.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  const dateFormat = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeZone: "UTC",
  });

  const passkeys: PasskeySummary[] = credentials.map((credential) => ({
    id: credential.id,
    name: credential.name,
    addedAt: dateFormat.format(credential.createdAt),
    lastUsedAt: credential.lastUsedAt
      ? dateFormat.format(credential.lastUsedAt)
      : null,
    transports: credential.transports
      ? (JSON.parse(credential.transports) as string[])
      : [],
  }));

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 font-sans dark:bg-black">
      <div className="relative w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <Link
          href="/settings/passkeys"
          aria-label="Security settings"
          title="Security settings"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
            aria-hidden
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </Link>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          You&apos;re signed in
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {user.email}
        </p>
        <div className="mt-6 border-t border-zinc-200 pt-6 dark:border-zinc-800">
          <PasskeyManager initialPasskeys={passkeys} />
        </div>
        <div className="mt-6">
          <LogoutButton />
        </div>
      </div>
    </div>
  );
}
