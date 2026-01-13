import "dotenv/config";
import PgBoss from "pg-boss";
import { PrismaClient, JobStatus, StepStatus } from "@prisma/client";
import { z } from "zod";
import { runWorkflow, WORKFLOW_STEPS } from "@ymm/core";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
});
const env = envSchema.parse(process.env);

const prisma = new PrismaClient();
const boss = new PgBoss({ connectionString: env.DATABASE_URL });

async function ensureSteps(jobId: string) {
  const stepNames = WORKFLOW_STEPS.map((step) => step.name);

  for (const stepName of stepNames) {
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
    const jobId = z.object({ jobId: z.string().uuid() }).parse(payload).jobId;

    await ensureSteps(jobId);
    await prisma.job.update({ where: { id: jobId }, data: { status: JobStatus.RUNNING } });

    try {
      await runWorkflow({ jobId, prisma });
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
