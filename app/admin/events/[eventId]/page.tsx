import React from "react";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/src/lib/prisma";
import { requireAdmin } from "@/src/lib/auth-guard";
import CanvasEditor from "@/src/components/CanvasEditor";

export default async function EventEditorPage({
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
    where: {
      id: eventId,
      adminId: user.id,
    },
  });

  if (!event) {
    notFound();
  }

  // The templateConfig is stored as Json in Prisma. We can cast it or parse it.
  const templateConfig = event.templateConfig 
    ? (typeof event.templateConfig === 'string' ? JSON.parse(event.templateConfig) : event.templateConfig)
    : [];

  return (
    <div className="h-full w-full flex flex-col bg-gray-50">
      <CanvasEditor 
        eventId={event.id}
        title={event.title}
        initialTemplateUrl={event.templateUrl || ""}
        initialConfig={templateConfig}
      />
    </div>
  );
}
