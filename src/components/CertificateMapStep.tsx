"use client";

import React from "react";
import { ArrowRight, Eye } from "lucide-react";
import { Button } from "@/components/base/buttons/button";
import type { FieldConfig } from "./CanvasEditor";

type Props = {
  templateConfig: FieldConfig[] | null;
  csvHeaders: string[];
  mapping: Record<string, string>;
  onMappingChange: (mapping: Record<string, string>) => void;
  onPreview: () => void;
  onGenerate: () => void;
  canGenerate: boolean;
};

export default function CertificateMapStep({
  templateConfig,
  csvHeaders,
  mapping,
  onMappingChange,
  onPreview,
  onGenerate,
  canGenerate,
}: Props) {
  return (
    <div className="max-w-2xl mx-auto py-8">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Map CSV Columns</h2>
      <p className="text-sm text-gray-500 mb-8">
        Match the fields from your certificate template to the columns in your uploaded CSV file.
      </p>

      <div className="space-y-4">
        {(templateConfig ?? []).filter((b) => b.type !== "image").map((box) => (
          <div key={box.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="font-medium text-gray-900">{box.label}</div>
            <ArrowRight className="w-4 h-4 text-gray-400 mx-4 flex-shrink-0" />
            <select
              className="block w-64 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-2 border"
              value={mapping[box.id] || ""}
              onChange={(e) => onMappingChange({ ...mapping, [box.id]: e.target.value })}
            >
              <option value="">-- Select Column --</option>
              {csvHeaders.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div className="mt-8 flex justify-end gap-3">
        <Button color="secondary" onClick={onPreview} isDisabled={!canGenerate}>
          <Eye className="w-4 h-4 mr-2" />
          Preview
        </Button>
        <Button color="primary" onClick={onGenerate} isDisabled={!canGenerate}>
          Start Generating PDFs
        </Button>
      </div>
    </div>
  );
}
