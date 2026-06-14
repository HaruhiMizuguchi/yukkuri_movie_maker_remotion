import { JobStatus, PrismaClient, StepStatus } from "@prisma/client";
import {
  runWorkflow,
  WORKFLOW_STEPS,
  type WorkflowRunOptions,
  type WorkflowStepImplementations,
  type WorkflowContext,
} from "@ymm/core";
import { z } from "zod";
import { parseWorkflowPayload } from "./workflowPayload";

type RunWorkflowImpl = (
  ctx: WorkflowContext,
  implementations: WorkflowStepImplementations,
  options: WorkflowRunOptions
) => Promise<void>;

export type RenderJobHandlerInput = {
  payload: unknown;
  prisma: PrismaClient;
  implementations: WorkflowStepImplementations;
  runWorkflowImpl?: RunWorkflowImpl;
};

export async function handleRenderJobPayload({
  payload,
  prisma,
  implementations,
  runWorkflowImpl = runWorkflow,
}: RenderJobHandlerInput): Promise<void> {
  let parsed: ReturnType<typeof parseWorkflowPayload>;

  try {
    parsed = parseWorkflowPayload(payload);
  } catch (error) {
    const jobId = readJobId(payload);
    if (jobId) {
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: JobStatus.FAILED,
          error: `Invalid workflow payload: ${error instanceof Error ? error.message : String(error)}`,
        },
      });
    }
    throw error;
  }

  const { jobId, runOptions } = parsed;
  await ensureSteps(prisma, jobId);
  await prisma.job.update({ where: { id: jobId }, data: { status: JobStatus.RUNNING } });

  try {
    await runWorkflowImpl({ jobId, prisma }, implementations, runOptions);
    await prisma.job.update({ where: { id: jobId }, data: { status: JobStatus.COMPLETED } });
  } catch (error) {
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: JobStatus.FAILED,
        error: String(error instanceof Error ? error.message : error),
      },
    });
    throw error;
  }
}

export async function ensureSteps(prisma: PrismaClient, jobId: string): Promise<void> {
  for (const stepName of WORKFLOW_STEPS) {
    await prisma.workflowStep.upsert({
      where: { jobId_stepName: { jobId, stepName } },
      update: {},
      create: { jobId, stepName, status: StepStatus.PENDING },
    });
  }
}

const jobIdSchema = z.string().uuid();

const readJobId = (payload: unknown): string | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const maybeJobId = (payload as { jobId?: unknown }).jobId;
  const parsed = jobIdSchema.safeParse(maybeJobId);
  return parsed.success ? parsed.data : null;
};
