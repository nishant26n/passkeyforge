import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/app/lib/auth/current-user";
import { prisma } from "@/app/lib/prisma";
import { AppHeader } from "./app-header";
import { LogoutButton } from "./logout-button";
import { PasskeyManager, type PasskeySummary } from "./passkey-manager";

export const metadata: Metadata = {
  title: "You're signed in · Passkey Forge",
  description: "Manage your Passkey Forge passkeys.",
};

function SettingsLink() {
  return (
    <Link
      href="/settings/passkeys"
      aria-label="Settings"
      className="flex h-9 items-center gap-1.5 rounded-[8px] border border-border bg-surface px-3.5 text-[13px] font-semibold text-text-primary transition hover:bg-surface-subtle"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-[15px] w-[15px] text-text-muted"
        aria-hidden
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
      </svg>
      <span className="hidden tablet:inline">Settings</span>
    </Link>
  );
}

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
    <div className="flex min-h-screen flex-col bg-page pb-20 tablet:pb-0">
      <AppHeader
        right={
          <>
            <SettingsLink />
            <span className="hidden tablet:block">
              <LogoutButton variant="pill" />
            </span>
          </>
        }
      />

      <div className="mx-auto flex w-full max-w-[920px] flex-1 flex-col gap-6 px-6 py-9 tablet:px-10">
        <div className="flex items-end justify-between gap-6">
          <div>
            <h1 className="text-2xl font-bold tracking-[-0.025em] text-text-primary tablet:text-[26px]">
              You&apos;re signed in
            </h1>
            <p className="mt-1.5 text-sm text-text-muted">{user.email}</p>
          </div>
        </div>

        <section className="overflow-hidden rounded-[12px] border border-border-card bg-surface">
          <PasskeyManager initialPasskeys={passkeys} />
        </section>
      </div>

      {/* Mobile-only sticky sign-out bar */}
      <div className="fixed inset-x-0 bottom-0 border-t border-border-hairline bg-surface px-4 py-3 tablet:hidden">
        <LogoutButton />
      </div>
    </div>
  );
}
