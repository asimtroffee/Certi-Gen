import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";
import { NextResponse } from "next/server";

export interface AuthenticatedAdmin {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

/**
 * Validates the current session and returns the authenticated admin user.
 * Throws a NextResponse error if not authenticated.
 *
 * Usage in API routes:
 * ```ts
 * const admin = await requireAdmin();
 * if (admin instanceof NextResponse) return admin; // 401
 * ```
 */
export async function requireAdmin(): Promise<
  AuthenticatedAdmin | NextResponse
> {
  const session = await auth();
  if (session?.user?.id) {
    return {
      id: session.user.id,
      email: session.user.email ?? "",
      name: session.user.name ?? null,
      role: (session.user as { role?: string }).role ?? "admin",
    };
  }

  return NextResponse.json(
    { error: "Authentication required" },
    { status: 401 }
  );
}

/**
 * Verifies that the authenticated admin owns a specific event.
 * Returns the event if ownership is confirmed, or a NextResponse error.
 */
export async function requireEventOwnership(
  adminId: string,
  eventId: string
) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
  });

  if (!event) {
    return NextResponse.json(
      { error: "Event not found" },
      { status: 404 }
    );
  }

  if (event.adminId !== adminId) {
    return NextResponse.json(
      { error: "Access denied — you do not own this event" },
      { status: 403 }
    );
  }

  return event;
}
