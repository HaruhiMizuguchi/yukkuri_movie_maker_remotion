import type { PrismaClient } from "@prisma/client";

export type WorkflowContext = {
  jobId: string;
  prisma: PrismaClient;
};

export const WORKFLOW_STEPS = [
  { name: "theme_selection", implemented: false },
  { name: "script_generation", implemented: false },
  { name: "title_generation", implemented: false },
  { name: "tts_generation", implemented: false },
  { name: "character_synthesis", implemented: false },
  { name: "background_generation", implemented: false },
  { name: "background_animation", implemented: false },
  { name: "subtitle_generation", implemented: false },
  { name: "video_composition", implemented: false },
  { name: "audio_enhancement", implemented: false },
  { name: "illustration_insertion", implemented: false },
  { name: "final_encoding", implemented: false },
  { name: "youtube_upload", implemented: false },
] as const;

export type WorkflowStepName = (typeof WORKFLOW_STEPS)[number]["name"];

const SKIPPED_OUTPUT = { skipped: true, reason: "not_implemented" } as const;

export async function runWorkflow(ctx: WorkflowContext): Promise<void> {
  for (const step of WORKFLOW_STEPS) {
    const startedAt = new Date();
    await ctx.prisma.workflowStep.upsert({
      where: { jobId_stepName: { jobId: ctx.jobId, stepName: step.name } },
      update: { status: "RUNNING", startedAt, error: null },
      create: { jobId: ctx.jobId, stepName: step.name, status: "RUNNING", startedAt },
    });

    // TODO: plug in step implementation here.
    const completedAt = new Date();
    const status = step.implemented ? "COMPLETED" : "SKIPPED";
    const outputJson = step.implemented ? { ok: true } : SKIPPED_OUTPUT;

    await ctx.prisma.workflowStep.update({
      where: { jobId_stepName: { jobId: ctx.jobId, stepName: step.name } },
      data: { status, completedAt, outputJson },
    });
  }
}
