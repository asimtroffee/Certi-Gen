import React from "react";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/src/lib/prisma";
import { requireAdmin } from "@/src/lib/auth-guard";
import { Button } from "@/components/base/buttons/button";
import MagicLinksManager from "@/src/components/MagicLinksManager";

export default async function MagicLinksPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const userOrResponse = await requireAdmin();
  if ("status" in userOrResponse) {
    redirect("/api/auth/signin");
  }
  const user = userOrResponse;

  const event = await prisma.event.findUnique({
    where: { id: eventId, adminId: user.id },
  });

  if (!event) {
    notFound();
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center space-x-4">
        <Link href={`/admin/events/${eventId}`}>
          <Button color="tertiary" size="sm" className="p-2">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{event.title}</h1>
          <p className="text-sm text-gray-500">Magic Links</p>
        </div>
      </div>

      <MagicLinksManager eventId={event.id} />
    </div>
  );
}
