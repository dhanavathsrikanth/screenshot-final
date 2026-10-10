import { auth } from "@clerk/nextjs/server";
import { createR2Storage, resolveStorageConfig } from "@snapforge/storage";
import { createCaptureArtifactHandler } from "@/lib/capture-artifact";
import { getCaptureRuntime } from "@/lib/capture-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const handler = createCaptureArtifactHandler({
  authenticate: async () => (await auth()).userId,
  lookup: async (accountId, jobId, requestId) => (await getCaptureRuntime()).service.lookup({ accountId }, jobId, requestId),
  storage: () => {
    const config = resolveStorageConfig();
    if (!config) throw new Error("Capture delivery requires storage configuration");
    return { config, client: createR2Storage(config) };
  },
});

export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  return handler(request, (await context.params).token);
}
