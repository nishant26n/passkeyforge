"use client";

import { LogoMark } from "./logo-mark";
import { ThemeToggle } from "./theme-toggle";

export function AppHeader({ right }: { right?: React.ReactNode }) {
  return (
    <header className="flex h-16 items-center justify-between gap-6 border-b border-border-hairline bg-surface px-6 tablet:px-10">
      <LogoMark />
      <div className="flex items-center gap-3.5">
        <ThemeToggle />
        {right}
      </div>
    </header>
  );
}
