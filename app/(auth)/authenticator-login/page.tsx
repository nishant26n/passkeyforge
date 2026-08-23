import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/app/lib/auth/current-user";
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
    <>
      <TOTPForm />
      <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
        Don&apos;t have an account?{" "}
        <Link
          href="/register"
          className="font-medium text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-50"
        >
          Create one
        </Link>
      </p>
    </>
  );
}
