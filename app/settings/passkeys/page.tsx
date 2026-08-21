import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/app/lib/auth/current-user";
import { prisma } from "@/app/lib/prisma";
import { TotpSetup } from "./totp-setup";
import { RecoveryCodes } from "./recovery-code";

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
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10 font-sans dark:bg-black sm:py-14">
      <div className="w-full max-w-xl">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
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

        <header className="mt-4 mb-6 space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Security settings
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Signed in as {user.email}
          </p>
        </header>

        <div className="flex flex-col gap-4">
          <TotpSetup totpEnabled={user.totpEnabled} />

          <RecoveryCodes
            remaining={remaining}
            total={total}
            generatedAt={
              latest ? dateFormat.format(latest.createdAt) : null
            }
          />
        </div>
      </div>
    </div>
  );
}
