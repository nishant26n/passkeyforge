import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/app/lib/auth/current-user";
import { AuthShell } from "../_components/auth-shell";
import { loginHero } from "../_components/auth-hero-content";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in · Passkey Forge",
  description: "Sign in to your Passkey Forge account.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/");

  const { registered } = await searchParams;

  return (
    <AuthShell hero={loginHero}>
      <div className="mx-auto flex w-full max-w-[400px] flex-col">
        <LoginForm registered={registered === "1"} />
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
