import { LogoMark } from "@/app/logo-mark";
import { ThemeToggle } from "@/app/theme-toggle";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center gap-6 bg-page px-4 py-8 font-sans tablet:gap-8 tablet:py-12">
      <div className="flex w-full max-w-[1280px] items-center justify-between">
        <LogoMark />
        <ThemeToggle />
      </div>

      <div className="flex w-full max-w-[1280px] flex-1 flex-col items-center justify-center">
        {children}
      </div>
    </div>
  );
}
