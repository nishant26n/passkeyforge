"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  // next-themes resolves the actual theme client-side only; rendering the
  // toggle's active state before mount would flash the wrong tab selected
  // Standard next-themes hydration guard: runs once after mount, not derived
  // from any reactive value, so there's no external system to subscribe to
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const active = mounted ? (theme ?? "system") : "system";

  return (
    <div className="inline-flex items-center gap-1 rounded-[10px] border border-border bg-surface-subtle p-1">
      <button
        type="button"
        onClick={() => setTheme("light")}
        aria-pressed={active === "light"}
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
          active === "light"
            ? "bg-surface text-text-primary shadow-sm"
            : "text-text-muted hover:text-text-primary"
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-3.5 w-3.5"
          aria-hidden
        >
          <circle cx="12" cy="12" r="4.5" />
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" />
        </svg>
        Light
      </button>
      <button
        type="button"
        onClick={() => setTheme("dark")}
        aria-pressed={active === "dark"}
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
          active === "dark"
            ? "bg-surface text-text-primary shadow-sm"
            : "text-text-muted hover:text-text-primary"
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-3.5 w-3.5"
          aria-hidden
        >
          <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5Z" />
        </svg>
        Dark
      </button>
    </div>
  );
}
