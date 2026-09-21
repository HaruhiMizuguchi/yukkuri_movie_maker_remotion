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
  options: WorkflowRunOptions,
) => Promise<void>;

export type RenderJobHandlerInput = {
  payload: unknown;
  prisma: PrismaClient;
  implementations: WorkflowStepImplementations;
  runWorkflowImpl?: RunWorkflowImpl;
  prepareContext?: (jobId: string) => Promise<Partial<WorkflowContext>>;
  publishOutputs?: (jobId: string) => Promise<void>;
};

export async function handleRenderJobPayload({
  payload,
  prisma,
  implementations,
  runWorkflowImpl = runWorkflow,
  prepareContext,
  publishOutputs,
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
  const jobRecord = await prisma.job.findUnique({
    where: { id: jobId },
    select: { projectId: true },
  });
  if (!jobRecord) {
    throw new Error(`Job was not found: ${jobId}`);
  }
  await ensureSteps(prisma, jobId);
  const startedAt = new Date();
  await prisma.$transaction([
    prisma.job.update({
      where: { id: jobId },
      data: {
        status: JobStatus.RUNNING,
        error: null,
        startedAt,
        completedAt: null,
      },
    }),
    prisma.project.update({
      where: { id: jobRecord.projectId },
      data: { status: JobStatus.RUNNING },
    }),
  ]);

  try {
    const context = await prepareContext?.(jobId);
    await runWorkflowImpl(
      { ...context, jobId, prisma },
      implementations,
      runOptions,
    );
    await publishOutputs?.(jobId);
    await prisma.$transaction([
      prisma.job.update({
        where: { id: jobId },
        data: {
          status: JobStatus.COMPLETED,
          error: null,
          completedAt: new Date(),
        },
      }),
      prisma.project.update({
        where: { id: jobRecord.projectId },
        data: { status: JobStatus.COMPLETED },
      }),
    ]);
  } catch (error) {
    await prisma.$transaction([
      prisma.job.update({
        where: { id: jobId },
        data: {
          status: JobStatus.FAILED,
          error: String(error instanceof Error ? error.message : error),
          completedAt: new Date(),
        },
      }),
      prisma.project.update({
        where: { id: jobRecord.projectId },
        data: { status: JobStatus.FAILED },
      }),
    ]);
    throw error;
  }
}

export async function ensureSteps(
  prisma: PrismaClient,
  jobId: string,
): Promise<void> {
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
