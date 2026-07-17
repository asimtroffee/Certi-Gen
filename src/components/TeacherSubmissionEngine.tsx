"use client";

import React, { useState } from "react";
import { FileUp } from "lucide-react";
import { Input } from "@/components/base/input/input";
import { Label } from "@/components/base/input/label";
import type { FieldConfig } from "./CanvasEditor";
import { useCertificateGenerator } from "@/src/hooks/useCertificateGenerator";
import WizardStepBar from "@/src/components/WizardStepBar";
import CertificateUploadArea from "@/src/components/CertificateUploadArea";
import CertificateMapStep from "@/src/components/CertificateMapStep";
import CertificateProgressStep from "@/src/components/CertificateProgressStep";

type Props = {
  token: string;
  teacherEmail: string;
  templateUrl: string;
  templateConfig: FieldConfig[] | null;
};

export default function TeacherSubmissionEngine({
  token,
  teacherEmail,
  templateUrl,
  templateConfig,
}: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState(teacherEmail);

  const {
    csvHeaders, mapping, setMapping, step, isSuccess, eta,
    handleFileUpload, generatePDFs, generatePreview, jobStatus, zipUrl
  } = useCertificateGenerator({
    templateUrl,
    templateConfig,
    submitEndpoint: `/api/submit/${token}`,
    teacherName: name,
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
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Upload Student List</h2>
              <p className="text-gray-500">
                Please confirm your details and upload a CSV file containing your students&apos; details. Ensure the first row contains headers.
              </p>
            </div>

            <div className="space-y-6 mb-8">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Your Name</Label>
                  <Input
                    placeholder="e.g. Jane Doe"
                    value={name}
                    onChange={(val) => setName(val)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Your Email</Label>
                  <Input
                    placeholder="jane@school.edu"
                    value={email}
                    onChange={(val) => setEmail(val)}
                    isDisabled
                  />
                </div>
              </div>
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
            jobStatus={jobStatus}
            zipUrl={zipUrl}
            eta={eta}
            onRestart={() => window.location.reload()}
          />
        )}
      </div>
    </div>
  );
}
