import React from "react";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/src/lib/prisma";
import { requireAdmin } from "@/src/lib/auth-guard";
import { Button } from "@/components/base/buttons/button";
import EventFormSettings from "@/src/components/EventFormSettings";

export default async function EventFormPage({
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

  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "";

  return (
    <div className="h-full w-full flex flex-col bg-gray-50">
      <div className="px-8 pt-8 pb-0">
        <Link href={`/admin/events/${eventId}`}>
          <Button color="tertiary" size="sm" className="p-2">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
      </div>
      <EventFormSettings eventId={event.id} eventTitle={event.title} serviceAccountEmail={serviceAccountEmail} />
    </div>
  );
}
