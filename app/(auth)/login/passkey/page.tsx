import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/app/lib/auth/current-user";
import { AuthShell } from "../../_components/auth-shell";
import { passkeyLoginHero } from "../../_components/auth-hero-content";
import PasskeyLogin from "../passkeyLogin";

export const metadata: Metadata = {
  title: "Sign in with a passkey · Passkey Forge",
  description: "Sign in to your Passkey Forge account with a passkey.",
};

export default async function PasskeyLoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <AuthShell hero={passkeyLoginHero}>
      <div className="mx-auto flex w-full max-w-[400px] flex-col">
        <PasskeyLogin />
        <p className="mt-6 text-center text-sm text-text-muted">
          Prefer a password?{" "}
          <Link
            href="/login"
            className="font-semibold text-accent hover:text-accent-hover"
          >
            Sign in with email
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
