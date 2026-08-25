import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/app/lib/auth/current-user";
import { AuthShell } from "../_components/auth-shell";
import { registerHero } from "../_components/auth-hero-content";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = {
  title: "Create account · Passkey Forge",
  description: "Create your Passkey Forge account.",
};

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <AuthShell hero={registerHero}>
      <div className="mx-auto flex w-full max-w-[400px] flex-col">
        <RegisterForm />
        <p className="mt-6 text-center text-sm text-text-muted">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold text-accent hover:text-accent-hover"
          >
            Sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
