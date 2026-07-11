import "dotenv/config";
import PgBoss from "pg-boss";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { createProductionWorkflowImplementations } from "@ymm/core";
import { handleRenderJobPayload } from "./renderJobHandler";
import { readWorkerSettings } from "./settings";
import { parseWorkflowPayload } from "./workflowPayload";
import {
  resolveWorkerOutputRoot,
  resolveWorkerWorkspaceRoot,
} from "./workspaceRoot";
import { startWorkerHeartbeat } from "./heartbeat";
import { withProjectAdvisoryLock } from "./projectLock";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
});
const env = envSchema.parse(process.env);

const prisma = new PrismaClient();
const boss = new PgBoss({ connectionString: env.DATABASE_URL });
const workspaceRoot = resolveWorkerWorkspaceRoot(import.meta.url);
const outputRoot = resolveWorkerOutputRoot(
  import.meta.url,
  process.env.YMM_WORKFLOW_OUTPUT_ROOT,
);

async function main() {
  await boss.start();
  const heartbeat = startWorkerHeartbeat(workspaceRoot);

  await boss.work("yukkuri.render", async (job) => {
    const payload = (job as { data?: unknown }).data ?? job;
    let jobSettings: unknown;
    let projectId: string | undefined;
    try {
      const { jobId } = parseWorkflowPayload(payload);
      const jobRecord = await prisma.job.findUnique({
        where: { id: jobId },
        select: { settingsJson: true, projectId: true },
      });
      jobSettings = jobRecord?.settingsJson;
      projectId = jobRecord?.projectId;
    } catch {
      // 不正ペイロードはhandlerで失敗記録するため、ここでは既定設定の読込を続ける。
    }
    const settings = await readWorkerSettings(workspaceRoot, jobSettings);
    const implementations = createProductionWorkflowImplementations({
      workspaceRoot,
      outputRoot,
      outputPreset: settings.outputPreset,
      ttsProvider: process.env.YMM_TTS_PROVIDER === "mock" ? "mock" : "aivis",
      allowMockTtsFallback: process.env.YMM_ALLOW_MOCK_TTS_FALLBACK === "true",
      disableRemotion: process.env.YMM_DISABLE_REMOTION === "true",
    });
    const execute = () =>
      handleRenderJobPayload({ payload, prisma, implementations });
    if (projectId) {
      await withProjectAdvisoryLock(env.DATABASE_URL, projectId, execute);
    } else {
      await execute();
    }
  });

  const shutdown = async () => {
    heartbeat.stop();
    await boss.stop({ graceful: true, timeout: 30_000 });
    await prisma.$disconnect();
  };
  process.once("SIGINT", () => void shutdown().finally(() => process.exit(0)));
  process.once("SIGTERM", () => void shutdown().finally(() => process.exit(0)));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
