import "dotenv/config";
import PgBoss from "pg-boss";
import { PrismaClient, JobStatus, StepStatus } from "@prisma/client";
import { z } from "zod";
import { createProductionWorkflowImplementations, runWorkflow, WORKFLOW_STEPS } from "@ymm/core";
import { parseWorkflowPayload } from "./workflowPayload";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
});
const env = envSchema.parse(process.env);

const prisma = new PrismaClient();
const boss = new PgBoss({ connectionString: env.DATABASE_URL });
const implementations = createProductionWorkflowImplementations({
  outputRoot: process.env.YMM_WORKFLOW_OUTPUT_ROOT,
  ttsProvider: process.env.YMM_TTS_PROVIDER === "mock" ? "mock" : "aivis",
  allowMockTtsFallback: process.env.YMM_ALLOW_MOCK_TTS_FALLBACK === "true",
  disableRemotion: process.env.YMM_DISABLE_REMOTION === "true",
});

async function ensureSteps(jobId: string) {
  for (const stepName of WORKFLOW_STEPS) {
    await prisma.workflowStep.upsert({
      where: { jobId_stepName: { jobId, stepName } },
      update: {},
      create: { jobId, stepName, status: StepStatus.PENDING },
    });
  }
}

async function main() {
  await boss.start();

  await boss.work("yukkuri.render", async (job) => {
    const payload = (job as { data?: unknown }).data ?? job;
    const { jobId, runOptions } = parseWorkflowPayload(payload);

    await ensureSteps(jobId);
    await prisma.job.update({ where: { id: jobId }, data: { status: JobStatus.RUNNING } });

    try {
      await runWorkflow({ jobId, prisma }, implementations, runOptions);
      await prisma.job.update({ where: { id: jobId }, data: { status: JobStatus.COMPLETED } });
    } catch (err: any) {
      await prisma.job.update({
        where: { id: jobId },
        data: { status: JobStatus.FAILED, error: String(err?.message ?? err) },
      });
      throw err;
    }
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
