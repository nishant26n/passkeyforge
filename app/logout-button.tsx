"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton({
  variant = "block",
}: {
  /** "block" = full-width card/footer button, "pill" = compact header button */
  variant?: "block" | "pill";
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleLogout() {
    setPending(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const classes =
    variant === "pill"
      ? "flex h-9 items-center rounded-[8px] border border-border bg-surface px-3.5 text-[13px] font-semibold text-text-secondary transition hover:bg-surface-subtle disabled:opacity-60"
      : "flex h-11 w-full items-center justify-center rounded-[8px] border border-border bg-surface text-[15px] font-semibold text-text-primary transition hover:bg-surface-subtle disabled:opacity-60";

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={pending}
      className={classes}
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
