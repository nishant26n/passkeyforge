import {
  getSession,
  rotateSession,
  SESSION_COOKIE_NAME,
  setSessionCookie,
} from "@/app/lib/auth/session";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!token) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        { status: 401 },
      );
    }

    const session = await getSession(token);

    if (!session) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        { status: 401 },
      );
    }

    const rotatedSession = await rotateSession(token);

    if (!rotatedSession) {
      return NextResponse.json(
        {
          error: "Session rotation failed",
        },
        {
          status: 401,
        },
      );
    }

    const response = NextResponse.json({
      success: true,
      user: {
        id: session.user.id,
        email: session.user.email,
      },
    });

    setSessionCookie(response, rotatedSession);
    return response;
  } catch (error) {
    console.error("Session rotation failed:", error);

    return NextResponse.json(
      { error: "Failed to refresh session" },
      { status: 500 },
    );
  }
}
