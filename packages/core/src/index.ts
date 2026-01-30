import type { PrismaClient } from "@prisma/client";

export type WorkflowContext = {
  jobId: string;
  prisma: PrismaClient;
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

export { registerProjectFiles } from "./projectFile";

export async function runWorkflow(
  ctx: WorkflowContext,
  implementations: WorkflowStepImplementations = {}
): Promise<void> {
  for (const stepName of WORKFLOW_STEPS) {
    const startedAt = new Date();
    await ctx.prisma.workflowStep.upsert({
      where: { jobId_stepName: { jobId: ctx.jobId, stepName } },
      update: { status: "RUNNING", startedAt, error: null },
      create: { jobId: ctx.jobId, stepName, status: "RUNNING", startedAt },
    });

    try {
      const implementation = implementations[stepName];
      const output = implementation ? await implementation(ctx) : null;
      const completedAt = new Date();
      const status = implementation ? "COMPLETED" : "SKIPPED";
      const outputJson = implementation
        ? output ?? { ok: true }
        : SKIPPED_OUTPUT;

      await ctx.prisma.workflowStep.update({
        where: { jobId_stepName: { jobId: ctx.jobId, stepName } },
        data: { status, completedAt, outputJson, error: null },
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
