import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-zinc-50 px-4 py-12 font-sans dark:bg-black">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_36rem_at_50%_-15%,#e0e7ff,transparent)] dark:bg-[radial-gradient(60rem_36rem_at_50%_-15%,#1e1b4b,transparent)]"
      />

      <div className="relative flex w-full max-w-sm flex-col items-center">
        <Link
          href="/"
          className="mb-8 flex items-center gap-2 text-zinc-900 dark:text-zinc-50"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden
            >
              <circle cx="9" cy="9" r="4" />
              <path d="M13.5 11.5 21 19v3h-3l-1-1h-2l-1-1v-2l-1.5-1.5" />
            </svg>
          </span>
          <span className="text-lg font-semibold tracking-tight">
            Passkey Forge
          </span>
        </Link>

        {children}
      </div>
    </div>
  );
}
