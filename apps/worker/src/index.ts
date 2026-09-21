import "dotenv/config";
import PgBoss from "pg-boss";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  createProductionWorkflowImplementations,
  captureJobInputs,
  prepareJobWorkspace,
  publishJobOutputs,
  withProjectInputLock,
} from "@ymm/core";
import { handleRenderJobPayload } from "./renderJobHandler";
import { readWorkerApiKeys, readWorkerSettings } from "./settings";
import { parseWorkflowPayload } from "./workflowPayload";
import {
  resolveWorkerOutputRoot,
  resolveWorkerWorkspaceRoot,
} from "./workspaceRoot";
import { startWorkerHeartbeat } from "./heartbeat";
import { withProjectAdvisoryLock } from "./projectLock";
import {
  runAutomationSchedulerTick,
  startAutomationScheduler,
} from "./automationScheduler";

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
  const automationScheduler = startAutomationScheduler({
    intervalMs: Number(process.env.YMM_AUTOMATION_POLL_INTERVAL_MS ?? 60_000),
    runTick: () =>
      runAutomationSchedulerTick({ prisma, boss, workspaceRoot, outputRoot }),
  });

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
    const [settings, apiKeys] = await Promise.all([
      readWorkerSettings(workspaceRoot, jobSettings),
      readWorkerApiKeys(workspaceRoot),
    ]);
    const implementations = createProductionWorkflowImplementations({
      workspaceRoot,
      outputRoot,
      outputPreset: settings.outputPreset,
      googleApiKey: apiKeys.google,
      openaiApiKey: apiKeys.openai,
      anthropicApiKey: apiKeys.anthropic,
      scriptModel: settings.models.script,
      imageModel: settings.models.image,
      ttsProvider: process.env.YMM_TTS_PROVIDER === "mock" ? "mock" : "aivis",
      allowMockTtsFallback: process.env.YMM_ALLOW_MOCK_TTS_FALLBACK === "true",
      disableRemotion: process.env.YMM_DISABLE_REMOTION === "true",
    });
    const execute = () =>
      handleRenderJobPayload({
        payload,
        prisma,
        implementations,
        prepareContext: async (jobId) => {
          const job = await prisma.job.findUniqueOrThrow({
            where: { id: jobId },
            include: { project: true },
          });
          const jobPaths = {
            workspaceRoot,
            outputRoot,
            projectId: job.projectId,
            jobId,
          };
          // 旧Jobも最初の実行時に固定し、以降のresumeで共有入力を読まない。
          const inputRevision = job.inputRevision?.startsWith("snapshot-v1:")
            ? job.inputRevision
            : await withProjectInputLock(prisma, job.projectId, async () => {
                const revision = await captureJobInputs({
                  ...jobPaths,
                  settings,
                  theme: job.project.theme,
                });
                await prisma.job.update({
                  where: { id: jobId },
                  data: { inputRevision: revision, settingsJson: settings },
                });
                return revision;
              });
          return {
            projectRoot: await prepareJobWorkspace({
              ...jobPaths,
              inputRevision,
            }),
          };
        },
        publishOutputs: async (jobId) => {
          if (projectId)
            await withProjectInputLock(prisma, projectId, () =>
              publishJobOutputs({
                workspaceRoot,
                outputRoot,
                projectId,
                jobId,
              }),
            );
        },
      });
    if (projectId) {
      await withProjectAdvisoryLock(env.DATABASE_URL, projectId, execute);
    } else {
      await execute();
    }
  });

  const shutdown = async () => {
    automationScheduler.stop();
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
