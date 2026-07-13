"use client";

import React from "react";
import { FileText } from "lucide-react";
import type { FieldConfig } from "./CanvasEditor";

type Props = {
  templateConfig: FieldConfig[] | null;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

export default function CertificateUploadArea({ templateConfig, onFileUpload }: Props) {
  return (
    <>
      <div className="flex justify-center mb-6">
        <button
          type="button"
          onClick={() => {
            const textFields = (templateConfig ?? []).filter((b) => b.type !== "image");
            const headers = textFields.map((b) => b.label).join(",");
            const sample = textFields.map((b) => "Sample " + b.label).join(",");
            const csv = `${headers}\n${sample}`;
            const blob = new Blob([csv], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "sample_template.csv";
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="text-sm text-primary-600 hover:text-primary-700 underline underline-offset-2 flex items-center gap-1"
        >
          <FileText className="w-4 h-4" />
          Download Sample CSV
        </button>
      </div>

      <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-10 hover:bg-gray-50 hover:border-primary-400 transition-colors cursor-pointer group">
        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          onChange={onFileUpload}
        />
        <div className="text-center pointer-events-none">
          <FileText className="w-10 h-10 text-gray-400 mx-auto mb-3 group-hover:text-primary-500 transition-colors" />
          <p className="text-sm font-medium text-gray-900">Click to upload or drag and drop</p>
          <p className="text-xs text-gray-500 mt-1">CSV or Excel files (.csv, .xlsx)</p>
        </div>
      </div>
    </>
  );
}
