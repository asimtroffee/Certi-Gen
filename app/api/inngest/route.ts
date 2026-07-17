import { serve } from "inngest/next";
import { inngest } from "@/src/jobs/inngest-client";
import { generateCertificates } from "@/src/jobs/generate-certificates";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    generateCertificates,
  ],
});
