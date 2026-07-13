"use client";

import React from "react";
import { FileUp } from "lucide-react";
import type { FieldConfig } from "./CanvasEditor";
import { useCertificateGenerator } from "@/src/hooks/useCertificateGenerator";
import WizardStepBar from "@/src/components/WizardStepBar";
import CertificateUploadArea from "@/src/components/CertificateUploadArea";
import CertificateMapStep from "@/src/components/CertificateMapStep";
import CertificateProgressStep from "@/src/components/CertificateProgressStep";

type Props = {
  eventId: string;
  adminName: string;
  templateUrl: string;
  templateConfig: FieldConfig[] | null;
};

export default function AdminBulkEngine({
  eventId,
  adminName,
  templateUrl,
  templateConfig,
}: Props) {
  const {
    csvHeaders, mapping, setMapping, step, setStep, progress, isSuccess, eta,
    isCancelling, setIsCancelling, cancelRef,
    handleFileUpload, generatePDFs, generatePreview,
  } = useCertificateGenerator({
    templateUrl,
    templateConfig,
    submitEndpoint: `/api/events/${eventId}/bulk-submit`,
    teacherName: adminName,
  });

  const canGenerate = Object.values(mapping).length > 0;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <WizardStepBar step={step} />

      <div className="p-8">
        {step === 1 && (
          <div className="max-w-xl mx-auto py-8">
            <div className="text-center mb-10">
              <div className="mx-auto w-16 h-16 bg-primary-50 text-primary-600 rounded-full flex items-center justify-center mb-4">
                <FileUp className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Bulk Generate Certificates</h2>
              <p className="text-gray-500">
                Upload a CSV or Excel file containing student details. Ensure the first row contains headers.
              </p>
            </div>

            <CertificateUploadArea templateConfig={templateConfig} onFileUpload={handleFileUpload} />
          </div>
        )}

        {step === 2 && (
          <CertificateMapStep
            templateConfig={templateConfig}
            csvHeaders={csvHeaders}
            mapping={mapping}
            onMappingChange={setMapping}
            onPreview={generatePreview}
            onGenerate={generatePDFs}
            canGenerate={canGenerate}
          />
        )}

        {step === 3 && (
          <CertificateProgressStep
            isSuccess={isSuccess}
            progress={progress}
            eta={eta}
            isCancelling={isCancelling}
            onCancel={() => { cancelRef.current = true; setIsCancelling(true); }}
            onRestart={() => window.location.reload()}
          />
        )}
      </div>
    </div>
  );
}
