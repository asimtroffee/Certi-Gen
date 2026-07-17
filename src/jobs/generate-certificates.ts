import { inngest } from "./inngest-client";
import prisma from "@/src/lib/prisma";
import { generateCertificateZip, ProgressState, autoMapColumns, detectColumn, NAME_PATTERNS } from "@/src/lib/certificate";
import type { FieldConfig } from "@/src/components/CanvasEditor";
import { put } from "@vercel/blob";

export const generateCertificates = inngest.createFunction(
  { id: "generate-certificates", name: "Generate Certificates" },
  { event: "certificates/generate" },
  async ({ event, step }) => {
    const { submissionId } = event.data;
    
    // 1. Fetch submission and mark as processing
    const submission = await step.run("init-job", async () => {
      const sub = await prisma.submission.findUnique({
        where: { id: submissionId },
        include: { event: true },
      });
      if (!sub || !sub.event) throw new Error("Submission or Event not found");
      
      await prisma.submission.update({
        where: { id: submissionId },
        data: { status: "PROCESSING" },
      });
      return sub;
    });

    // 2. Generate and Upload
    const zipUrl = await step.run("generate-and-upload", async () => {
      try {
        const studentData = submission.studentData as Record<string, unknown>[];
        const templateConfig = submission.event.templateConfig as FieldConfig[];
        const templateUrl = submission.event.templateUrl;
        
        const res = await fetch(templateUrl);
        if (!res.ok) throw new Error("Failed to fetch template image");
        const templateImageBytes = await res.arrayBuffer();

        const progressState: ProgressState = {
          setProgress: () => {},
          setEta: () => {},
        };
        
        if (studentData.length === 0) throw new Error("No student data");
        const csvHeaders = Object.keys(studentData[0]);
        const mapping = autoMapColumns(csvHeaders, templateConfig);
        const nameColumn = detectColumn(csvHeaders, NAME_PATTERNS) || csvHeaders[0] || "";

        const cancelRef = { current: false };

        const zipBlob = await generateCertificateZip(
          studentData,
          templateConfig,
          templateUrl,
          mapping,
          csvHeaders,
          nameColumn,
          progressState,
          cancelRef,
          templateImageBytes,
          "certificate"
        );
        
        if (!zipBlob) throw new Error("Failed to generate ZIP");

        // Upload to Blob
        const buffer = Buffer.from(await zipBlob.arrayBuffer());
        const blob = await put(`certificates-${submissionId}.zip`, buffer, {
          access: "public",
          contentType: "application/zip",
        });

        return blob.url;
      } catch (error: any) {
        // If it fails, we want to know why
        console.error("Generation failed:", error);
        throw new Error(error.message || "Failed during generation and upload");
      }
    });

    // 3. Mark as completed
    await step.run("mark-completed", async () => {
      await prisma.submission.update({
        where: { id: submissionId },
        data: { 
          status: "COMPLETED",
          zipUrl,
          certificateCount: (submission.studentData as any[]).length
        },
      });
    });

    return { success: true, zipUrl };
  }
);
