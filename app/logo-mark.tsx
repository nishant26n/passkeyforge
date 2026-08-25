import Link from "next/link";

export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`flex items-center gap-2.5 text-text-primary ${className}`}
    >
      <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[8px] bg-text-primary text-page dark:bg-accent dark:text-accent-on">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-[15px] w-[15px]"
          aria-hidden
        >
          <circle cx="9" cy="9" r="4" />
          <path d="M13.5 11.5 21 19v3h-3l-1-1h-2l-1-1v-2l-1.5-1.5" />
        </svg>
      </span>
      <span className="text-base font-semibold tracking-[-0.01em]">
        Passkey Forge
      </span>
    </Link>
  );
}
