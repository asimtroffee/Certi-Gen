"use client";

import React from "react";
import { Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/base/buttons/button";

type Props = {
  isSuccess: boolean;
  progress: number;
  eta: string;
  isCancelling: boolean;
  onCancel: () => void;
  onRestart: () => void;
};

export default function CertificateProgressStep({
  isSuccess,
  progress,
  eta,
  isCancelling,
  onCancel,
  onRestart,
}: Props) {
  return (
    <div className="text-center max-w-lg mx-auto py-16">
      {!isSuccess ? (
        <>
          <Loader2 className={`w-12 h-12 text-primary-600 ${isCancelling ? "" : "animate-spin"} mx-auto mb-6`} />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {isCancelling ? "Cancelling..." : "Generating Certificates..."}
          </h2>
          <p className="text-gray-500 mb-6">
            Please keep this window open. Your browser is securely generating PDFs in real-time.
          </p>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-primary-600 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm font-medium text-gray-700 mt-3">{progress}% Complete</p>
          {eta && <p className="text-xs text-gray-400 mt-1">{eta}</p>}
          {!isCancelling && (
            <button
              type="button"
              onClick={onCancel}
              className="mt-6 text-sm text-red-600 hover:text-red-700 underline underline-offset-2"
            >
              Cancel Generation
            </button>
          )}
        </>
      ) : (
        <>
          <div className="mx-auto w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
            <CheckCircle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Generation Complete!</h2>
          <p className="text-gray-500 mb-8">
            Your certificates have been successfully generated and packaged into a ZIP file. The download should have started automatically.
          </p>
          <Button color="secondary" onClick={onRestart}>
            Start Over
          </Button>
        </>
      )}
    </div>
  );
}
