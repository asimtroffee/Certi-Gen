import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";
import { NextResponse } from "next/server";

const AUTHJS_COOKIE_NAMES = [
  "authjs.session-token",
  "authjs.callback-url",
  "authjs.csrf-token",
];

export async function GET() {
  const session = await auth();

  if (session?.user?.id) {
    await prisma.session.deleteMany({
      where: { userId: session.user.id },
    });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const response = NextResponse.redirect(new URL("/", appUrl));

  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: false,
    expires: new Date(0),
    path: "/",
  };

  for (const name of AUTHJS_COOKIE_NAMES) {
    response.cookies.set(name, "", cookieOptions);
  }

  return response;
}
