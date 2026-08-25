import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/app/lib/auth/current-user";
import { AuthShell } from "../_components/auth-shell";
import { authenticatorLoginHero } from "../_components/auth-hero-content";
import { TOTPForm } from "./totp-form";

export const metadata: Metadata = {
  title: "Login with authenticator code · Passkey Forge",
  description:
    "Sign in with a code from your authenticator app when a passkey isn't available.",
};

export default async function AuthenticatorLoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <AuthShell hero={authenticatorLoginHero}>
      <div className="mx-auto flex w-full max-w-[400px] flex-col">
        <TOTPForm />
        <p className="mt-6 text-center text-sm text-text-muted">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="font-semibold text-accent hover:text-accent-hover"
          >
            Create one
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
