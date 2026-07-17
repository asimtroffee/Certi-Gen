import { inngest } from "./inngest-client";
import { prisma } from "@/src/lib/prisma";
import { generatePdf, autoMapColumns, detectColumn, NAME_PATTERNS } from "@/src/lib/certificate";
import type { FieldConfig } from "@/src/components/CanvasEditor";
import { put } from "@vercel/blob";
import JSZip from "jszip";
import type { PDFFont } from "pdf-lib";

export const generateCertificates = inngest.createFunction(
  { 
    id: "generate-certificates", 
    name: "Generate Certificates",
    triggers: [{ event: "certificates/generate" }]
  },
  async ({ event, step }: any) => {
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

        if (studentData.length === 0) throw new Error("No student data");
        const csvHeaders = Object.keys(studentData[0]);
        const mapping = autoMapColumns(csvHeaders, templateConfig);
        const nameColumn = detectColumn(csvHeaders, NAME_PATTERNS) || csvHeaders[0] || "";

        const zip = new JSZip();
        const greatVibesRef: { current: ArrayBuffer | null } = { current: null };
        const fontCache: Record<string, PDFFont> = {};

        for (let i = 0; i < studentData.length; i++) {
          const student = studentData[i];
          const pdfBytes = await generatePdf(
            student,
            templateConfig,
            templateUrl,
            mapping,
            templateImageBytes,
            fontCache,
            greatVibesRef
          );
          const fileName = `${student[nameColumn] || student[csvHeaders[0]] || `certificate_${i + 1}`}.pdf`;
          zip.file(fileName, pdfBytes);
        }

        const zipBlob = await zip.generateAsync({ type: "blob" });
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
