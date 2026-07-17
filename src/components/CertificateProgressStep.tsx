"use client";

import React from "react";
import { Loader2, CheckCircle, Download } from "lucide-react";
import { Button } from "@/components/base/buttons/button";
import Link from "next/link";

type Props = {
  isSuccess: boolean;
  jobStatus: string;
  zipUrl: string | null;
  eta: string;
  onRestart: () => void;
};

export default function CertificateProgressStep({
  isSuccess,
  jobStatus,
  zipUrl,
  eta,
  onRestart,
}: Props) {
  return (
    <div className="text-center max-w-lg mx-auto py-16">
      {!isSuccess ? (
        <>
          <Loader2 className="w-12 h-12 text-primary-600 animate-spin mx-auto mb-6" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {jobStatus === "STARTING" ? "Initializing..." : "Generating Certificates..."}
          </h2>
          <p className="text-gray-500 mb-6">
            Your certificates are being generated in the background. You can safely close this page, or wait here for the download link.
          </p>
          {eta && <p className="text-sm font-medium text-primary-600 mt-3">{eta}</p>}
        </>
      ) : (
        <>
          <div className="mx-auto w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
            <CheckCircle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Generation Complete!</h2>
          <p className="text-gray-500 mb-8">
            Your certificates have been successfully generated and packaged.
          </p>
          <div className="flex flex-col space-y-4 max-w-xs mx-auto">
            {zipUrl && (
              <a href={zipUrl} download>
                <Button color="primary" className="w-full">
                  <Download className="w-4 h-4 mr-2" />
                  Download ZIP
                </Button>
              </a>
            )}
            <Button color="secondary" onClick={onRestart}>
              Start Over
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
