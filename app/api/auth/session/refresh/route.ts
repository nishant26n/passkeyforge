import {
  getSession,
  rotateSession,
  setSessionCookie,
} from "@/app/lib/auth/session";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const cookieHeader = request.headers.get("cookie");

    const token = cookieHeader
      ?.split(";")
      .map((cookie) => cookie.trim())
      .find((cookie) => cookie.startsWith("session="))
      ?.split("=")[1];

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
