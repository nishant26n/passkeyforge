import { deleteSession } from "@/app/lib/auth/session";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;

  if (token) {
    await deleteSession(token);
  }

  cookieStore.delete("session");

  return NextResponse.json({ success: true });
}
