import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/app/lib/auth/current-user";
import { prisma } from "@/app/lib/prisma";
import { AppHeader } from "@/app/app-header";
import { TotpSetup } from "./totp-setup";
import { RecoveryCodes } from "./recovery-code";
import { LogoutButton } from "@/app/logout-button";

export const metadata: Metadata = {
  title: "Security settings · Passkey Forge",
  description: "Manage two-factor authentication and recovery codes.",
};

// Formatted on the server and passed down as a string: rendering a Date in the
// client would format it in the viewer's locale and break hydration
const dateFormat = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeZone: "UTC",
});

export default async function PasskeySettings() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const [remaining, total, latest] = await Promise.all([
    prisma.recoveryCode.count({ where: { userId: user.id, usedAt: null } }),
    prisma.recoveryCode.count({ where: { userId: user.id } }),
    prisma.recoveryCode.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-page">
      <AppHeader
        right={
          <>
            <span className="hidden tablet:block">
              <LogoutButton variant="pill" />
            </span>
          </>
        }
      />

      <div className="mx-auto flex w-full max-w-[920px] flex-1 flex-col gap-5 px-6 py-8 tablet:px-10 tablet:py-9">
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-text-muted transition hover:text-accent"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
            aria-hidden
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Back
        </Link>

        <header className="space-y-1">
          <h1 className="text-2xl font-bold tracking-[-0.025em] text-text-primary">
            Security settings
          </h1>
          <p className="text-sm text-text-muted">Signed in as {user.email}</p>
        </header>

        <div className="flex flex-col gap-5">
          <TotpSetup totpEnabled={user.totpEnabled} />

          <RecoveryCodes
            remaining={remaining}
            total={total}
            generatedAt={latest ? dateFormat.format(latest.createdAt) : null}
          />
        </div>
      </div>
    </div>
  );
}
