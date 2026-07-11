import { Prisma, type PrismaClient } from "@prisma/client";
import { WORKFLOW_STEPS, type WorkflowStepName } from "@ymm/shared";

export { WORKFLOW_STEPS } from "@ymm/shared";
export type { WorkflowStepName } from "@ymm/shared";

export type WorkflowContext = {
  jobId: string;
  prisma: PrismaClient;
  outputRoot?: string;
  forceStep?: boolean;
};

export type WorkflowStepImplementation = (
  ctx: WorkflowContext,
) => Promise<Record<string, unknown> | void>;

export type WorkflowStepImplementations = Partial<
  Record<WorkflowStepName, WorkflowStepImplementation>
>;

export const SKIPPED_OUTPUT = {
  skipped: true,
  reason: "not_implemented",
} as const;
export const MANUAL_SKIP_OUTPUT = {
  skipped: true,
  reason: "manual_skip",
} as const;

export { registerProjectFiles } from "./projectFile";
export { createDefaultWorkflowImplementations } from "./defaultWorkflow";
export type { DefaultWorkflowOptions } from "./defaultWorkflow";
export { createProductionWorkflowImplementations } from "./productionWorkflow";
export type { ProductionWorkflowOptions } from "./productionWorkflow";
export {
  addClip,
  addMarker,
  deleteClip,
  duplicateClip,
  moveClip,
  resizeClip,
  setPlaybackRange,
  splitClip,
  timelineToRemotionProps,
  type RemotionTimelineProps,
  updateClip,
} from "./timeline";

export type WorkflowRunMode = "full" | "resume";

export type WorkflowRunOptions = {
  mode?: WorkflowRunMode;
  skipSteps?: WorkflowStepName[];
  forceSteps?: WorkflowStepName[];
};

export async function runWorkflow(
  ctx: WorkflowContext,
  implementations: WorkflowStepImplementations = {},
  options: WorkflowRunOptions = {},
): Promise<void> {
  const mode = options.mode ?? "resume";
  const manualSkipSteps = new Set(options.skipSteps ?? []);
  const forceSteps = new Set(options.forceSteps ?? []);
  const existingSteps = await ctx.prisma.workflowStep.findMany({
    where: { jobId: ctx.jobId },
  });
  const existingStepsByName = new Map(
    existingSteps.map((step) => [step.stepName, step]),
  );

  for (const stepName of WORKFLOW_STEPS) {
    if (manualSkipSteps.has(stepName)) {
      const skippedAt = new Date();
      await ctx.prisma.workflowStep.upsert({
        where: { jobId_stepName: { jobId: ctx.jobId, stepName } },
        update: {
          status: "SKIPPED",
          startedAt: skippedAt,
          completedAt: skippedAt,
          outputJson: MANUAL_SKIP_OUTPUT,
          error: null,
        },
        create: {
          jobId: ctx.jobId,
          stepName,
          status: "SKIPPED",
          startedAt: skippedAt,
          completedAt: skippedAt,
          outputJson: MANUAL_SKIP_OUTPUT,
        },
      });
      continue;
    }

    const existingStep = existingStepsByName.get(stepName);
    const implementation = implementations[stepName];
    if (mode === "resume" && existingStep) {
      if (existingStep.status === "COMPLETED") {
        continue;
      }
      if (existingStep.status === "SKIPPED") {
        const reason = readSkipReason(existingStep.outputJson);
        if (!(reason === "not_implemented" && implementation)) {
          continue;
        }
      }
    }

    const startedAt = new Date();
    await ctx.prisma.workflowStep.upsert({
      where: { jobId_stepName: { jobId: ctx.jobId, stepName } },
      update: {
        status: "RUNNING",
        startedAt,
        completedAt: null,
        outputJson: Prisma.DbNull,
        error: null,
      },
      create: { jobId: ctx.jobId, stepName, status: "RUNNING", startedAt },
    });

    try {
      if (!implementation) {
        const completedAt = new Date();
        await ctx.prisma.workflowStep.update({
          where: { jobId_stepName: { jobId: ctx.jobId, stepName } },
          data: {
            status: "SKIPPED",
            completedAt,
            outputJson: SKIPPED_OUTPUT,
            error: null,
          },
        });
        continue;
      }

      const executionContext = forceSteps.has(stepName)
        ? { ...ctx, forceStep: true }
        : ctx;
      const output = await implementation(executionContext);
      const completedAt = new Date();
      const implementationSkipped = Boolean(
        output &&
        typeof output === "object" &&
        (output as { skipped?: unknown }).skipped === true,
      );
      await ctx.prisma.workflowStep.update({
        where: { jobId_stepName: { jobId: ctx.jobId, stepName } },
        data: {
          status: implementationSkipped ? "SKIPPED" : "COMPLETED",
          completedAt,
          outputJson: toPrismaJson(output ?? { ok: true }),
          error: null,
        },
      });
    } catch (err) {
      const completedAt = new Date();
      const message = err instanceof Error ? err.message : String(err);
      await ctx.prisma.workflowStep.update({
        where: { jobId_stepName: { jobId: ctx.jobId, stepName } },
        data: { status: "FAILED", completedAt, error: message },
      });
      throw err;
    }
  }
}

const readSkipReason = (outputJson: unknown): string | null => {
  if (!outputJson || typeof outputJson !== "object") {
    return null;
  }
  const reason = (outputJson as { reason?: unknown }).reason;
  return typeof reason === "string" ? reason : null;
};

const toPrismaJson = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
