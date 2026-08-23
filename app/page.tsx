import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/app/lib/auth/current-user";
import { prisma } from "@/app/lib/prisma";
import { LogoutButton } from "./logout-button";
import { PasskeyManager, type PasskeySummary } from "./passkey-manager";

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
    aaguid: credential.aaguid,
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
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <Link
          href="/settings/passkeys"
          className="mb-6 inline-block cursor-pointer rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
        >
          Settings
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
