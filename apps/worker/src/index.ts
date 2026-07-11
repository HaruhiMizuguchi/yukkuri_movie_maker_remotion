import "dotenv/config";
import PgBoss from "pg-boss";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { createProductionWorkflowImplementations } from "@ymm/core";
import { handleRenderJobPayload } from "./renderJobHandler";
import { readWorkerSettings } from "./settings";
import { resolveWorkerOutputRoot, resolveWorkerWorkspaceRoot } from "./workspaceRoot";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
});
const env = envSchema.parse(process.env);

const prisma = new PrismaClient();
const boss = new PgBoss({ connectionString: env.DATABASE_URL });
const workspaceRoot = resolveWorkerWorkspaceRoot(import.meta.url);
const outputRoot = resolveWorkerOutputRoot(import.meta.url, process.env.YMM_WORKFLOW_OUTPUT_ROOT);

async function main() {
  await boss.start();

  await boss.work("yukkuri.render", async (job) => {
    const payload = (job as { data?: unknown }).data ?? job;
    const settings = await readWorkerSettings(workspaceRoot);
    const implementations = createProductionWorkflowImplementations({
      workspaceRoot,
      outputRoot,
      outputPreset: settings.outputPreset,
      ttsProvider: process.env.YMM_TTS_PROVIDER === "mock" ? "mock" : "aivis",
      allowMockTtsFallback: process.env.YMM_ALLOW_MOCK_TTS_FALLBACK === "true",
      disableRemotion: process.env.YMM_DISABLE_REMOTION === "true",
    });
    await handleRenderJobPayload({ payload, prisma, implementations });
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
