import { verifyPassword } from "@/app/lib/auth/register";
import { createSession, setSessionCookie } from "@/app/lib/auth/session";
import { prisma } from "@/app/lib/prisma";
import { checkAuthRateLimit } from "@/app/lib/rate-limit";
import { NextResponse } from "next/server";
import z from "zod";

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .transform((email) => email.toLowerCase()),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = loginSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          error: "Invalid email or password",
        },
        { status: 400 },
      );
    }

    const { email, password } = result.data;

    const forwardedFor = request.headers.get("x-forwarded-for");

    const ip = forwardedFor?.split(",")[0]?.trim() ?? "unknown";

    const rateLimit = await checkAuthRateLimit("login", email, ip);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: "Too many attempts. Please try again later.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": "60",
          },
        },
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        {
          error: "Invalid email or password",
        },
        { status: 401 },
      );
    }

    const passwordValid = await verifyPassword(password, user.passwordHash);

    if (!passwordValid) {
      return NextResponse.json(
        {
          error: "Invalid email or password",
        },
        { status: 401 },
      );
    }

    const session = await createSession(user.id);

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
      },
    });

    setSessionCookie(response, session);

    return response;
  } catch (error) {
    console.error("Login failed:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}
