import React from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/src/lib/prisma";
import TeacherSubmissionEngine from "@/src/components/TeacherSubmissionEngine";
import ErrorBoundary from "@/src/components/ErrorBoundary";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/base/buttons/button";

export default async function TeacherSubmitPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const magicLink = await prisma.magicLink.findUnique({
    where: { token },
    include: {
      event: true,
      submission: true,
    },
  });

  if (!magicLink) {
    notFound();
  }

  const isExpired = new Date() > new Date(magicLink.expiresAt);
  const isRevoked = magicLink.isRevoked;
  const hasSubmitted = !!magicLink.submission;

  if (isExpired || isRevoked || hasSubmitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 text-center border border-gray-200">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
              <AlertCircle className="h-6 w-6 text-red-600" aria-hidden="true" />
            </div>
            <h2 className="text-lg font-medium text-gray-900 mb-2">
              {hasSubmitted ? "Already Submitted" : "Link Expired"}
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              {hasSubmitted
                ? "You have already submitted student data using this link."
                : "This magic link has expired or been revoked by the administrator."}
            </p>
            <Button color="primary" className="w-full">
              Request a New Link
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // The link is valid. Load the submission engine.
  const templateConfig = magicLink.event.templateConfig
    ? (typeof magicLink.event.templateConfig === 'string' ? JSON.parse(magicLink.event.templateConfig) : magicLink.event.templateConfig)
    : [];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 py-4 px-6 sm:px-8">
        <h1 className="text-xl font-bold text-primary-700">CertiGen</h1>
        <p className="text-sm text-gray-500 mt-1">
          Generating certificates for <strong>{magicLink.event.title}</strong>
        </p>
      </header>
      
      <main className="flex-1 w-full max-w-5xl mx-auto p-6 sm:p-8">
        <ErrorBoundary>
          <TeacherSubmissionEngine 
            token={magicLink.token}
            teacherEmail={magicLink.teacherEmail}
            templateUrl={magicLink.event.templateUrl}
            templateConfig={templateConfig}
          />
        </ErrorBoundary>
      </main>
    </div>
  );
}
