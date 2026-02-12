import type { PrismaClient } from "@prisma/client";

export type WorkflowContext = {
  jobId: string;
  prisma: PrismaClient;
  outputRoot?: string;
};

export const WORKFLOW_STEPS = [
  "theme_selection",
  "script_generation",
  "title_generation",
  "tts_generation",
  "character_synthesis",
  "background_generation",
  "background_animation",
  "subtitle_generation",
  "video_composition",
  "audio_enhancement",
  "illustration_insertion",
  "final_encoding",
  "youtube_upload",
] as const;

export type WorkflowStepName = (typeof WORKFLOW_STEPS)[number];

export type WorkflowStepImplementation = (
  ctx: WorkflowContext
) => Promise<Record<string, unknown> | void>;

export type WorkflowStepImplementations = Partial<
  Record<WorkflowStepName, WorkflowStepImplementation>
>;

export const SKIPPED_OUTPUT = { skipped: true, reason: "not_implemented" } as const;
export const MANUAL_SKIP_OUTPUT = { skipped: true, reason: "manual_skip" } as const;

export { registerProjectFiles } from "./projectFile";
export { createDefaultWorkflowImplementations } from "./defaultWorkflow";
export type { DefaultWorkflowOptions } from "./defaultWorkflow";

export type WorkflowRunMode = "full" | "resume";

export type WorkflowRunOptions = {
  mode?: WorkflowRunMode;
  skipSteps?: WorkflowStepName[];
};

export async function runWorkflow(
  ctx: WorkflowContext,
  implementations: WorkflowStepImplementations = {},
  options: WorkflowRunOptions = {}
): Promise<void> {
  const mode = options.mode ?? "resume";
  const manualSkipSteps = new Set(options.skipSteps ?? []);
  const existingSteps = await ctx.prisma.workflowStep.findMany({
    where: { jobId: ctx.jobId },
  });
  const existingStepsByName = new Map(
    existingSteps.map((step) => [step.stepName, step])
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
      update: { status: "RUNNING", startedAt, error: null },
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

      const output = await implementation(ctx);
      const completedAt = new Date();
      await ctx.prisma.workflowStep.update({
        where: { jobId_stepName: { jobId: ctx.jobId, stepName } },
        data: {
          status: "COMPLETED",
          completedAt,
          outputJson: output ?? { ok: true },
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
