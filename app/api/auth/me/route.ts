import { getCurrentUser } from "@/app/lib/auth/current-user";
import { NextResponse } from "next/server";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      {
        error: "Unauthorized",
      },
      { status: 401 },
    );
  }

  return NextResponse.json({
    user: {
      id: user.id,
      emai: user.email,
    },
  });
}
