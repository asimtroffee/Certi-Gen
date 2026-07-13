import React from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/src/lib/prisma";
import { requireAdmin } from "@/src/lib/auth-guard";
import AdminPreviewBatch from "@/src/components/AdminPreviewBatch";

export const metadata = {
  title: "Preview Certificates | CertiGen",
};

export default async function AdminBatchPage() {
  const userOrResponse = await requireAdmin();
  if ("status" in userOrResponse) {
    redirect("/api/auth/signin");
  }
  const user = userOrResponse;

  const events = await prisma.event.findMany({
    where: { adminId: user.id, isArchived: false },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      templateUrl: true,
      templateConfig: true,
    },
  });

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Preview Certificates</h1>
        <p className="mt-1 text-sm text-gray-500">
          Generate sample certificates to preview how your template looks.
        </p>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <AdminPreviewBatch events={events} />
      </div>
    </div>
  );
}
