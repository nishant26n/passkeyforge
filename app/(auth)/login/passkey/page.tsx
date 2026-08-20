import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/app/lib/auth/current-user";
import PasskeyLogin from "../passkeyLogin";

export const metadata: Metadata = {
  title: "Sign in with a passkey · Passkey Forge",
  description: "Sign in to your Passkey Forge account with a passkey.",
};

export default async function PasskeyLoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <>
      <PasskeyLogin />
      <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
        Prefer a password?{" "}
        <Link
          href="/login"
          className="font-medium text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-50"
        >
          Sign in with email
        </Link>
      </p>
    </>
  );
}
