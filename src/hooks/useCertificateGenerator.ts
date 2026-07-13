"use client";

import { useState, useRef } from "react";
import { PDFFont } from "pdf-lib";
import { saveAs } from "file-saver";
import type { FieldConfig } from "@/src/components/CanvasEditor";
import { parseFile } from "@/src/lib/file-parser";
import {
  MAX_STUDENTS,
  NAME_PATTERNS,
  autoMapColumns,
  detectColumn,
  generateCertificateZip,
  generatePdf,
  ProgressState,
} from "@/src/lib/certificate";

type Props = {
  templateUrl: string;
  templateConfig: FieldConfig[] | null;
  submitEndpoint: string;
  teacherName: string;
};

export function useCertificateGenerator({
  templateUrl,
  templateConfig,
  submitEndpoint,
  teacherName,
}: Props) {
  const [csvData, setCsvData] = useState<Record<string, unknown>[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [nameColumn, setNameColumn] = useState("");
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [progress, setProgress] = useState(0);
  const [isSuccess, setIsSuccess] = useState(false);
  const [eta, setEta] = useState("");
  const cancelRef = useRef(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseFile(buffer, file.name);

      if (parsed.headers.length === 0 || parsed.data.length === 0) {
        alert("The file is empty or has no data rows.");
        return;
      }

      setCsvData(parsed.data);
      setCsvHeaders(parsed.headers);
      setMapping(autoMapColumns(parsed.headers, templateConfig ?? []));
      setNameColumn(detectColumn(parsed.headers, NAME_PATTERNS) || parsed.headers[0] || "");
      setStep(2);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to parse file");
    }
  };

  const generatePDFs = async () => {
    if (csvData.length === 0) {
      alert("No student data to generate certificates for.");
      return;
    }

    if (csvData.length > MAX_STUDENTS) {
      alert(`Maximum ${MAX_STUDENTS} students allowed per batch. Your file has ${csvData.length}.`);
      return;
    }

    setStep(3);
    cancelRef.current = false;
    setIsCancelling(false);
    setEta("");

    try {
      const templateResponse = await fetch(templateUrl);
      if (!templateResponse.ok) throw new Error("Failed to load template image");
      const templateImageBytes = await templateResponse.arrayBuffer();

      const progressState: ProgressState = {
        setProgress,
        setEta,
      };

      const zipContent = await generateCertificateZip(
        csvData,
        templateConfig ?? [],
        templateUrl,
        mapping,
        csvHeaders,
        nameColumn,
        progressState,
        cancelRef,
        templateImageBytes,
        "certificate"
      );

      if (!zipContent) {
        setStep(2);
        return;
      }

      const submissionRes = await fetch(submitEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherName: teacherName || "Teacher",
          studentData: csvData,
        }),
      });

      if (!submissionRes.ok) {
        const errData = await submissionRes.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to save submission");
      }

      saveAs(zipContent, "Certificates.zip");
      setIsSuccess(true);
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "An unexpected error occurred during generation.");
    }
  };

  const generatePreview = async () => {
    if (csvData.length === 0 || Object.values(mapping).length === 0) return;

    try {
      const res = await fetch(templateUrl);
      if (!res.ok) throw new Error("Failed to load template image");
      const templateImageBytes = await res.arrayBuffer();
      const student = csvData[0];
      const greatVibesRef: { current: ArrayBuffer | null } = { current: null };
      const fontCache: Record<string, PDFFont> = {};

      const pdfBytes = await generatePdf(
        student,
        templateConfig ?? [],
        templateUrl,
        mapping,
        templateImageBytes,
        fontCache,
        greatVibesRef
      );

      const blob = new Blob([pdfBytes as BlobPart], { type: "application/pdf" });
      saveAs(blob, "preview.pdf");
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Preview generation failed");
    }
  };

  return {
    csvData,
    csvHeaders,
    mapping,
    setMapping,
    step,
    setStep,
    progress,
    isSuccess,
    eta,
    isCancelling,
    setIsCancelling,
    cancelRef,
    handleFileUpload,
    generatePDFs,
    generatePreview,
  };
}
